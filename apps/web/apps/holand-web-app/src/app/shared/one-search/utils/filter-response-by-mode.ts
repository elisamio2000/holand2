// ============================================
// One Search — mode filter (shared mock + real)
// ============================================

import type {
  OneSearchHit,
  OneSearchLaneResult,
  OneSearchMode,
  OneSearchProviderId,
  OneSearchResponse,
} from '@/types/one-search.types';
import { getOneSearchVisibleLaneIds } from '../config/search-config';
import { inferHitMediaType, inferHitMime } from './normalize-search-hits';

function isImageHit(hit: OneSearchHit, lane: OneSearchLaneResult['lane']): boolean {
  if (lane === 'graph') return true;
  const mime = inferHitMime(hit);
  const mediaType = inferHitMediaType(hit);
  return mime.startsWith('image/') || mediaType === 'image';
}

function isAudioHit(hit: OneSearchHit): boolean {
  const mime = inferHitMime(hit);
  const mediaType = inferHitMediaType(hit);
  const title = String(hit.title).toLowerCase();
  return mime.includes('audio') || mediaType === 'audio' || title.includes('voice');
}

function isVideoHit(hit: OneSearchHit): boolean {
  const mime = inferHitMime(hit);
  const mediaType = inferHitMediaType(hit);
  return mime.startsWith('video/') || mediaType === 'video';
}

function isDocumentFileHit(
  hit: OneSearchHit,
  lane: OneSearchLaneResult['lane'],
  query: string
): boolean {
  if (lane !== 'files' && lane !== 'storage') return false;
  const q = query.trim().toLowerCase();
  const title = hit.title.toLowerCase();
  if (q) {
    if (title.includes(q)) return true;
    // Allow matching without extension (bug.png vs bug)
    const qBase = q.replace(/\.[a-z0-9]+$/i, '');
    if (qBase.length >= 3 && title.includes(qBase)) return true;
  }
  if (lane === 'files') return true;
  const mediaType = inferHitMediaType(hit);
  return mediaType !== 'image' && mediaType !== 'audio' && mediaType !== 'video';
}

function isTextModeHit(hit: OneSearchHit, lane: OneSearchLaneResult['lane']): boolean {
  if (lane === 'chat' || lane === 'cases' || lane === 'users') return true;
  if (lane === 'graph') return true;
  if (lane === 'files') return true;
  if (isImageHit(hit, lane) || isAudioHit(hit) || isVideoHit(hit)) return false;
  return isDocumentFileHit(hit, lane, '');
}

function filterLaneHits(
  lanes: OneSearchLaneResult[],
  mode: OneSearchMode,
  query: string
): OneSearchLaneResult[] {
  if (mode === 'all') return lanes;

  return lanes.map((L) => ({
    ...L,
    hits: L.hits.filter((h) => {
      if (mode === 'text') return isTextModeHit(h, L.lane);
      if (mode === 'image') return isImageHit(h, L.lane);
      if (mode === 'audio') return isAudioHit(h);
      if (mode === 'video') return isVideoHit(h);
      if (mode === 'file') return isDocumentFileHit(h, L.lane, query);
      return true;
    }),
    total: undefined,
  }));
}

export function filterResponseByMode(
  response: OneSearchResponse,
  mode: OneSearchMode,
  options?: { trustServerMode?: boolean }
): OneSearchResponse {
  if (options?.trustServerMode && mode !== 'all') {
    const totalHits = response.lanes.reduce((sum, L) => sum + L.hits.length, 0);
    return {
      ...response,
      mode,
      total: typeof response.total === 'number' ? response.total : totalHits,
    };
  }

  const filtered = filterLaneHits(response.lanes, mode, response.query.trim());
  const totalHits = filtered.reduce((sum, L) => sum + L.hits.length, 0);
  return {
    ...response,
    mode,
    total: totalHits,
    lanes: filtered.map((L) => ({
      ...L,
      total: L.total ?? L.hits.length,
    })),
    facets: {
      ...response.facets,
      byLane: Object.fromEntries(filtered.map((L) => [L.lane, L.hits.length])) as Record<
        string,
        number
      >,
    },
  };
}

export function emptyLaneResults(providerId?: OneSearchProviderId): OneSearchLaneResult[] {
  const lanes =
    providerId !== undefined
      ? getOneSearchVisibleLaneIds(providerId)
      : getOneSearchVisibleLaneIds('mock');
  return lanes.map((lane) => ({ lane, hits: [], total: 0 }));
}

export function mergeLaneHits(
  base: OneSearchLaneResult[],
  lane: OneSearchLaneResult['lane'],
  hits: OneSearchLaneResult['hits']
): OneSearchLaneResult[] {
  return base.map((L) =>
    L.lane === lane ? { lane, hits, total: hits.length } : L
  );
}
