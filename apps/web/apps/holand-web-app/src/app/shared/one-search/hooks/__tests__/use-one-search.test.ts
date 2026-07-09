// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOneSearch } from '../use-one-search';

const searchMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/hooks/use-page-visible', () => ({
  usePageVisible: () => true,
}));

vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock('@/app/shared/one-search/config/search-config', () => ({
  getOneSearchCacheStaleMs: () => 45_000,
  getOneSearchDebounceMs: () => 0,
  getOneSearchScoreDebounceMs: () => 0,
  getOneSearchProviderId: () => 'mock',
  getOneSearchSmartFallbackMode: () => 'off',
}));

vi.mock('@/services/one-search.service', () => ({
  oneSearchService: {
    search: (...args: unknown[]) => searchMock(...args),
  },
}));

describe('useOneSearch', () => {
  beforeEach(() => {
    searchMock.mockReset();
    searchMock.mockResolvedValue({
      response: { lanes: [], facets: {} },
      meta: { providerId: 'mock', tookMs: 10, calls: [], hasRealLanes: false, hasMockLanes: true },
    });
  });

  it('skips search when query and image are empty', async () => {
    renderHook(() => useOneSearch({ query: '', mode: 'all' }));
    await waitFor(() => expect(searchMock).not.toHaveBeenCalled());
  });

  it('searches when query is set', async () => {
    renderHook(() => useOneSearch({ query: 'hello', mode: 'text', providerId: 'mock' }));
    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(searchMock.mock.calls[0][0]).toMatchObject({ query: 'hello', mode: 'text' });
  });

  it('uses stable queryImage key without duplicate searches on same artifact', async () => {
    const image = { artifact_id: 'art-1' };
    const { rerender } = renderHook(
      (props) => useOneSearch(props),
      { initialProps: { query: '', mode: 'image' as const, queryImage: image, providerId: 'mock' as const } }
    );
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));

    rerender({ query: '', mode: 'image', queryImage: { ...image }, providerId: 'mock' });
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
  });

  it('surfaces rate limit meta', async () => {
    searchMock.mockResolvedValueOnce({
      response: { lanes: [], facets: {} },
      meta: {
        providerId: 'smart-search',
        tookMs: 10,
        calls: [],
        hasRealLanes: true,
        hasMockLanes: false,
        rateLimited: true,
      },
    });

    const { result } = renderHook(() =>
      useOneSearch({ query: 'test', mode: 'all', providerId: 'smart-search' })
    );
    await waitFor(() => expect(result.current.rateLimited).toBe(true));
  });
});
