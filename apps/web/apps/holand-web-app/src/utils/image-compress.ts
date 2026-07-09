// ============================================
// Image Compression Utility
// Client-side image resizing & WebP conversion before upload.
// Reduces upload time, storage usage, and bandwidth by 10-20x for
// phone photos (3-8MB JPEG → 100-400KB WebP).
// ============================================

/**
 * Configuration for image compression.
 */
export interface ImageCompressOptions {
  /** Maximum width in pixels (default: 2048). Image resizes proportionally. */
  maxWidth?: number;
  /** Maximum height in pixels (default: 2048). Image resizes proportionally. */
  maxHeight?: number;
  /** Output quality 0-1 (default: 0.85). Only affects lossy formats. */
  quality?: number;
  /** Output MIME type (default: 'image/webp'). Falls back to JPEG if WebP unsupported. */
  outputType?: 'image/webp' | 'image/jpeg' | 'image/png';
  /**
   * Minimum file size in bytes to trigger compression (default: 500KB).
   * Images smaller than this are returned as-is to avoid unnecessary processing.
   */
  minSizeForCompression?: number;
}

/**
 * Default configuration — balanced between quality and performance.
 * WHY: outputType defaults to 'image/jpeg' as a safe fallback.
 * In practice, compressImage() preserves the original format when no
 * outputType is explicitly passed (see the function body). We never
 * force-convert to WebP because that destroys the user's original file
 * format — format optimization should be a backend responsibility.
 */
const DEFAULT_OPTIONS: Required<ImageCompressOptions> = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  outputType: 'image/jpeg',
  minSizeForCompression: 500 * 1024, // 500 KB
};

/**
 * MIME types that should NOT be compressed (vector/animated/special formats).
 * These are passed through as-is.
 */
