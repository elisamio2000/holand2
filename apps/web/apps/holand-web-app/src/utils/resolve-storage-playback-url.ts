// ============================================
// JWT-safe playback URL for browser media elements
// ============================================

import { chatService } from '@/services/chat.service';
import { storageService } from '@/services/storage.service';

export type StoragePlaybackStrategy = 'blob-first' | 'presigned-first';

export interface ResolveStoragePlaybackUrlResult {
  /** Playable src — blob: URL or presigned http(s) URL */
  url: string;
  /** When true, caller must revoke url on cleanup */
  revokeOnCleanup: boolean;
}

/**
 * Resolve a browser-playable URL for a storage artifact.
 * WaveSurfer cannot send Bearer tokens; presigned MinIO URLs may fail CORS —
 * blob-first is the reliable default for audio waveforms.
 */
export async function resolveStoragePlaybackUrl(
  artifactId: string,
  strategy: StoragePlaybackStrategy = 'blob-first'
): Promise<ResolveStoragePlaybackUrlResult> {
  const tryBlob = async (): Promise<ResolveStoragePlaybackUrlResult> => {
    const blob = await storageService.fetchArtifactBlob(artifactId, 'inline');
    return { url: URL.createObjectURL(blob), revokeOnCleanup: true };
  };

  const tryPresigned = async (): Promise<ResolveStoragePlaybackUrlResult> => {
    const presigned = await chatService.getPresignedUrl(artifactId);
    return { url: presigned.url, revokeOnCleanup: false };
  };

  const attempts =
    strategy === 'blob-first' ? [tryBlob, tryPresigned] : [tryPresigned, tryBlob];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('playback_url_unavailable');
}
