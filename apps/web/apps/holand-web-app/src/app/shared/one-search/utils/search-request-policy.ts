// ============================================
// One Search — request policy (fallback, dedupe, supplement)
// ============================================

import { getHttpStatus, isRateLimitedError } from '@/lib/gateway-retry';
import {
  FM_ENDPOINT,
  FM_TOOL,
} from '@/app/shared/one-search/mappers/file-manager-to-hit';
import {
  getOneSearchSmartFallbackMode,
  type OneSearchSmartFallbackMode,
} from '../config/search-config';
import { shouldSupplementSmartSearch } from './supplement-smart-search-hits';
import type {
  OneSearchExecutionMeta,
  OneSearchProviderId,
  OneSearchRequest,
} from '@/types/one-search.types';

function queryImageKey(queryImage?: OneSearchRequest['queryImage']): string {
  if (!queryImage?.artifact_id) return '';
  const crop = queryImage.crop
    ? `${queryImage.crop.x},${queryImage.crop.y},${queryImage.crop.width},${queryImage.crop.height}`
    : '';
  return `${queryImage.artifact_id}:${crop}`;
}

/** Stable cache key for dedupe / memory cache. */
export function buildSearchCacheKey(
  request: OneSearchRequest,
  providerId: OneSearchProviderId,
  options?: { includeUserId?: boolean }
): string {
  const mode = request.mode ?? 'all';
  const q = request.query.trim();
  const score =
    request.scoreThreshold != null ? String(request.scoreThreshold) : '';
  const visual = queryImageKey(request.queryImage);
  const filterKey = request.filters
    ? JSON.stringify({
        lanes: request.filters.lanes,
        dateFrom: request.filters.dateFrom,
        fileTypes: request.filters.fileTypes,
        languages: request.filters.languages,
      })
    : '';
  const sortKey = request.sort ?? '';
  const pagKey = request.pagination
    ? `${request.pagination.offset ?? 0}:${request.pagination.limit ?? ''}`
    : '';
  const mediaKey = request.mediaFilters ? JSON.stringify(request.mediaFilters) : '';
  const userPart =
    options?.includeUserId && request.userId ? `:u:${request.userId}` : '';
  return `one-search:${providerId}:${mode}:${q}:${visual}:${score}:${sortKey}:${pagKey}:${mediaKey}:${filterKey}${userPart}`;
}

export function isSearchAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('aborted') || msg.includes('canceled');
  }
  return false;
}

function isLimitedFallbackEligible(err: unknown): boolean {
  const status = getHttpStatus(err);
  if (status === 429 || status === 401 || status === 403) return false;
  if (status != null && status >= 500) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes('timeout') || msg.includes('network');
}

/** Whether smart_search failure should fan out to temp-federated. */
export function shouldUseTempFederatedFallback(
  err: unknown,
  mode?: OneSearchSmartFallbackMode
): boolean {
  if (isSearchAbortError(err)) return false;
  if (isRateLimitedError(err)) return false;

  const status = getHttpStatus(err);
  if (status === 401 || status === 403) return false;

  const policy = mode ?? getOneSearchSmartFallbackMode();
  if (policy === 'off') return false;
  if (policy === 'full') return true;
  return isLimitedFallbackEligible(err);
}

function hasFileManagerCall(meta?: OneSearchExecutionMeta | null): boolean {
  if (!meta?.calls?.length) return false;
  return meta.calls.some(
    (c) =>
      c.toolId === FM_TOOL ||
      c.endpoint === FM_ENDPOINT ||
      c.toolId?.includes('file_manager') ||
      c.endpoint?.includes('file_manager')
  );
}

/** Whether file_manager supplement should run after smart_search. */
export function shouldSupplementAfterSearch(
  meta: OneSearchExecutionMeta,
  request: OneSearchRequest,
  response: Parameters<typeof shouldSupplementSmartSearch>[0]
): boolean {
  if (meta.usedTempFederatedFallback) return false;
  if (hasFileManagerCall(meta)) return false;
  return shouldSupplementSmartSearch(response, request);
}
