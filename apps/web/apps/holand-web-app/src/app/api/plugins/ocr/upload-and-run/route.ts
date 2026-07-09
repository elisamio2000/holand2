// ============================================
// POST /api/plugins/ocr/upload-and-run
//
// آپلود تصویر + اجرای OCR — پروکسی به Backend Gateway
// بدون هیچ داده mock یا fake
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayUrl } from '@/lib/service-urls';

const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/gif',
]);

/**
 * Combined upload + OCR endpoint — پروکسی به Backend Gateway.
 *
 * فایل تصویر را مستقیماً به gateway ارسال می‌کند.
 * ذخیره‌سازی فایل، اجرای OCR و پاکسازی همه سمت gateway انجام می‌شود.
 *
 * @endpoint POST /api/plugins/ocr/upload-and-run
 * @param formData.file - فایل تصویر (JPEG, PNG, etc.)
 * @param formData.engine - 'auto' | 'rapidocr' | 'easyocr' | 'tesseract' | 'speed' | 'accuracy'
 * @param formData.lang - 'fa+en' | 'fa' | 'en' | 'ar+en'
 * @returns نتیجه OCR از gateway
 */
export async function POST(req: NextRequest) {
  console.info('[ocr/upload-and-run] Starting combined upload + OCR');
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
    const engine = (formData.get('engine') as string | null) ?? 'auto';
    const lang = (formData.get('lang') as string | null) ?? 'fa+en';

    // ── Validation ─────────────────────────────────────────────────────
    if (!file || typeof file === 'string') {
      console.warn('[ocr/upload-and-run] No file provided');
      return NextResponse.json(
        { ok: false, error: 'فایل ارسال نشد' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      console.warn('[ocr/upload-and-run] Invalid file type:', file.type);
      return NextResponse.json(
        { ok: false, error: `نوع فایل پشتیبانی نمی‌شود: ${file.type}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) {
      console.warn('[ocr/upload-and-run] File too large:', arrayBuffer.byteLength);
      return NextResponse.json(
        { ok: false, error: 'حجم فایل بیش از ۲۰ مگابایت است' },
        { status: 413 }
      );
    }

    console.info('[ocr/upload-and-run] File validated:', {
      name: file.name,
      type: file.type,
      size: arrayBuffer.byteLength,
      engine,
      lang,
    });

    // ── Forward to gateway as multipart ────────────────────────────────
    const gwForm = new FormData();
    gwForm.append('file', new Blob([arrayBuffer], { type: file.type }), file.name);
    gwForm.append('plugin_id', 'image.ocr');
    gwForm.append('engine', engine);
    gwForm.append('lang', lang);

    console.info('[ocr/upload-and-run] Proxying to gateway:', gatewayUrl);

    const gatewayRes = await fetch(
      `${gatewayUrl}/api/v1/plugins/upload-and-run`,
      {
        method: 'POST',
        headers: {
          ...(req.headers.get('authorization')
            ? { Authorization: req.headers.get('authorization')! }
            : {}),
        },
        body: gwForm,
        signal: AbortSignal.timeout(120_000),
      }
    );

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.error('[ocr/upload-and-run] Gateway error:', {
        status: gatewayRes.status,
        text: errText.slice(0, 200),
      });
      return NextResponse.json(
        { ok: false, error: `خطای backend: ${gatewayRes.status} — ${errText.slice(0, 200)}` },
        { status: gatewayRes.status }
      );
    }

    const data = (await gatewayRes.json()) as {
      data?: { has_text?: boolean; char_count?: number };
      [key: string]: unknown;
    };
    console.info('[ocr/upload-and-run] OCR success:', {
      hasText: data.data?.has_text,
      charCount: data.data?.char_count,
    });
    return NextResponse.json(data);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ocr/upload-and-run] Error:', msg);

    // ── Backend Not Available ──────────────────────────────────────────
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      console.error('[ocr/upload-and-run] Gateway unreachable at:', gatewayUrl);
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
