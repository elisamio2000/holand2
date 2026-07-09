import { describe, expect, it } from 'vitest';
import { shouldSupplementSmartSearch } from '../supplement-smart-search-hits';
import type { OneSearchResponse } from '@/types/one-search.types';
import { emptyLaneResults } from '../filter-response-by-mode';

function baseResponse(): OneSearchResponse {
  return {
    query: 'screen',
    mode: 'all',
    lanes: emptyLaneResults(),
    total: 0,
  };
}

describe('shouldSupplementSmartSearch', () => {
  it('returns false without text query', () => {
    expect(shouldSupplementSmartSearch(baseResponse(), { query: '' })).toBe(false);
  });

  it('returns false when queryImage is set', () => {
    expect(
      shouldSupplementSmartSearch(baseResponse(), {
        query: '',
        queryImage: { artifact_id: 'uuid' },
      })
    ).toBe(false);
  });

  it('returns false for image/audio/video modes', () => {
    expect(
      shouldSupplementSmartSearch(baseResponse(), { query: 'x', mode: 'image' })
    ).toBe(false);
  });

  it('returns true for file mode even when files lane has hits', () => {
    const response: OneSearchResponse = {
      ...baseResponse(),
      lanes: emptyLaneResults().map((l) =>
        l.lane === 'files' ? { ...l, hits: [{ id: '1', title: 'a.png' }], total: 1 } : l
      ),
    };
    expect(shouldSupplementSmartSearch(response, { query: 'screen', mode: 'file' })).toBe(true);
  });

  it('returns false when files lane already has enough hits in all mode', () => {
    const response: OneSearchResponse = {
      ...baseResponse(),
      lanes: emptyLaneResults().map((l) =>
        l.lane === 'files'
          ? {
              ...l,
              hits: [
                { id: '1', title: 'a' },
                { id: '2', title: 'b' },
                { id: '3', title: 'c' },
              ],
              total: 3,
            }
          : l
      ),
    };
    expect(shouldSupplementSmartSearch(response, { query: 'screen', mode: 'all' })).toBe(false);
  });
});
