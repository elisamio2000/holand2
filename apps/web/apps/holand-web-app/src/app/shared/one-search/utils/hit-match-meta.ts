// ============================================
// One Search — hit match type and score helpers for visual search UI
// ============================================

import type { OneSearchHit } from '@/types/one-search.types';
import { isQueryArtifactHit } from './exclude-query-artifact-hits';

export type HitMatchType = 'visual' | 'metadata' | 'filename' | 'unknown';

export function hitMatchType(hit: OneSearchHit): HitMatchType {
  const raw = String(hit.meta?.match ?? '').trim().toLowerCase();
  if (raw === 'visual') return 'visual';
  if (raw === 'metadata') return 'metadata';
  if (raw === 'filename') return 'filename';
  return 'unknown';
}

export function formatHitScore(score?: number): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 0.1) return score.toFixed(2);
  return score.toFixed(4);
}

export function matchTypeI18nKey(match: HitMatchType): string {
  switch (match) {
    case 'visual':
      return 'searchHub.matchTypeVisual';
    case 'metadata':
      return 'searchHub.matchTypeMetadata';
    case 'filename':
      return 'searchHub.matchTypeFilename';
    default:
      return 'searchHub.matchTypeUnknown';
  }
}

export type MatchBadgeColor = 'success' | 'secondary' | 'info' | 'warning';

export function matchTypeBadgeColor(match: HitMatchType): MatchBadgeColor {
  switch (match) {
    case 'visual':
      return 'success';
    case 'metadata':
      return 'secondary';
    case 'filename':
      return 'info';
    default:
      return 'warning';
  }
}

/** True when smart_search image-by-example lane returned no visual matches. */
export function hasNoVisualMatches(
  degradedSources?: Record<string, string>
): boolean {
  if (!degradedSources) return false;
  return Object.entries(degradedSources).some(
    ([key, value]) =>
      key.includes('image_by_example') && value === 'no_visual_matches'
  );
}

export function isQueryImageSelf(
  hit: OneSearchHit,
  queryImageEcho?: string
): boolean {
  return isQueryArtifactHit(hit, undefined, queryImageEcho);
}

export { isQueryArtifactHit } from './exclude-query-artifact-hits';

export function sortHitsByScore(hits: OneSearchHit[]): OneSearchHit[] {
  return [...hits].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
