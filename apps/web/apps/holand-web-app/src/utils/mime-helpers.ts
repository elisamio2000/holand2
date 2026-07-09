// ============================================
// MIME Type Display Helpers
// Human-readable labels, category colors, and icons for MIME types
// ============================================

/**
 * Category of a MIME type for UI grouping and coloring.
 */
export type MimeCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/**
 * Display info for a MIME type.
 */
export interface MimeDisplayInfo {
  /** Short human-readable label (e.g., "JPEG", "MP4") */
  label: string;
  /** Category for color grouping */
  category: MimeCategory;
  /** Tailwind color classes for the pill (bg + text) */
  pillClass: string;
  /** Active (selected) pill classes */
  pillActiveClass: string;
}

// WHY static map: Covers the most common file types in forensic/investigation data.
// Unknown types fall back to generic label from MIME string parsing.
const MIME_LABEL_MAP: Record<string, { label: string; category: MimeCategory }> = {
  'image/jpeg': { label: 'JPEG', category: 'image' },
  'image/png': { label: 'PNG', category: 'image' },
  'image/gif': { label: 'GIF', category: 'image' },
  'image/webp': { label: 'WebP', category: 'image' },
  'image/tiff': { label: 'TIFF', category: 'image' },
  'image/bmp': { label: 'BMP', category: 'image' },
  'image/svg+xml': { label: 'SVG', category: 'image' },
  'image/heic': { label: 'HEIC', category: 'image' },
  'image/heif': { label: 'HEIF', category: 'image' },
  'image/x-raw': { label: 'RAW', category: 'image' },
  'image/x-canon-cr2': { label: 'CR2', category: 'image' },
  'image/x-nikon-nef': { label: 'NEF', category: 'image' },

  'video/mp4': { label: 'MP4', category: 'video' },
  'video/quicktime': { label: 'MOV', category: 'video' },
  'video/x-msvideo': { label: 'AVI', category: 'video' },
  'video/x-matroska': { label: 'MKV', category: 'video' },
  'video/webm': { label: 'WebM', category: 'video' },
  'video/x-ms-wmv': { label: 'WMV', category: 'video' },
  'video/3gpp': { label: '3GP', category: 'video' },

  'audio/mpeg': { label: 'MP3', category: 'audio' },
  'audio/wav': { label: 'WAV', category: 'audio' },
  'audio/ogg': { label: 'OGG', category: 'audio' },
  'audio/flac': { label: 'FLAC', category: 'audio' },
  'audio/aac': { label: 'AAC', category: 'audio' },
  'audio/x-m4a': { label: 'M4A', category: 'audio' },
  'audio/m4a': { label: 'M4A', category: 'audio' },

  'application/pdf': { label: 'PDF', category: 'document' },
  'application/msword': { label: 'DOC', category: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'DOCX', category: 'document' },
  'application/vnd.ms-excel': { label: 'XLS', category: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'XLSX', category: 'document' },
  'text/plain': { label: 'TXT', category: 'document' },
  'text/csv': { label: 'CSV', category: 'document' },
  'application/json': { label: 'JSON', category: 'document' },

  'application/zip': { label: 'ZIP', category: 'archive' },
  'application/x-rar-compressed': { label: 'RAR', category: 'archive' },
  'application/x-7z-compressed': { label: '7Z', category: 'archive' },
  'application/gzip': { label: 'GZ', category: 'archive' },
  'application/x-tar': { label: 'TAR', category: 'archive' },
};

// WHY per-category: Distinct colors make it easier to visually scan a mixed set of formats.
const CATEGORY_STYLES: Record<MimeCategory, { pillClass: string; pillActiveClass: string }> = {
  image: {
    pillClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    pillActiveClass: 'bg-blue-600 text-white dark:bg-blue-500',
  },
  video: {
    pillClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    pillActiveClass: 'bg-purple-600 text-white dark:bg-purple-500',
  },
  audio: {
    pillClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    pillActiveClass: 'bg-emerald-600 text-white dark:bg-emerald-500',
  },
  document: {
    pillClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    pillActiveClass: 'bg-amber-600 text-white dark:bg-amber-500',
  },
  archive: {
    pillClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    pillActiveClass: 'bg-gray-700 text-white dark:bg-gray-500',
  },
  other: {
    pillClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    pillActiveClass: 'bg-gray-600 text-white dark:bg-gray-500',
  },
};

/**
 * Get display info for a MIME type.
 *
 * @param mimeType - Full MIME type string (e.g., "image/jpeg")
 * @returns Display info with label, category, and pill colors
 *
 * @example
 * ```ts
 * const info = getMimeDisplayInfo('image/jpeg');
 * // { label: 'JPEG', category: 'image', pillClass: '...', pillActiveClass: '...' }
 * ```
 */
export function getMimeDisplayInfo(mimeType: string): MimeDisplayInfo {
  const known = MIME_LABEL_MAP[mimeType.toLowerCase()];

  if (known) {
    const styles = CATEGORY_STYLES[known.category];
    return { ...known, ...styles };
  }

  // Fallback: derive label and category from MIME string
  const [major, sub] = mimeType.split('/');
  const category: MimeCategory =
    major === 'image' ? 'image' :
    major === 'video' ? 'video' :
    major === 'audio' ? 'audio' :
    major === 'application' ? 'document' :
    'other';

  // Derive short label from subtype (e.g., "x-raw" → "RAW", "octet-stream" → "BIN")
  const label = (sub || mimeType)
    .replace(/^x-/, '')
    .replace(/^vnd\./, '')
    .split(/[.+]/)
    .pop()
    ?.toUpperCase() || mimeType.toUpperCase();

  const styles = CATEGORY_STYLES[category];
  return { label, category, ...styles };
}

/**
 * Format a large number as a compact string (e.g., 5432 → "5.4K").
 *
 * @param n - The number to format
 * @returns Compact string representation
 */
export function compactNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1000000) return Math.round(n / 1000) + 'K';
  return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// WHY deterministic: Same tag always gets the same color across sessions,
// so users build visual memory of which color means which tag.
// Matches File Types pill style: soft bg + colored text (no solid/inverted active state).
const TAG_COLORS = [
  'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
  'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300',
  'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
  'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
];

/**
 * Get a deterministic color for a tag based on its name hash.
 *
 * @param tagName - The tag name
 * @returns Object with bg, text, and active class strings
 */
export function getTagColor(tagName: string): string {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash + tagName.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
