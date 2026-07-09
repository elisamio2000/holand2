import { getFileCategory } from '@/utils/mime-utils';
import type { StoragePlaybackStrategy } from '@/utils/resolve-storage-playback-url';

/** Below this size, blob download is acceptable for video preview. */
export const VIDEO_BLOB_THRESHOLD_BYTES = 10 * 1024 * 1024;

/**
 * Resolve playback URL strategy by media type.
 * Audio/WaveSurfer: blob-first (JWT). Video: presigned-first (Range streaming).
 */
export function getPlaybackStrategy(
  mimeType?: string | null,
  filename?: string,
  fileSizeBytes?: number | null
): StoragePlaybackStrategy {
  const category = getFileCategory(mimeType, filename);
  if (category === 'video') {
    if (fileSizeBytes != null && fileSizeBytes < VIDEO_BLOB_THRESHOLD_BYTES) {
      return 'blob-first';
    }
    return 'presigned-first';
  }
  return 'blob-first';
}
