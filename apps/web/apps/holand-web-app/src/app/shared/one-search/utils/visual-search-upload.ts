// ============================================
// One Search — upload image for visual search
// Uses the same POST /upload path as AI Chat (not /storage/upload).
// ============================================

import { chatService } from '@/services/chat.service';
import type { OneSearchHit, OneSearchQueryImage } from '@/types/one-search.types';
import { artifactIdFromHit } from '@/utils/storage-artifact-media';

const VISUAL_SEARCH_SESSION_PREFIX = 'one-search-visual';

function visualSearchSessionId(): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}`;
  return `${VISUAL_SEARCH_SESSION_PREFIX}-${id}`;
}

function artifactPathFromHit(meta?: Record<string, unknown>): string | undefined {
  if (!meta) return undefined;
  const storagePath = meta.storage_path;
  if (typeof storagePath === 'string' && storagePath.length > 0) return storagePath;
  const path = meta.path;
  if (typeof path === 'string' && path.length > 0) return path;
  return undefined;
}

/**
 * Upload a local image via POST /upload (AI Chat path) and build query_image for smart_search.
 */
export async function uploadImageForVisualSearch(file: File): Promise<OneSearchQueryImage> {
  const sessionId = visualSearchSessionId();
  const artifact = await chatService.smartUpload(file, sessionId);

  const artifactId = artifact.id?.trim();
  if (!artifactId) {
    throw new Error('Image upload succeeded but artifact id is missing');
  }

  const path = artifact.path?.trim();
  return {
    artifact_id: artifactId,
    ...(path ? { path } : {}),
    ephemeral: true,
  };
}

/** Build query_image from a search hit (Lens crop on existing storage artifact). */
export function queryImageFromHit(
  hit: OneSearchHit,
  crop?: OneSearchQueryImage['crop']
): OneSearchQueryImage | null {
  const artifactId = artifactIdFromHit(hit.meta);
  if (!artifactId) return null;

  const path = artifactPathFromHit(hit.meta);

  return {
    artifact_id: artifactId,
    ...(path ? { path } : {}),
    ...(crop ? { crop } : {}),
  };
}

/** Parse optional visual search deep link: ?visualArtifact=uuid&crop=x,y,w,h */
export function parseVisualSearchFromUrl(
  visualArtifact: string | null,
  cropParam: string | null
): OneSearchQueryImage | null {
  const artifactId = visualArtifact?.trim();
  if (!artifactId) return null;

  const queryImage: OneSearchQueryImage = { artifact_id: artifactId };

  if (cropParam?.trim()) {
    const parts = cropParam.split(',').map((n) => Number(n.trim()));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      queryImage.crop = {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
      };
    }
  }

  return queryImage;
}
