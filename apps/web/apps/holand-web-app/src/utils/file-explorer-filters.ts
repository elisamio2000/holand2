// ============================================
// File Explorer — chip → plugin list filter mapping
// OpenAPI media_type: image | video | audio | text | other (no document/pdf/archive)
// ============================================

import type { FileTypeKey } from '@/types/storage.types';

/** MIME types used for the Archive chip filter. */
export const ARCHIVE_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-7z-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-bzip2',
] as const;

export interface FileExplorerListFilter {
  media_type?: string;
  mime_types?: string[];
}

/** Cached filter objects — stable references prevent unnecessary re-renders. */
const FILTER_CACHE: Record<FileTypeKey, FileExplorerListFilter> = {
  all: {},
  image: { media_type: 'image' },
  video: { media_type: 'video' },
  audio: { media_type: 'audio' },
  text: { media_type: 'text' },
  other: { media_type: 'other' },
  pdf: { mime_types: ['application/pdf'] },
  archive: { mime_types: [...ARCHIVE_MIME_TYPES] },
};

/** Map UI chip key to plugin.file_manager.list filter args (stable references). */
export function chipToListFilter(chip: FileTypeKey): FileExplorerListFilter {
  return FILTER_CACHE[chip] ?? FILTER_CACHE.all;
}
