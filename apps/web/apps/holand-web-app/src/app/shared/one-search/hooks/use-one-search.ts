// ============================================

// One Search — data fetching hook

// ============================================



'use client';



import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSession } from 'next-auth/react';

import {

  getOneSearchCacheStaleMs,

  getOneSearchProviderId,

  getOneSearchScoreDebounceMs,

} from '@/app/shared/one-search/config/search-config';

import {

  buildSearchCacheKey,

  isSearchAbortError,

} from '@/app/shared/one-search/utils/search-request-policy';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { usePageVisible } from '@/hooks/use-page-visible';

import { classifyApiError, type ApiErrorCategory } from '@/lib/api-errors';

import { oneSearchService } from '@/services/one-search.service';
import { advancedFiltersToRequest } from '@/app/shared/one-search/utils/advanced-search-filters';
import type { AdvancedSearchFilters } from '@/app/shared/one-search/components/advanced-sidebar';

import type {

  OneSearchExecutionMeta,

  OneSearchMode,

  OneSearchProviderId,

  OneSearchQueryImage,

  OneSearchRequest,

  OneSearchResponse,

} from '@/types/one-search.types';



export interface UseOneSearchParams {

  query: string;

  mode: OneSearchMode;

  queryImage?: OneSearchQueryImage | null;

  scoreThreshold?: number;

  advancedFilters?: AdvancedSearchFilters;

  /** Audio/video toolbar sort, filters, pagination (forward-compatible). */
  mediaRequestPatch?: Pick<
    OneSearchRequest,
    'sort' | 'filters' | 'pagination' | 'mediaFilters'
  >;

  /** Server-resolved provider (avoids stale NEXT_PUBLIC_* in client bundle). */

  providerId?: OneSearchProviderId;

}



export interface UseOneSearchResult {

  response: OneSearchResponse | null;

  meta: OneSearchExecutionMeta | null;

  loading: boolean;

  error: string | null;

  errorCategory: ApiErrorCategory | null;

  rateLimited: boolean;

  providerId: ReturnType<typeof getOneSearchProviderId>;

  isMockProvider: boolean;

  /** Live gateway data (smart-search or temp-federated). */

  isTempProvider: boolean;

  isSmartSearchProvider: boolean;

  isLegacyFederatedProvider: boolean;

  refetch: (force?: boolean) => void;

}