const SKIP_COMPRESSION_TYPES = new Set([
  'image/svg+xml',
  'image/gif',       // WHY: Compressing GIFs loses animation frames
  'image/webp',      // WHY: Already in target format; re-compression degrades quality
  'image/avif',      // WHY: Already highly compressed
  'image/bmp',       // WHY: Rare, keep original for fidelity
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

/**
 * Check if the browser supports WebP encoding via canvas.
 * Cached after first check.
 */
let webpSupported: boolean | null = null;
function isWebPSupported(): boolean {
  if (webpSupported !== null) return webpSupported;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

/**
 * Compress an image file using the Canvas API.
 *
 * Performs:
 * 1. Resize to fit within maxWidth × maxHeight (proportional, no upscale)
 * 2. Convert to WebP (or JPEG fallback) with specified quality
 * 3. Preserve original filename with updated extension
 *
 * Skips compression for:
 * - SVG, GIF (animated), WebP (already compressed), AVIF
 * - Files smaller than minSizeForCompression
 * - Non-image files
 *
 * @param file - Original image File object
 * @param options - Compression options (all optional)
 * @returns Compressed File object (may be same reference if skipped)
 *
 * @example
 * ```ts
 * const compressed = await compressImage(rawFile, { maxWidth: 1200, quality: 0.8 });
 * console.log(`${rawFile.size} → ${compressed.size} (${((1 - compressed.size / rawFile.size) * 100).toFixed(0)}% smaller)`);
 * ```
 */
export async function compressImage(
  file: File,
  options?: ImageCompressOptions
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // WHY: Preserve the user's original image format unless outputType is explicitly
  // provided. Converting JPEG→WebP or PNG→WebP destroys the original file format;
  // format optimization (WebP/AVIF) should be handled by the backend storage service.
  // Frontend only resizes to reduce upload time, never changes format.
  const supportedOutputTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
  type OutputType = typeof supportedOutputTypes[number];
  if (!options?.outputType && file.type) {
    const fileType = file.type.toLowerCase();
    if (supportedOutputTypes.includes(fileType as OutputType)) {
      opts.outputType = fileType as OutputType;
    } else if (fileType === 'image/jpg') {
      opts.outputType = 'image/jpeg';
    }
    // Other types (BMP, TIFF) fall through to default JPEG
  }

  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Skip formats that shouldn't be compressed
  if (SKIP_COMPRESSION_TYPES.has(file.type)) {
    console.info('[ImageCompress] Skipping (protected format):', {
      name: file.name,
      type: file.type,
    });
    return file;
  }

  // Skip small files — compression overhead isn't worth it
  if (file.size < opts.minSizeForCompression) {
    console.info('[ImageCompress] Skipping (below threshold):', {
      name: file.name,
      size: file.size,
      threshold: opts.minSizeForCompression,
    });
    return file;
  }

  try {
    // Load the image into a bitmap
    const bitmap = await createImageBitmap(file);
    const { width: origW, height: origH } = bitmap;

    // Calculate new dimensions — proportional resize, never upscale
    let newW = origW;
    let newH = origH;

    if (origW > opts.maxWidth || origH > opts.maxHeight) {
      const ratio = Math.min(opts.maxWidth / origW, opts.maxHeight / origH);
      newW = Math.round(origW * ratio);
      newH = Math.round(origH * ratio);
    }

    // If no resize needed and output is same format, skip
    const needsResize = newW !== origW || newH !== origH;
    const needsFormatChange = file.type !== opts.outputType;
    if (!needsResize && !needsFormatChange) {
      bitmap.close();
      console.info('[ImageCompress] Skipping (already optimal):', {
        name: file.name,
        dimensions: `${origW}×${origH}`,
      });
      return file;
    }

    // Draw to canvas at target size
    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      console.warn('[ImageCompress] Canvas 2D context unavailable, returning original');
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, newW, newH);
    bitmap.close();

    // Determine output format — fall back to JPEG if WebP not supported
    let outputType = opts.outputType;
    if (outputType === 'image/webp' && !isWebPSupported()) {
      outputType = 'image/jpeg';
      console.warn('[ImageCompress] WebP encoding not supported, falling back to JPEG');
    }

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, opts.quality);
    });

    if (!blob) {
      console.warn('[ImageCompress] Canvas toBlob returned null, returning original');
      return file;
    }

    // WHY: If compressed size is larger than original (rare, e.g. small PNGs
    // or already-optimized files), return the original to avoid bloat.
    if (blob.size >= file.size) {
      console.info('[ImageCompress] Compressed larger than original, keeping original:', {
        name: file.name,
        original: file.size,
        compressed: blob.size,
      });
      return file;
    }

    // Build new filename with correct extension
    const extMap: Record<string, string> = {
      'image/webp': '.webp',
      'image/jpeg': '.jpg',
      'image/png': '.png',
    };
    const newExt = extMap[outputType] ?? '.webp';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}${newExt}`;

    // Create new File object preserving lastModified
    const compressedFile = new File([blob], newName, {
      type: outputType,
      lastModified: file.lastModified,
    });

    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(0);
    console.info('[ImageCompress] Compressed:', {
      name: file.name,
      original: `${(file.size / 1024).toFixed(0)}KB`,
      compressed: `${(compressedFile.size / 1024).toFixed(0)}KB`,
      reduction: `${reduction}%`,
      dimensions: `${origW}×${origH} → ${newW}×${newH}`,
      format: `${file.type} → ${outputType}`,
    });

    return compressedFile;
  } catch (err: unknown) {
    // WHY: Never block upload due to compression failure — return original
    console.error('[ImageCompress] Compression failed, using original:', {
      name: file.name,
      error: err,
    });
    return file;
  }
}

/**
 * Compress multiple image files in parallel.
 * Non-image files are passed through unchanged.
 *
 * @param files - Array of files to process
 * @param options - Compression options (applied to all images)
 * @returns Array of files (compressed images + unchanged non-images)
 *
 * @example
 * ```ts
 * const files = [photo1, document.pdf, photo2];
 * const optimized = await compressImages(files);
 * // photo1 & photo2 compressed, document.pdf unchanged
 * ```
 */
export async function compressImages(
  files: File[],
  options?: ImageCompressOptions
): Promise<File[]> {
  console.info('[ImageCompress] Batch compression starting:', {
    totalFiles: files.length,
    images: files.filter((f) => f.type.startsWith('image/')).length,
  });

  const results = await Promise.all(
    files.map((file) => compressImage(file, options))
  );

  const totalOriginal = files.reduce((sum, f) => sum + f.size, 0);
  const totalCompressed = results.reduce((sum, f) => sum + f.size, 0);
  const saved = totalOriginal - totalCompressed;

  if (saved > 0) {
    console.info('[ImageCompress] Batch complete:', {
      files: files.length,
      originalTotal: `${(totalOriginal / 1024 / 1024).toFixed(1)}MB`,
      compressedTotal: `${(totalCompressed / 1024 / 1024).toFixed(1)}MB`,
      saved: `${(saved / 1024 / 1024).toFixed(1)}MB (${((saved / totalOriginal) * 100).toFixed(0)}%)`,
    });
  }

  return results;
}
