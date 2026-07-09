// ============================================
// One Search — client-side media hit sort & filter
// ============================================

import { OneSearchHit } from '@/types/one-search.types';
import { MediaMatchKind, hitDurationSec, hitMatchKind } from './media-hit-meta';
import { sortHitsByScore } from './hit-match-meta';


export type ImageSortField =
  | 'relevance'
  | 'date_desc'
  | 'date_asc'
  | 'size_desc'
  | 'size_asc';

export type MediaSortField =
  | ImageSortField
  | 'duration_desc'
  | 'duration_asc';

export type ImageDateRange = 'any' | 'today' | 'week' | 'month' | 'year';

/** Shared filter shape for image / video / audio toolbars. */
export interface MediaHitFilterState {
  mimeTypes: string[];
  dateRange: ImageDateRange;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  hasTranscriptOnly?: boolean;
  matchKinds?: MediaMatchKind[];
  uploadedBy?: string;
  /** Client-side score floor (backend uses scoreThreshold separately). */
  clientMinScore?: number;
}

export const DEFAULT_MEDIA_FILTERS: MediaHitFilterState = {
  mimeTypes: [],
  dateRange: 'any',
};

export function hitOccurredAtMs(hit: OneSearchHit): number {
  if (!hit.occurredAt) return 0;
  const ms = new Date(hit.occurredAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function hitSizeBytes(hit: OneSearchHit): number {
  const raw = Number(hit.meta?.size_bytes ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function hitMimeType(hit: OneSearchHit): string {
  return String(hit.meta?.mime || '').trim().toLowerCase();
}

function dateRangeStart(range: ImageDateRange): number | null {
  if (range === 'any') return null;
  const now = Date.now();
  const day = 86_400_000;
  switch (range) {
    case 'today':
      return now - day;
    case 'week':
      return now - 7 * day;
    case 'month':
      return now - 30 * day;
    case 'year':
      return now - 365 * day;
    default:
      return null;
  }
}

export function filterMediaHits(
  hits: OneSearchHit[],
  filters: MediaHitFilterState
): OneSearchHit[] {
  const rangeStart = dateRangeStart(filters.dateRange);

  return hits.filter((hit) => {
    if (filters.mimeTypes.length > 0) {
      const mime = hitMimeType(hit);
      if (!filters.mimeTypes.includes(mime)) return false;
    }

    if (filters.clientMinScore != null) {
      if ((hit.score ?? 0) < filters.clientMinScore) return false;
    }

    if (rangeStart != null) {
      const occurred = hitOccurredAtMs(hit);
      if (occurred > 0 && occurred < rangeStart) return false;
    }

    const size = hitSizeBytes(hit);
    if (filters.minSizeBytes != null && size > 0 && size < filters.minSizeBytes) {
      return false;
    }
    if (filters.maxSizeBytes != null && size > 0 && size > filters.maxSizeBytes) {
      return false;
    }

    const duration = hitDurationSec(hit);
    if (filters.minDurationSec != null && duration > 0 && duration < filters.minDurationSec) {
      return false;
    }
    if (filters.maxDurationSec != null && duration > 0 && duration > filters.maxDurationSec) {
      return false;
    }

    if (filters.hasTranscriptOnly && !hit.meta?.has_transcript) {
      return false;
    }

    if (filters.matchKinds?.length) {
      if (!filters.matchKinds.includes(hitMatchKind(hit))) return false;
    }

    if (filters.uploadedBy) {
      const uploader = String(hit.meta?.uploaded_by ?? '');
      if (uploader !== filters.uploadedBy) return false;
    }

    return true;
  });
}

export function sortMediaHits(
  hits: OneSearchHit[],
  sort: MediaSortField
): OneSearchHit[] {
  const copy = [...hits];

  switch (sort) {
    case 'relevance':
      return sortHitsByScore(copy);
    case 'date_desc':
      return copy.sort((a, b) => hitOccurredAtMs(b) - hitOccurredAtMs(a));
    case 'date_asc':
      return copy.sort((a, b) => hitOccurredAtMs(a) - hitOccurredAtMs(b));
    case 'size_desc':
      return copy.sort((a, b) => hitSizeBytes(b) - hitSizeBytes(a));
    case 'size_asc':
      return copy.sort((a, b) => hitSizeBytes(a) - hitSizeBytes(b));
    case 'duration_desc':
      return copy.sort((a, b) => hitDurationSec(b) - hitDurationSec(a));
    case 'duration_asc':
      return copy.sort((a, b) => hitDurationSec(a) - hitDurationSec(b));
    default:
      return copy;
  }
}

/** Collect distinct mime types present in hits for filter chips. */
export function collectMimeTypes(hits: OneSearchHit[], prefix?: string): string[] {
  const set = new Set<string>();
  for (const hit of hits) {
    const mime = hitMimeType(hit);
    if (!mime) continue;
    if (!prefix || mime.startsWith(prefix)) set.add(mime);
  }
  return [...set].sort();
}

export function collectImageMimeTypes(hits: OneSearchHit[]): string[] {
  return collectMimeTypes(hits, 'image/');
}

export function collectAudioMimeTypes(hits: OneSearchHit[]): string[] {
  return collectMimeTypes(hits, 'audio/');
}

export function collectVideoMimeTypes(hits: OneSearchHit[]): string[] {
  return collectMimeTypes(hits, 'video/');
}

export function mimeShortLabel(mime: string, mediaKind?: 'image' | 'audio' | 'video'): string {
  const lower = mime.toLowerCase();
  const prefix =
    mediaKind === 'audio' ? 'audio/' : mediaKind === 'video' ? 'video/' : 'image/';
  if (lower.startsWith(prefix)) {
    return lower.slice(prefix.length).toUpperCase() || mime.toUpperCase();
  }
  const slash = lower.indexOf('/');
  return slash >= 0 ? lower.slice(slash + 1).toUpperCase() : mime.toUpperCase();
}

export const filterImageHits = filterMediaHits;
export const sortImageHits = sortMediaHits;
