// ============================================
// POST /api/plugins/file-meta/run
//
// پروکسی درخواست file.meta به Backend Gateway
// فایل آپلود شده به gateway ارسال و نتیجه ۵-کاناله بازگردانی می‌شود
//
// Request: multipart/form-data with 'file' field
// Response: { ok, data, channels, warnings, timings_ms }
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayUrl } from '@/lib/service-urls';

/** حداکثر حجم: 200 مگابایت */
const MAX_SIZE_BYTES = 200 * 1024 * 1024;

/** Timeout برای درخواست به gateway (ms) */
const GATEWAY_TIMEOUT_MS = 120_000;

// ==========================================
// POST Handler
// ==========================================

/**
 * پروکسی درخواست file.meta به Backend Gateway.
 *
 * @endpoint POST /api/plugins/file-meta/run
 * @param formData.file - فایل ورودی (multipart)
 * @returns نتیجه کامل ۵-کاناله از plugin
 * @throws {Error} اگر gateway در دسترس نباشد
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
    const formData = await req.formData();
    const file = formData.get('file');

    // ── Validation ─────────────────────────────────────────────────────
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { ok: false, error: 'فایل ارسال نشد' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `حجم فایل بیش از ${Math.round(MAX_SIZE_BYTES / 1048576)} مگابایت است` },
        { status: 413 }
      );
    }

    console.info('[FileMeta API] Proxying to gateway:', {
      filename: file.name,
      size: arrayBuffer.byteLength,
      gateway: gatewayUrl,
    });

    // ── Forward to Gateway ─────────────────────────────────────────────
    const gatewayForm = new FormData();
    gatewayForm.append('file', new Blob([arrayBuffer], { type: file.type }), file.name);
    gatewayForm.append('plugin_id', 'file.meta');
    gatewayForm.append('session_id', 'standalone');

    const gatewayRes = await fetch(`${gatewayUrl}/api/v1/plugins/upload-and-run`, {
      method: 'POST',
      body: gatewayForm,
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error('[FileMeta API] Gateway error:', { status: gatewayRes.status, errText: errText.slice(0, 200) });
      return NextResponse.json(
        { ok: false, error: `خطای backend: ${gatewayRes.status} — ${errText.slice(0, 200)}` },
        { status: gatewayRes.status }
      );
    }

    const result = await gatewayRes.json() as Record<string, unknown>;
    console.info('[FileMeta API] Gateway success:', { ok: result.ok });

    // ── Patch filename ─────────────────────────────────────────────────
    // Gateway فقط UUID temp filename را می‌بیند؛ نام اصلی را بازگردانی می‌کنیم
    const originalName = file.name;
    if (result.data && typeof result.data === 'object') {
      (result.data as Record<string, unknown>).filename = originalName;
    }
    const channels = result.channels as Record<string, unknown> | undefined;
    if (channels?.ui && typeof channels.ui === 'object') {
      const ui = channels.ui as Record<string, unknown>;
      if (ui.file && typeof ui.file === 'object') {
        (ui.file as Record<string, unknown>).filename = originalName;
      }
      if (typeof ui.title === 'string') {
        ui.title = `متادیتای فایل: ${originalName}`;
      }
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[FileMeta API] Request failed:', { error: msg });

    // ── Backend Not Available ──────────────────────────────────────────
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      console.error('[FileMeta API] Gateway unreachable at:', gatewayUrl);
      return NextResponse.json(
        {
          ok: false,
          error: 'Backend Gateway در دسترس نیست. آدرس را در check-and-run.ps1 بررسی کنید.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, error: `خطا در اجرای تحلیل: ${msg}` },
      { status: 500 }
    );
  }
}
