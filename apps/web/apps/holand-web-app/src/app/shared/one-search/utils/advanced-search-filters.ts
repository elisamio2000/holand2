// ============================================
// One Search — advanced sidebar → request + client filter
// ============================================

import type { OneSearchLaneId, OneSearchRequest, OneSearchResponse } from '@/types/one-search.types';
import type { AdvancedSearchFilters } from '../components/advanced-sidebar';
import { hitOccurredAtMs } from './image-hit-filters';
import { inferHitMediaType, inferHitMime } from './normalize-search-hits';

export const DEFAULT_ADVANCED_FILTERS: AdvancedSearchFilters = {
  lanes: [],
  dateRange: 'any',
  fileTypes: [],
  languages: [],
  sortBy: 'relevance',
  includeArchived: false,
};

function dateRangeStart(range: AdvancedSearchFilters['dateRange']): string | undefined {
  if (range === 'any') return undefined;
  const now = Date.now();
  const day = 86_400_000;
  let start = now;
  switch (range) {
    case 'today':
      start = now - day;
      break;
    case 'week':
      start = now - 7 * day;
      break;
    case 'month':
      start = now - 30 * day;
      break;
    case 'year':
      start = now - 365 * day;
      break;
    default:
      return undefined;
  }
  return new Date(start).toISOString();
}

/** Map sidebar state to OneSearchRequest fields (API-ready). */
export function advancedFiltersToRequest(
  filters: AdvancedSearchFilters
): Pick<OneSearchRequest, 'filters' | 'sort' | 'scoreThreshold'> {
  const sort =
    filters.sortBy === 'score_desc'
      ? 'relevance'
      : filters.sortBy === 'date_desc' || filters.sortBy === 'date_asc'
        ? filters.sortBy
        : 'relevance';

  return {
    filters: {
      lanes: filters.lanes.length > 0 ? filters.lanes : undefined,
      dateFrom: dateRangeStart(filters.dateRange),
      fileTypes: filters.fileTypes.length > 0 ? filters.fileTypes : undefined,
      languages: filters.languages.length > 0 ? filters.languages : undefined,
    },
    sort,
    scoreThreshold: filters.minScore,
  };
}

function hitMatchesFileType(hit: OneSearchResponse['lanes'][0]['hits'][0], fileType: string): boolean {
  const mime = inferHitMime(hit).toLowerCase();
  const mediaType = inferHitMediaType(hit);
  const ft = fileType.toLowerCase();
  if (ft === 'image') return mime.startsWith('image/') || mediaType === 'image';
  if (ft === 'video') return mime.startsWith('video/') || mediaType === 'video';
  if (ft === 'audio') return mime.includes('audio') || mediaType === 'audio';
  if (ft === 'document') {
    return (
      mime.includes('pdf') ||
      mime.includes('word') ||
      mime.includes('text') ||
      mime.includes('sheet') ||
      mediaType === 'document'
    );
  }
  return mime.includes(ft) || hit.title.toLowerCase().endsWith(`.${ft}`);
}

function hitMatchesLanguage(hit: OneSearchResponse['lanes'][0]['hits'][0], lang: string): boolean {
  const code = lang.toLowerCase();
  const metaLang = String(hit.meta?.language ?? hit.meta?.lang ?? '').toLowerCase();
  if (metaLang && metaLang.startsWith(code)) return true;
  const title = hit.title;
  if (code === 'fa' && /[\u0600-\u06FF]/.test(title)) return true;
  if (code === 'en' && /[a-z]/i.test(title)) return true;
  return false;
}

function sortHits(
  hits: OneSearchResponse['lanes'][0]['hits'],
  sortBy: AdvancedSearchFilters['sortBy']
): OneSearchResponse['lanes'][0]['hits'] {
  const copy = [...hits];
  switch (sortBy) {
    case 'date_desc':
      return copy.sort((a, b) => hitOccurredAtMs(b) - hitOccurredAtMs(a));
    case 'date_asc':
      return copy.sort((a, b) => hitOccurredAtMs(a) - hitOccurredAtMs(b));
    case 'score_desc':
      return copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    default:
      return copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}

/** Client-side filter until BE honors args.filters / args.sort. */
export function applyAdvancedFiltersToResponse(
  response: OneSearchResponse,
  filters: AdvancedSearchFilters
): OneSearchResponse {
  const rangeStart = dateRangeStart(filters.dateRange);
  const rangeMs = rangeStart ? new Date(rangeStart).getTime() : null;

  let lanes = response.lanes.map((lane) => {
    if (filters.lanes.length > 0 && !filters.lanes.includes(lane.lane as OneSearchLaneId)) {
      return { ...lane, hits: [], total: 0 };
    }

    let hits = lane.hits.filter((hit) => {
      if (filters.minScore != null && (hit.score ?? 0) < filters.minScore) return false;

      if (rangeMs != null) {
        const occurred = hitOccurredAtMs(hit);
        if (occurred > 0 && occurred < rangeMs) return false;
      }

      if (filters.fileTypes.length > 0) {
        if (!filters.fileTypes.some((ft) => hitMatchesFileType(hit, ft))) return false;
      }

      if (filters.languages.length > 0) {
        if (!filters.languages.some((lang) => hitMatchesLanguage(hit, lang))) return false;
      }

      if (filters.includeArchived === false && hit.meta?.archived === true) return false;

      return true;
    });

    hits = sortHits(hits, filters.sortBy);
    return { ...lane, hits, total: hits.length };
  });

  const totalHits = lanes.reduce((sum, L) => sum + L.hits.length, 0);

  return {
    ...response,
    total: totalHits,
    lanes,
    facets: {
      ...response.facets,
      byLane: Object.fromEntries(lanes.map((L) => [L.lane, L.hits.length])) as Record<string, number>,
    },
  };
}

/** Whether any advanced filter is active (for dev-only client-side note). */
export function hasActiveAdvancedFilters(filters: AdvancedSearchFilters): boolean {
  return (
    filters.lanes.length > 0 ||
    filters.dateRange !== 'any' ||
    filters.fileTypes.length > 0 ||
    filters.languages.length > 0 ||
    filters.sortBy !== 'relevance' ||
    filters.minScore != null ||
    filters.includeArchived === true
  );
}