export function useOneSearch({

  query,

  mode,

  queryImage,

  scoreThreshold,

  advancedFilters,

  mediaRequestPatch,

  providerId: providerIdProp,

}: UseOneSearchParams): UseOneSearchResult {

  const providerId = useMemo(

    () => providerIdProp ?? getOneSearchProviderId(),

    [providerIdProp]

  );

  const { data: session, status: sessionStatus } = useSession();

  const userId = (session?.user as { id?: string } | undefined)?.id;

  const pageVisible = usePageVisible();

  // URL-driven (`qParam`) — no keystroke debounce; debouncing caused empty results on hard refresh.
  const trimmedQuery = query.trim();

  const debouncedScore = useDebouncedValue(scoreThreshold, getOneSearchScoreDebounceMs());



  const [response, setResponse] = useState<OneSearchResponse | null>(null);

  const [meta, setMeta] = useState<OneSearchExecutionMeta | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [errorCategory, setErrorCategory] = useState<ApiErrorCategory | null>(null);

  const [rateLimited, setRateLimited] = useState(false);



  const fetchGenRef = useRef(0);

  const staleTimeMs = getOneSearchCacheStaleMs();



  const isMockProvider = providerId === 'mock';

  const isSmartSearchProvider = providerId === 'smart-search';

  const isLegacyFederatedProvider = providerId === 'temp-federated';

  const isTempProvider = isSmartSearchProvider || isLegacyFederatedProvider;



  const includeUserIdInKey = isSmartSearchProvider || isLegacyFederatedProvider;



  // Stable string key for queryImage to avoid object reference comparison in useCallback deps.
  // This prevents unnecessary re-creation of runSearch when queryImage object reference changes
  // but the actual values remain the same.
  const queryImageKey = useMemo(
    () =>
      queryImage
        ? `${queryImage.artifact_id}:${queryImage.crop ? JSON.stringify(queryImage.crop) : ''}`
        : '',
    [queryImage?.artifact_id, queryImage?.crop]
  );

  // Keep a ref to the latest queryImage so runSearch can access it without being in deps
  const queryImageRef = useRef(queryImage);
  useEffect(() => {
    queryImageRef.current = queryImage;
  }, [queryImage]);



  const requestExtras = useMemo(
    () => ({
      ...(advancedFilters ? advancedFiltersToRequest(advancedFilters) : {}),
      ...(mediaRequestPatch ?? {}),
    }),
    [advancedFilters, mediaRequestPatch]
  );

  const requestExtrasKey = useMemo(() => JSON.stringify(requestExtras), [requestExtras]);

  const requestExtrasRef = useRef(requestExtras);
  requestExtrasRef.current = requestExtras;

  const cacheKey = useMemo(
    () =>
      buildSearchCacheKey(
        {
          query: trimmedQuery,
          mode,
          queryImage: queryImage ?? undefined,
          scoreThreshold: debouncedScore,
          userId: includeUserIdInKey ? userId : undefined,
          ...requestExtras,
        },
        providerId,
        { includeUserId: includeUserIdInKey }
      ),
    [
      trimmedQuery,
      mode,
      queryImageKey,
      debouncedScore,
      userId,
      providerId,
      includeUserIdInKey,
      requestExtrasKey,
    ]
  );



  const runSearch = useCallback(

    async (force = false) => {
      // Use ref to get latest queryImage without adding object to deps
      const currentQueryImage = queryImageRef.current;
      const hasImage = Boolean(currentQueryImage?.artifact_id);

      if (!trimmedQuery && !hasImage) {
        setResponse(null);
        setMeta(null);
        setLoading(false);
        setError(null);
        setErrorCategory(null);
        setRateLimited(false);
        return;
      }

      if (includeUserIdInKey && sessionStatus === 'loading') {
        setLoading(true);
        return;
      }

      if (!pageVisible && !force) return;

      const gen = ++fetchGenRef.current;
      setLoading(true);
      setError(null);
      setErrorCategory(null);
      setRateLimited(false);

      try {
        const result = await oneSearchService.search(
          {
            query: trimmedQuery,
            mode,
            userId: includeUserIdInKey ? userId : undefined,
            ...(currentQueryImage ? { queryImage: currentQueryImage } : {}),
            ...(debouncedScore != null ? { scoreThreshold: debouncedScore } : {}),
            ...requestExtrasRef.current,
          },

          providerId,

          {

            cacheKey,

            staleTimeMs,

            force,

            includeUserIdInKey,

          }

        );

        if (gen !== fetchGenRef.current) return;

        setResponse(result.response);

        setMeta(result.meta);

        setRateLimited(Boolean(result.meta.rateLimited));

        if (result.meta.rateLimited) {

          setErrorCategory('rate_limited');

        }
      } catch (err: unknown) {

        if (gen !== fetchGenRef.current) return;

        if (isSearchAbortError(err)) {

          return;

        }

        const classified = classifyApiError(err);

        setError(classified.message);

        setErrorCategory(classified.category);

        setRateLimited(classified.category === 'rate_limited');

        setResponse(null);

        setMeta(null);
      } finally {
        if (gen === fetchGenRef.current) {
          setLoading(false);
        }
      }
    },

    [
      trimmedQuery,
      mode,
      queryImageKey,
      debouncedScore,
      userId,
      providerId,
      cacheKey,
      staleTimeMs,
      pageVisible,
      includeUserIdInKey,
      sessionStatus,
      requestExtrasKey,
    ]

  );



  // Track first execution to force search on mount (bypass hydration cache issues)
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    const forceOnMount = isFirstRunRef.current;
    isFirstRunRef.current = false;
    void runSearch(forceOnMount);
  }, [runSearch]);



  const refetch = useCallback(

    (force = true) => {

      void runSearch(force);

    },

    [runSearch]

  );



  return {

    response,

    meta,

    loading,

    error,

    errorCategory,

    rateLimited,

    providerId,

    isMockProvider,

    isTempProvider,

    isSmartSearchProvider,

    isLegacyFederatedProvider,

    refetch,

  };

}


