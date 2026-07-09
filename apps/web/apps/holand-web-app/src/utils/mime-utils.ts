// ============================================
// MIME Type Utilities — Centralized extension↔MIME mapping
// Single source of truth for file type inference across the app.
//
// ⚠️ WORKAROUND: This module exists because the storage backend returns
// Content-Type: application/octet-stream for all files. When backend sets
// correct Content-Type headers, the inferMimeFromName and retypeBlob
// functions can be removed. See: v0.18.0_backend-requirements-audit.md §4
// ============================================

// ==========================================
// Extension → MIME Type Map
// ==========================================

/**
 * Comprehensive extension → MIME type mapping.
 *
 * Used for two purposes:
 * 1. **Upload**: When browser `File.type` is empty, infer MIME before sending to backend
 * 2. **Download**: When backend returns `application/octet-stream`, re-type the blob
 *
 * ⚠️ WORKAROUND for backend items §1-§4 in v0.18.0_backend-requirements-audit.md
 * Remove when backend sets correct Content-Type headers and mime_type fields.
 */
export const EXT_MIME_MAP: Record<string, string> = {
  // Text / code
  md: 'text/markdown',
  markdown: 'text/markdown',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  json: 'application/json',
  xml: 'application/xml',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  log: 'text/plain',
  txt: 'text/plain',
  sh: 'text/x-shellscript',
  py: 'text/x-python',
  js: 'text/javascript',
  ts: 'text/typescript',
  sql: 'text/x-sql',
  env: 'text/plain',
  ini: 'text/plain',
  cfg: 'text/plain',
  conf: 'text/plain',
  toml: 'text/toml',
  rst: 'text/x-rst',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  wma: 'audio/x-ms-wma',
  opus: 'audio/opus',
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  // Archives
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  gz: 'application/gzip',
  tar: 'application/x-tar',
};

// ==========================================
// File Category Types
// ==========================================

/** Supported file preview categories for UI rendering decisions */
export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'document' | 'unknown';

/**
 * Extension → category fallback map.
 *
 * Used when both MIME type is missing AND backend returns
 * application/octet-stream. Derives category from filename extension.
 *
 * ⚠️ WORKAROUND — remove when backend always provides correct mime_type.
 */
const EXT_CATEGORY_MAP: Record<string, FileCategory> = {
  // Video
  mp4: 'video', webm: 'video', mkv: 'video', avi: 'video', mov: 'video',
  wmv: 'video', flv: 'video', m4v: 'video', '3gp': 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
  m4a: 'audio', wma: 'audio', opus: 'audio',
  // Image
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image',
  webp: 'image', avif: 'image', bmp: 'image', ico: 'image', tiff: 'image',
  // PDF
  pdf: 'pdf',
  // Documents
  doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
  ppt: 'document', pptx: 'document', rtf: 'document',
  // Text/code
  txt: 'text', md: 'text', json: 'text', xml: 'text', csv: 'text',
  yaml: 'text', yml: 'text', py: 'text', js: 'text', ts: 'text',
  sh: 'text', sql: 'text', log: 'text', ini: 'text', cfg: 'text',
};

// ==========================================
// Inference Functions
// ==========================================

/**
 * Extract the file extension (lowercase, no dot) from a filename.
 *
 * @param filename - The filename to extract extension from
 * @returns Lowercase extension without dot, or null if no extension
 *
 * @example
 * ```ts
 * getExtension('report.PDF')  // 'pdf'
 * getExtension('README')      // null
 * ```
 */
export function getExtension(filename?: string | null): string | null {
  if (!filename) return null;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && ext !== filename.toLowerCase() ? ext : null;
}

/**
 * Infer MIME type from a filename extension.
 *
 * ⚠️ WORKAROUND for backend returning empty mime_type or octet-stream.
 * Remove when backend always sets correct Content-Type.
 *
 * @param filename - Filename to infer MIME from
 * @returns Correct MIME type or null if extension is unknown
 *
 * @example
 * ```ts
 * inferMimeFromName('video.mp4')    // 'video/mp4'
 * inferMimeFromName('unknown.xyz')  // null
 * ```
 */
