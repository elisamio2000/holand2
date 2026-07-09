import { describe, expect, it } from 'vitest';
import {
  formatHitScore,
  hasNoVisualMatches,
  hitMatchType,
  isQueryImageSelf,
  sortHitsByScore,
} from '../hit-match-meta';
import type { OneSearchHit } from '@/types/one-search.types';

describe('hit-match-meta', () => {
  it('detects match types from meta.match', () => {
    expect(hitMatchType({ id: '1', title: 'a', meta: { match: 'metadata' } })).toBe('metadata');
    expect(hitMatchType({ id: '2', title: 'b', meta: { match: 'visual' } })).toBe('visual');
    expect(hitMatchType({ id: '3', title: 'c' })).toBe('unknown');
  });

  it('formats small visual scores with extra precision', () => {
    expect(formatHitScore(0.016393)).toBe('0.0164');
    expect(formatHitScore(0.94)).toBe('0.94');
    expect(formatHitScore(undefined)).toBeNull();
  });

  it('detects no_visual_matches degradation', () => {
    expect(
      hasNoVisualMatches({
        plugin_smart_search_image_by_example: 'no_visual_matches',
      })
    ).toBe(true);
    expect(hasNoVisualMatches({ plugin_smart_search_text: 'binding' })).toBe(false);
  });

  it('detects query image self-match by artifact_id', () => {
    const hit: OneSearchHit = {
      id: 'fm-1',
      title: 'img.png',
      meta: { artifact_id: 'abc-123' },
    };
    expect(isQueryImageSelf(hit, 'abc-123')).toBe(true);
    expect(isQueryImageSelf(hit, 'other')).toBe(false);
  });

  it('sorts hits by score descending', () => {
    const hits: OneSearchHit[] = [
      { id: '1', title: 'a', score: 0.1 },
      { id: '2', title: 'b', score: 0.9 },
      { id: '3', title: 'c' },
    ];
    const sorted = sortHitsByScore(hits);
    expect(sorted.map((h) => h.id)).toEqual(['2', '1', '3']);
  });
});
