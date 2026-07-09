// ============================================
// File Upload Configuration
// Centralized validation rules for file uploads
// ============================================

/**
 * Blocked file extensions — executable and potentially dangerous files.
 * These extensions are blocked for security reasons.
 * Add new extensions here to extend the blocklist.
 */
export const BLOCKED_EXTENSIONS: string[] = [
  // Windows executables
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.pif',
  '.msi',
  '.msp',
  '.mst',
  // Scripts
  '.sh',
  '.bash',
  '.csh',
  '.ksh',
  '.ps1',
  '.psm1',
  '.vbs',
  '.vbe',
  '.wsf',
  '.wsh',
  '.js', // standalone JS executables (not in context of web)
  // Libraries / system
  '.dll',
  '.sys',
  '.drv',
  '.cpl',
  // Shortcuts / links
  '.lnk',
  '.inf',
  '.reg',
  // Java
  '.jar',
  '.jnlp',
];

/**
 * Blocked MIME types — additional safety layer beyond extension checking.
 */
export const BLOCKED_MIME_TYPES: string[] = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-msi',
  'application/x-ms-shortcut',
];

/**
 * Maximum file size in bytes (50 MB).
 * Individual files exceeding this size will be rejected.
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Maximum number of files per upload.
 */
export const MAX_FILES_PER_UPLOAD = 10;

/**
 * Human-readable max file size label.
 */
export const MAX_FILE_SIZE_LABEL = '50 MB';

/**
 * Result of file validation.
 */
export interface FileValidationResult {
  /** Files that passed validation */
  valid: File[];
  /** Files that were rejected with reasons */
  rejected: Array<{ file: File; reason: string }>;
}

/**
 * Validate a list of files against upload rules.
 *
 * Checks:
 * 1. File extension not in blocklist (security)
 * 2. MIME type not in blocklist (security)
 * 3. File size within limit
 * 4. Total count within limit
 *
 * @param files - Array of files to validate
 * @param existingCount - Number of files already attached (for count limit)
 * @returns Validation result with valid files and rejected files with reasons
 *
 * @example
 * ```ts
 * const result = validateFiles(selectedFiles, currentAttachments.length);
 * if (result.rejected.length > 0) {
 *   toast.error(result.rejected[0].reason);
 * }
 * setAttachments(prev => [...prev, ...result.valid]);
 * ```
 */
export function validateFiles(
  files: File[],
  existingCount = 0
): FileValidationResult {
  const valid: File[] = [];
  const rejected: Array<{ file: File; reason: string }> = [];

  for (const file of files) {
    // Check total count limit
    if (valid.length + existingCount >= MAX_FILES_PER_UPLOAD) {
      rejected.push({
        file,
        reason: `Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload`,
      });
      continue;
    }

    // Check file extension
    const ext = getFileExtension(file.name);
    if (ext && BLOCKED_EXTENSIONS.includes(ext)) {
      rejected.push({
        file,
        reason: `"${file.name}" — file type "${ext}" is not allowed for security reasons`,
      });
      continue;
    }

    // Check MIME type
    if (file.type && BLOCKED_MIME_TYPES.includes(file.type)) {
      rejected.push({
        file,
        reason: `"${file.name}" — this file type is not allowed for security reasons`,
      });
      continue;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejected.push({
        file,
        reason: `"${file.name}" — file size exceeds ${MAX_FILE_SIZE_LABEL} limit`,
      });
      continue;
    }

    valid.push(file);
  }

  return { valid, rejected };
}

/**
 * Extract lowercase file extension from filename.
 *
 * @param filename - The filename to extract extension from
 * @returns Extension with dot prefix (e.g., ".pdf") or empty string
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if a file is an image based on its MIME type.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a MIME type represents an image.
 */
export function isImageMimeType(mimeType?: string | null): boolean {
  return !!mimeType && mimeType.startsWith('image/');
}

/**
 * Format file size in human-readable format.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.4 MB", "340 KB")
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ==========================================
// Thumbnail Presets — context-aware sizes
// ==========================================

/**
 * Predefined thumbnail sizes for different display contexts.
 * Sizes are designed for 2x retina displays (display size × 2).
 *
 * WHY: Requesting appropriately-sized thumbnails reduces bandwidth and
 * improves load times. A 40px attachment card doesn't need an 800px thumbnail.
 */
export const THUMBNAIL_PRESETS = {
  /** Attachment card in message bubble — displays at ~40px, 2x = 80px */
  attachmentCard: { width: 100, height: 100, quality: 75 },
  /** Artifacts panel sidebar — displays at ~40px, 2x = 80px */
  panelIcon: { width: 80, height: 80, quality: 70 },
  /** Inline preview — displays at ~350px max, 2x = 700px */
  inlinePreview: { width: 700, height: 700, quality: 85 },
  /** Chat message image — displays at ~500px max, 2x = 1000px */
  chatImage: { width: 1000, height: 1000, quality: 85 },
  /** File Explorer grid card — displays at ~112px, 2x ≈ 256px */
  fileExplorerGrid: { width: 256, height: 256, quality: 80 },
} as const;
