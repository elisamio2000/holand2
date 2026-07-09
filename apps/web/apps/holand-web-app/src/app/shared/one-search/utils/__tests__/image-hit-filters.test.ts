import { describe, expect, it } from 'vitest';
import type { OneSearchHit } from '@/types/one-search.types';
import {
  collectImageMimeTypes,
  filterMediaHits,
  sortMediaHits,
} from '../image-hit-filters';

function hit(
  id: string,
  overrides: Partial<OneSearchHit> & { meta?: Record<string, unknown> } = {}
): OneSearchHit {
  return {
    id,
    title: id,
    score: 0.5,
    occurredAt: '2026-06-01T00:00:00.000Z',
    meta: {},
    ...overrides,
  };
}

describe('image-hit-filters', () => {
  it('filters by mime and client min score', () => {
    const hits = [
      hit('a', { score: 0.9, meta: { mime: 'image/png' } }),
      hit('b', { score: 0.2, meta: { mime: 'image/jpeg' } }),
      hit('c', { score: 0.8, meta: { mime: 'image/jpeg' } }),
    ];

    const filtered = filterMediaHits(hits, {
      mimeTypes: ['image/jpeg'],
      dateRange: 'any',
      clientMinScore: 0.5,
    });

    expect(filtered.map((h) => h.id)).toEqual(['c']);
  });

  it('sorts by size descending', () => {
    const hits = [
      hit('small', { meta: { size_bytes: 100 } }),
      hit('large', { meta: { size_bytes: 9000 } }),
      hit('mid', { meta: { size_bytes: 500 } }),
    ];

    const sorted = sortMediaHits(hits, 'size_desc');
    expect(sorted.map((h) => h.id)).toEqual(['large', 'mid', 'small']);
  });

  it('collects image mime types', () => {
    const hits = [
      hit('a', { meta: { mime: 'image/png' } }),
      hit('b', { meta: { mime: 'image/jpeg' } }),
      hit('c', { meta: { mime: 'application/pdf' } }),
    ];
    expect(collectImageMimeTypes(hits)).toEqual(['image/jpeg', 'image/png']);
  });
});
