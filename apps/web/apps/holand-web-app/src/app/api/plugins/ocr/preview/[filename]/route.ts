// ============================================
// GET /api/plugins/ocr/preview/[filename]
//
// Serve فایل‌های تصویر آپلود‌شده برای preview
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  bmp: 'image/bmp',
  webp: 'image/webp',
  tiff: 'image/tiff',
  gif: 'image/gif',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  // جلوگیری از path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'tmp', 'ocr-uploads', filename);

  try {
    await stat(filePath);
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }

  const buffer = await readFile(filePath);
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = MIME_MAP[ext] ?? 'image/jpeg';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
