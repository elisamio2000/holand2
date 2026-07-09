// ============================================
// Exclude the query artifact from search results (FE until BE ships exclude_query)
// ============================================

import type {
  OneSearchHit,
  OneSearchLaneId,
  OneSearchQueryImage,
  OneSearchResponse,
} from '@/types/one-search.types';
import { artifactIdFromHit } from '@/utils/storage-artifact-media';

function pathFromHitMeta(meta?: Record<string, unknown>): string | undefined {
  if (!meta) return undefined;
  for (const key of ['storage_path', 'path'] as const) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** True when hit is the same storage artifact used as query_image. */
export function isQueryArtifactHit(
  hit: OneSearchHit,
  queryImage?: OneSearchQueryImage | null,
  queryImageEcho?: string
): boolean {
  const queryId = queryImage?.artifact_id?.trim() || queryImageEcho?.trim();
  if (!queryId) return false;

  const artifactId = artifactIdFromHit(hit.meta);
  if (artifactId === queryId) return true;
  if (hit.id.trim() === queryId) return true;

  const queryPath = queryImage?.path?.trim();
  if (queryPath) {
    const hitPath = pathFromHitMeta(hit.meta);
    if (hitPath && hitPath === queryPath) return true;
  }

  return false;
}

export function excludeQueryArtifactFromResponse(
  response: OneSearchResponse,
  queryImage?: OneSearchQueryImage | null,
  queryImageEcho?: string
): OneSearchResponse {
  if (!queryImage?.artifact_id?.trim() && !queryImageEcho?.trim()) {
    return response;
  }

  const lanes = response.lanes.map((lane) => {
    const hits = lane.hits.filter(
      (hit) => !isQueryArtifactHit(hit, queryImage, queryImageEcho)
    );
    return {
      ...lane,
      hits,
      total: hits.length,
    };
  });

  const totalHits = lanes.reduce((sum, lane) => sum + lane.hits.length, 0);
  const byLane = response.facets?.byLane
    ? (Object.fromEntries(
        lanes.map((lane) => [lane.lane, lane.hits.length])
      ) as Record<OneSearchLaneId, number>)
    : undefined;

  return {
    ...response,
    lanes,
    total: totalHits,
    facets: response.facets
      ? {
          ...response.facets,
          ...(byLane ? { byLane } : {}),
        }
      : undefined,
  };
}
