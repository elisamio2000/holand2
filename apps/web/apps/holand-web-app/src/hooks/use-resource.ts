'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyApiError, type ClassifiedApiError } from '@/lib/api-errors';
import { usePageVisible } from '@/hooks/use-page-visible';

export interface UseResourceOptions<T> {
  /** Unique cache key; same key shares in-memory cache across hook instances */
  cacheKey?: string;
  /** Stale time before background refetch (ms) */
  staleTimeMs?: number;
  /** Skip fetch when false */
  enabled?: boolean;
  /** Initial data before first fetch */
  initialData?: T;
  /** Called after successful fetch */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (error: ClassifiedApiError) => void;
}

export interface UseResourceReturn<T> {
  data: T | undefined;
  error: ClassifiedApiError | null;
  loading: boolean;
  isStale: boolean;
  refetch: () => Promise<T | undefined>;
  mutate: (updater: T | ((prev: T | undefined) => T)) => void;
}

const memoryCache = new Map<
  string,
  { data: unknown; fetchedAt: number }
>();

const inflight = new Map<string, Promise<unknown>>();

/**
 * Lightweight data-fetch hook: dedupe, stale-while-revalidate, visibility-aware pause.
 * Use instead of adding TanStack Query until the app adopts it project-wide.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  options: UseResourceOptions<T> = {}
): UseResourceReturn<T> {
  const {
    cacheKey,
    staleTimeMs = 30_000,
    enabled = true,
    initialData,
    onSuccess,
    onError,
  } = options;

  const pageVisible = usePageVisible();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const readCache = (): T | undefined => {
    if (!cacheKey) return initialData;
    const hit = memoryCache.get(cacheKey);
    return (hit?.data as T | undefined) ?? initialData;
  };

  const [data, setData] = useState<T | undefined>(readCache);
  const [error, setError] = useState<ClassifiedApiError | null>(null);
  const [loading, setLoading] = useState(enabled && data === undefined);
  const [isStale, setIsStale] = useState(false);
  const fetchedAtRef = useRef(0);

  const mutate = useCallback(
    (updater: T | ((prev: T | undefined) => T)) => {
      setData((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: T | undefined) => T)(prev)
            : updater;
        if (cacheKey) {
          memoryCache.set(cacheKey, { data: next, fetchedAt: Date.now() });
        }
        return next;
      });
    },
    [cacheKey]
  );

  const refetch = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return data;

    const key = cacheKey ?? `resource:${Date.now()}`;

    const run = async (): Promise<T> => {
      try {
        const result = await fetcherRef.current();
        fetchedAtRef.current = Date.now();
        if (cacheKey) {
          memoryCache.set(cacheKey, { data: result, fetchedAt: fetchedAtRef.current });
        }
        setData(result);
        setError(null);
        setIsStale(false);
        onSuccess?.(result);
        return result;
      } catch (err: unknown) {
        const classified = classifyApiError(err);
        setError(classified);
        onError?.(classified);
        throw err;
      }
    };

    let promise = inflight.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = run().finally(() => inflight.delete(key));
      inflight.set(key, promise);
    }

    const hadData = data !== undefined;
    if (!hadData) setLoading(true);
    try {
      return await promise;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, data, enabled, onError, onSuccess]);

  useEffect(() => {
    if (!enabled || !pageVisible) return;

    const cached = cacheKey ? memoryCache.get(cacheKey) : undefined;
    const age = cached ? Date.now() - cached.fetchedAt : Infinity;

    if (cached && age < staleTimeMs) {
      setData(cached.data as T);
      setLoading(false);
      setIsStale(false);
      fetchedAtRef.current = cached.fetchedAt;
      return;
    }

    if (cached) {
      setData(cached.data as T);
      setIsStale(true);
      setLoading(false);
    }

    void refetch();
  }, [enabled, pageVisible, cacheKey, staleTimeMs, refetch]);

  return {
    data,
    error,
    loading,
    isStale,
    refetch,
    mutate,
  };
}

/** Invalidate in-memory cache entry */
export function invalidateResourceCache(cacheKey: string): void {
  memoryCache.delete(cacheKey);
}

/** Invalidate all cache keys starting with prefix */
export function invalidateResourceCacheByPrefix(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

/** Subscribe to workspace changes and invalidate caches — convenience re-export. */
export { listenWorkspaceInvalidate } from '@/hooks/use-workspace-scope';
