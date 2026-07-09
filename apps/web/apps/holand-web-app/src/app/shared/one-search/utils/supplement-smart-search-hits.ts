// ============================================
// One Search — merge file_manager.list into smart_search gaps
// ============================================

import {
  FM_ENDPOINT,
  FM_TOOL,
  mapArtifactsToHits,
} from '@/app/shared/one-search/mappers/file-manager-to-hit';
import { filterResponseByMode } from '@/app/shared/one-search/utils/filter-response-by-mode';
import { storageService } from '@/services/storage.service';
import type { Artifact } from '@/types/storage.types';
import type {
  OneSearchHit,
  OneSearchLaneId,
  OneSearchMode,
  OneSearchRequest,
  OneSearchResponse,
} from '@/types/one-search.types';
import { ONE_SEARCH_DEFAULT_LIMIT, ONE_SEARCH_SOURCE_TIMEOUT_MS } from '../config/search-config';
import { fileManagerArgsForMode } from './file-manager-search-args';

function filterArtifactsByMode(items: Artifact[], mode: OneSearchMode): Artifact[] {
  if (mode === 'all' || mode === 'file' || mode === 'text') return items;
  return items.filter((a) => {
    const mime = (a.mime_type || '').toLowerCase();
    if (mode === 'image') return mime.startsWith('image/') || a.media_type === 'image';
    if (mode === 'audio') return mime.startsWith('audio/') || a.media_type === 'audio';
    if (mode === 'video') return mime.startsWith('video/') || a.media_type === 'video';
    return true;
  });
}

function hitDedupeKey(hit: OneSearchHit): string {
  const artifactId = hit.meta?.artifact_id;
  if (typeof artifactId === 'string' && artifactId.length > 0) return `artifact:${artifactId}`;
  return hit.id;
}

function mergeLaneHits(
  lanes: OneSearchResponse['lanes'],
  lane: OneSearchLaneId,
  incoming: OneSearchHit[]
): OneSearchResponse['lanes'] {
  if (incoming.length === 0) return lanes;
  const seen = new Set<string>();
  for (const block of lanes) {
    for (const hit of block.hits) seen.add(hitDedupeKey(hit));
  }
  const toAdd = incoming.filter((hit) => {
    const key = hitDedupeKey(hit);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (toAdd.length === 0) return lanes;

  return lanes.map((block) =>
    block.lane === lane
      ? {
          ...block,
          hits: [...block.hits, ...toAdd],
          total: (block.total ?? block.hits.length) + toAdd.length,
        }
      : block
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    }),
  ]);
}

const FILES_SUPPLEMENT_THRESHOLD = 3;

/** Whether file_manager.list supplement should run after smart_search. */
export function shouldSupplementSmartSearch(
  response: OneSearchResponse,
  request: OneSearchRequest
): boolean {
  const query = request.query.trim();
  if (!query) return false;
  if (request.queryImage?.artifact_id) return false;

  const mode = request.mode ?? 'all';
  if (mode === 'image' || mode === 'audio' || mode === 'video') return false;

  if (mode === 'file') return true;

  const filesLane = response.lanes.find((l) => l.lane === 'files');
  const filesTotal = filesLane?.total ?? filesLane?.hits.length ?? 0;
  if (filesTotal >= FILES_SUPPLEMENT_THRESHOLD) return false;

  return true;
}

/** Fill files/storage lanes from file_manager.list when smart_search misses filename matches. */
export async function supplementSmartSearchWithFileManager(
  response: OneSearchResponse,
  request: OneSearchRequest
): Promise<OneSearchResponse> {
  const query = request.query.trim();
  const mode = request.mode ?? 'all';
  const limit = request.pagination?.limit ?? ONE_SEARCH_DEFAULT_LIMIT;

  if (!shouldSupplementSmartSearch(response, request)) return response;

  const fmArgs = fileManagerArgsForMode(query, mode, limit, { minPageSize: 20 });
  try {
    const res = await withTimeout(
      storageService.listFilesForExplorer(fmArgs),
      ONE_SEARCH_SOURCE_TIMEOUT_MS,
      'file_manager_supplement'
    );
    const filtered = filterArtifactsByMode(res.items, mode);
    const { files, storage } = mapArtifactsToHits(filtered, query, {
      ...fmArgs,
      source: FM_TOOL,
      sourceEndpoint: FM_ENDPOINT,
    });

    let lanes = response.lanes;
    lanes = mergeLaneHits(lanes, 'files', files);
    lanes = mergeLaneHits(lanes, 'storage', storage);

    const total = lanes.reduce((sum, lane) => sum + lane.hits.length, 0);
    const merged: OneSearchResponse = {
      ...response,
      total,
      lanes,
      facets: {
        ...response.facets,
        byLane: Object.fromEntries(lanes.map((l) => [l.lane, l.hits.length])) as Record<
          string,
          number
        >,
      },
    };

    return filterResponseByMode(merged, mode, { trustServerMode: false });
  } catch {
    return response;
  }
}
