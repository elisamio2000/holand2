// ============================================
// POST /api/plugins/ocr/run
//
// پروکسی درخواست OCR به Backend Gateway
// بدون هیچ داده mock یا fake
//
// Request Body:
// {
//   path: string,          // مسیر فایل (سمت سرور)
//   engine?: string,       // 'auto' | 'rapidocr' | 'easyocr' | 'tesseract' | 'paddle'
//   strategy?: 'speed' | 'accuracy',
//   languages: string[],   // ['fa', 'en']
// }
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayUrl } from '@/lib/service-urls';

// ==========================================
// Handler
// ==========================================

/**
 * پروکسی درخواست OCR (JSON) به Backend Gateway.
 *
 * NOTE: این route برای درخواست‌هایی است که فایل قبلاً آپلود شده.
 * برای آپلود + اجرا از /api/plugins/ocr/upload-and-run استفاده شود.
 *
 * @endpoint POST /api/plugins/ocr/run
 * @param body.path - مسیر فایل روی سرور
 * @param body.engine - موتور OCR
 * @param body.languages - زبان‌ها
 * @returns نتیجه OCR از gateway
 */
export async function POST(req: NextRequest) {
  let gatewayUrl: string;
  try {
    gatewayUrl = getGatewayUrl();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'API_GATEWAY_URL is not configured';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    if (!body.path || typeof body.path !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'مسیر فایل (path) الزامی است' },
        { status: 400 }
      );
    }

    console.info('[ocr/run] Proxying to gateway:', {
      path: body.path,
      engine: body.engine,
      gateway: gatewayUrl,
    });

    // ── Proxy to gateway ───────────────────────────────────────────────
    const gatewayRes = await fetch(`${gatewayUrl}/api/v1/plugins/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.get('authorization')
          ? { Authorization: req.headers.get('authorization')! }
          : {}),
      },
      body: JSON.stringify({
        plugin_id: 'image.ocr',
        params: {
          path: body.path,
          engine: body.engine ?? 'auto',
          lang: Array.isArray(body.languages) ? body.languages.join('+') : (body.languages ?? 'fa+en'),
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error('[ocr/run] Gateway error:', { status: gatewayRes.status, errText: errText.slice(0, 200) });
      return NextResponse.json(
        { ok: false, error: `خطای backend: ${gatewayRes.status} — ${errText.slice(0, 200)}` },
        { status: gatewayRes.status }
      );
    }

    const data = await gatewayRes.json();
    console.info('[ocr/run] Gateway success');
    return NextResponse.json(data);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ocr/run] Error:', msg);

    // ── Backend Not Available ──────────────────────────────────────────
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      console.error('[ocr/run] Gateway unreachable at:', gatewayUrl);
      return NextResponse.json(
        {
          ok: false,
          error: 'Backend Gateway در دسترس نیست. آدرس را در check-and-run.ps1 بررسی کنید.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, error: `خطای داخلی: ${msg}` },
      { status: 500 }
    );
  }
}
