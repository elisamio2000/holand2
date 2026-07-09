// ============================================
// POST /api/plugins/ocr/upload-temp
//
// آپلود موقت تصویر، ذخیره در /tmp/ocr-uploads/ و بازگردانی
// مسیر temp + preview URL برای frontend
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// حداکثر سایز: ۲۰ مگابایت
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

// ==========================================
// Handler
// ==========================================

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { ok: false, error: 'فایل ارسال نشد' },
        { status: 400 }
      );
    }

    // Type check
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: `نوع فایل پشتیبانی نمی‌شود: ${file.type}` },
        { status: 400 }
      );
    }

    // Size check
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'حجم فایل بیش از ۲۰ مگابایت است' },
        { status: 413 }
      );
    }

    // Save to temp dir
    const uploadsDir = path.join(process.cwd(), 'tmp', 'ocr-uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}.${ext}`;
    const tempPath = path.join(uploadsDir, fileName);

    await writeFile(tempPath, Buffer.from(arrayBuffer));

    // Response
    return NextResponse.json({
      ok: true,
      file: {
        fileId,
        originalName: file.name,
        tempPath,
        mimeType: file.type,
        sizeBytes: arrayBuffer.byteLength,
        // برای preview — Next.js /api route که تصویر را serve کند
        previewUrl: `/api/plugins/ocr/preview/${fileId}.${ext}`,
      },
    });
  } catch (err) {
    console.error('[upload-temp] error:', err);
    return NextResponse.json(
      { ok: false, error: 'خطای داخلی سرور' },
      { status: 500 }
    );
  }
}