export function inferMimeFromName(filename?: string | null): string | null {
  const ext = getExtension(filename);
  return ext && ext in EXT_MIME_MAP ? EXT_MIME_MAP[ext] : null;
}

/**
 * Infer MIME type for upload — uses browser-detected type first,
 * falls back to extension-based inference.
 *
 * ⚠️ WORKAROUND for browser File.type being empty on some file types.
 *
 * @param filename - Original filename
 * @param browserType - MIME type detected by the browser (File.type)
 * @returns Best available MIME type, or 'application/octet-stream' as fallback
 *
 * @example
 * ```ts
 * inferMimeForUpload('data.yaml', '')            // 'text/yaml'
 * inferMimeForUpload('photo.jpg', 'image/jpeg')  // 'image/jpeg'
 * ```
 */
export function inferMimeForUpload(filename: string, browserType: string): string {
  if (browserType) return browserType;
  return inferMimeFromName(filename) ?? 'application/octet-stream';
}

/**
 * Determine the file category from a MIME type string.
 * Falls back to filename extension when MIME is missing or octet-stream.
 *
 * @param mimeType - The MIME type to categorize
 * @param fileName - Optional filename for extension-based fallback
 * @returns The file category for rendering decisions
 *
 * @example
 * ```ts
 * getFileCategory('video/mp4')                    // 'video'
 * getFileCategory('application/octet-stream', 'a.mp3')  // 'audio'
 * getFileCategory(null, 'report.docx')            // 'document'
 * ```
 */
export function getFileCategory(
  mimeType?: string | null,
  fileName?: string | null
): FileCategory {
  // Primary: MIME-type based detection
  if (mimeType) {
    const type = mimeType.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';

    // Office / document types — Word, Excel, PowerPoint
    if (
      type === 'application/msword' ||
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      type === 'application/vnd.ms-excel' ||
      type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      type === 'application/vnd.ms-powerpoint' ||
      type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      type === 'application/rtf'
    ) {
      return 'document';
    }

    // Text-like types
    if (
      type.startsWith('text/') ||
      type === 'application/json' ||
      type === 'application/javascript' ||
      type === 'application/typescript' ||
      type === 'application/xml' ||
      type === 'application/x-yaml' ||
      type === 'application/x-sh'
    ) {
      return 'text';
    }

    // application/octet-stream — fall through to extension check
    if (type !== 'application/octet-stream') {
      return 'unknown';
    }
  }

  // Fallback: extension-based detection when MIME is missing or octet-stream
  const ext = getExtension(fileName);
  if (ext && ext in EXT_CATEGORY_MAP) {
    return EXT_CATEGORY_MAP[ext];
  }

  return 'unknown';
}

/**
 * Re-type a blob with the correct MIME type inferred from filename.
 *
 * ⚠️ WORKAROUND for backend returning Content-Type: application/octet-stream.
 * Without correct MIME, <video> and <audio> elements fail with
 * ERR_REQUEST_RANGE_NOT_SATISFIABLE because the browser can't decode the format.
 *
 * Remove this function when backend sets correct Content-Type headers.
 * See: v0.18.0_backend-requirements-audit.md §4.1
 *
 * @param blob - Original blob (potentially with wrong MIME type)
 * @param filename - Filename to infer correct MIME from
 * @returns New blob with correct MIME type, or original if type is already correct
 *
 * @example
 * ```ts
 * const fixedBlob = retypeBlob(octetStreamBlob, 'video.mp4');
 * // fixedBlob.type === 'video/mp4'
 * ```
 */
export function retypeBlob(blob: Blob, filename?: string | null): Blob {
  const correctMime = inferMimeFromName(filename);
  if (!correctMime) return blob;

  // Only re-type if the current MIME is generic/wrong
  if (
    blob.type === 'application/octet-stream' ||
    blob.type === '' ||
    blob.type !== correctMime
  ) {
    return new Blob([blob], { type: correctMime });
  }

  return blob;
}
