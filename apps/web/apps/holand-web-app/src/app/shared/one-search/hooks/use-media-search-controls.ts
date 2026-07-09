'use client';

import { useCallback, useMemo, useState } from 'react';
import { ONE_SEARCH_DEFAULT_LIMIT } from '@/app/shared/one-search/config/search-config';
import {
  type MediaHitFilterState,
  type MediaSortField,
  DEFAULT_MEDIA_FILTERS,
} from '@/app/shared/one-search/utils/image-hit-filters';
import type { OneSearchRequest } from '@/types/one-search.types';

export interface UseMediaSearchControlsResult {
  sort: MediaSortField;
  setSort: (sort: MediaSortField) => void;
  filters: MediaHitFilterState;
  setFilters: (filters: MediaHitFilterState) => void;
  offset: number;
  limit: number;
  loadMore: () => void;
  resetPagination: () => void;
  toSearchRequestPatch: () => Pick<
    OneSearchRequest,
    'sort' | 'filters' | 'pagination' | 'mediaFilters'
  >;
}

export function useMediaSearchControls(
  limit = ONE_SEARCH_DEFAULT_LIMIT
): UseMediaSearchControlsResult {
  const [sort, setSortState] = useState<MediaSortField>('relevance');
  const [filters, setFiltersState] = useState<MediaHitFilterState>(DEFAULT_MEDIA_FILTERS);
  const [offset, setOffset] = useState(0);

  const setSort = useCallback((next: MediaSortField) => {
    setSortState(next);
    setOffset(0);
  }, []);

  const setFilters = useCallback((next: MediaHitFilterState) => {
    setFiltersState(next);
    setOffset(0);
  }, []);

  const loadMore = useCallback(() => {
    setOffset((o) => o + limit);
  }, [limit]);

  const resetPagination = useCallback(() => setOffset(0), []);

  const toSearchRequestPatch = useCallback((): Pick<
    OneSearchRequest,
    'sort' | 'filters' | 'pagination' | 'mediaFilters'
  > => {
    const serverSort =
      sort === 'duration_desc' || sort === 'duration_asc'
        ? sort
        : sort === 'size_desc' || sort === 'size_asc'
          ? sort
          : sort;

    return {
      sort: serverSort as OneSearchRequest['sort'],
      filters: {
        fileTypes: filters.mimeTypes.length > 0 ? filters.mimeTypes : undefined,
        dateFrom:
          filters.dateRange === 'any'
            ? undefined
            : undefined /* date_range sent via mediaFilters */,
      },
      mediaFilters: {
        mimeTypes: filters.mimeTypes.length ? filters.mimeTypes : undefined,
        durationMinSec: filters.minDurationSec,
        durationMaxSec: filters.maxDurationSec,
        hasTranscript: filters.hasTranscriptOnly || undefined,
        matchKinds: filters.matchKinds?.length ? filters.matchKinds : undefined,
        uploadedBy: filters.uploadedBy,
        dateRange: filters.dateRange !== 'any' ? filters.dateRange : undefined,
        minSizeBytes: filters.minSizeBytes,
        maxSizeBytes: filters.maxSizeBytes,
      },
      pagination: { offset, limit },
    };
  }, [sort, filters, offset, limit]);

  return useMemo(
    () => ({
      sort,
      setSort,
      filters,
      setFilters,
      offset,
      limit,
      loadMore,
      resetPagination,
      toSearchRequestPatch,
    }),
    [
      sort,
      setSort,
      filters,
      setFilters,
      offset,
      limit,
      loadMore,
      resetPagination,
      toSearchRequestPatch,
    ]
  );
}
