// ============================================
// One Search — coordinated fetch (abort, dedupe, cache)
// ============================================

import { createOneSearchProvider } from '@/app/shared/one-search/providers';
import { getOneSearchProviderId } from '@/app/shared/one-search/config/search-config';
import { normalizeSearchResponse } from '@/app/shared/one-search/utils/normalize-search-hits';
import { excludeQueryArtifactFromResponse } from '@/app/shared/one-search/utils/exclude-query-artifact-hits';
import { supplementSmartSearchWithFileManager } from '@/app/shared/one-search/utils/supplement-smart-search-hits';
import { dedupeAsync } from '@/utils/async-dedup';
import type {
  OneSearchProviderId,
  OneSearchRequest,
  OneSearchResult,
} from '@/types/one-search.types';
import {
  buildSearchCacheKey,
  isSearchAbortError,
  shouldSupplementAfterSearch,
} from './search-request-policy';
import { cancelSearchMediaQueues } from './search-media-fetch';

const memoryCache = new Map<
  string,
  { result: OneSearchResult; fetchedAt: number }
>();

const abortControllers = new Map<string, AbortController>();

export function invalidateSearchCache(cacheKey?: string): void {
  if (cacheKey) memoryCache.delete(cacheKey);
  else memoryCache.clear();
}

export function getCachedSearchResult(
  cacheKey: string,
  staleTimeMs: number
): OneSearchResult | null {
  const hit = memoryCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > staleTimeMs) return null;
  return hit.result;
}

function abortInFlight(cacheKey: string): void {
  const prev = abortControllers.get(cacheKey);
  if (prev) prev.abort();
  abortControllers.delete(cacheKey);
}

async function runSearch(
  request: OneSearchRequest,
  providerId: OneSearchProviderId,
  signal: AbortSignal
): Promise<OneSearchResult> {
  const provider = createOneSearchProvider(providerId);
  const result = await provider.search({ ...request, signal });
  const query = request.query.trim();
  const hasImage = Boolean(request.queryImage?.artifact_id);

  let response = result.response;
  if (providerId === 'smart-search' && (query || hasImage)) {
    if (
      query &&
      shouldSupplementAfterSearch(result.meta, request, response)
    ) {
      response = await supplementSmartSearchWithFileManager(response, request);
    }
  }

  response = normalizeSearchResponse(response, query);
  response = excludeQueryArtifactFromResponse(
    response,
    request.queryImage,
    result.meta.queryImageEcho
  );

  return {
    ...result,
    response,
  };
}

export async function fetchOneSearch(
  request: OneSearchRequest,
  options: {
    providerId?: OneSearchProviderId;
    cacheKey: string;
    staleTimeMs: number;
    force?: boolean;
    includeUserIdInKey?: boolean;
  }
): Promise<OneSearchResult> {
  const providerId = options.providerId ?? getOneSearchProviderId();
  const cacheKey =
    options.cacheKey ||
    buildSearchCacheKey(request, providerId, {
      includeUserId: options.includeUserIdInKey,
    });

  if (!options.force && options.staleTimeMs > 0) {
    const cached = getCachedSearchResult(cacheKey, options.staleTimeMs);
    if (cached) return cached;
  }

  cancelSearchMediaQueues();
  abortInFlight(cacheKey);

  const controller = new AbortController();
  abortControllers.set(cacheKey, controller);

  const dedupeKey = `${cacheKey}:${options.force ? 'force' : 'fetch'}`;

  try {
    const result = await dedupeAsync(dedupeKey, async () => {
      const out = await runSearch(request, providerId, controller.signal);
      memoryCache.set(cacheKey, { result: out, fetchedAt: Date.now() });
      return out;
    });
    return result;
  } catch (err) {
    if (isSearchAbortError(err)) {
      throw err;
    }
    throw err;
  } finally {
    if (abortControllers.get(cacheKey) === controller) {
      abortControllers.delete(cacheKey);
    }
  }
}
