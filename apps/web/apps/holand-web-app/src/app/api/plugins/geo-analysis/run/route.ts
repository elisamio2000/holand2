// ============================================
// POST /api/plugins/geo-analysis/run
//
// پروکسی درخواست تحلیل موقعیت جغرافیایی به Backend Gateway
// بدون هیچ داده mock یا fake
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayUrl } from '@/lib/service-urls';

// ==========================================
// Handler
// ==========================================

/**
 * پروکسی درخواست Geo Analysis به Backend Gateway.
 *
 * این route خروجی file.meta را به پلاگین geo.analysis ارسال
 * می‌کند و تحلیل موقعیت جغرافیایی انجام می‌دهد.
 *
 * @endpoint POST /api/plugins/geo-analysis/run
 * @param body.case_id - شناسه پرونده
 * @param body.file_meta_output - خروجی پلاگین file.meta (اختیاری)
 * @returns نتیجه تحلیل جغرافیایی از gateway
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
    const body = (await req.json()) as Record<string, unknown>;

    if (!body.case_id || typeof body.case_id !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'شناسه پرونده (case_id) الزامی است' },
        { status: 400 }
      );
    }

    console.info('[geo-analysis/run] Proxying to gateway:', {
      case_id: body.case_id,
      hasFileMeta: !!body.file_meta_output,
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
        plugin_id: 'geo.analysis',
        params: {
          case_id: body.case_id,
          ...(body.file_meta_output
            ? { file_meta_output: body.file_meta_output }
            : {}),
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error('[geo-analysis/run] Gateway error:', {
        status: gatewayRes.status,
        errText: errText.slice(0, 200),
      });
      return NextResponse.json(
        { ok: false, error: `خطای backend: ${gatewayRes.status} — ${errText.slice(0, 200)}` },
        { status: gatewayRes.status }
      );
    }

    const data = await gatewayRes.json();
    console.info('[geo-analysis/run] Gateway success');
    return NextResponse.json(data);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[geo-analysis/run] Error:', msg);

    // ── Backend Not Available ──────────────────────────────────────────
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      console.error('[geo-analysis/run] Gateway unreachable at:', gatewayUrl);
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
