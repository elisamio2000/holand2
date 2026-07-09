// ============================================
// One Search — smart_search try-first with controlled temp-federated fallback
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { classifyApiError } from '@/lib/api-errors';
import { isRateLimitedError, withGateway429Retry } from '@/lib/gateway-retry';
import type {
  OneSearchLaneId,
  OneSearchRequest,
  OneSearchResult,
} from '@/types/one-search.types';
import {
  ONE_SEARCH_SOURCE_TIMEOUT_MS,
} from '../config/search-config';
import { emptyLaneResults } from '../utils/filter-response-by-mode';
import { shouldUseTempFederatedFallback } from '../utils/search-request-policy';
import { buildSmartSearchArgs } from './build-smart-search-args';
import {
  parseSmartSearchResponse,
  SS_ENDPOINT,
  SS_TARGET_API,
  SS_TOOL,
} from './smart-search-parse';
import { tempFederatedSearchProvider } from './temp-federated.provider';
import type { OneSearchProvider } from './types';

export { SS_ENDPOINT, SS_TOOL } from './smart-search-parse';

function emptySmartSearchResult(
  request: OneSearchRequest,
  started: number
): OneSearchResult {
  const mode = request.mode ?? 'all';
  const query = request.query.trim();
  const lanes = emptyLaneResults('smart-search');
  const tookMs = Date.now() - started;

  return {
    response: {
      query,
      mode,
      total: 0,
      tookMs,
      lanes,
      facets: {
        byLane: Object.fromEntries(lanes.map((l) => [l.lane, 0])) as Record<string, number>,
      },
    },
    meta: {
      providerId: 'smart-search',
      query,
      mode,
      tookMs,
      primaryEndpoint: SS_ENDPOINT,
      calls: [],
      hasMockLanes: false,
      hasRealLanes: false,
    },
  };
}

function smartSearchErrorResult(
  request: OneSearchRequest,
  started: number,
  err: unknown
): OneSearchResult {
  const mode = request.mode ?? 'all';
  const query = request.query.trim();
  const classified = classifyApiError(err);
  const errMsg = classified.message;
  const tookMs = Date.now() - started;

  return {
    response: {
      query,
      mode,
      total: 0,
      tookMs,
      lanes: emptyLaneResults('smart-search'),
      facets: {
        byLane: Object.fromEntries(
          emptyLaneResults('smart-search').map((lane) => [lane.lane, 0])
        ) as Record<OneSearchLaneId, number>,
      },
    },
    meta: {
      providerId: 'smart-search',
      query,
      mode,
      tookMs,
      primaryEndpoint: SS_ENDPOINT,
      hasMockLanes: false,
      hasRealLanes: false,
      rateLimited: classified.category === 'rate_limited',
      calls: [
        {
          targetApi: SS_TARGET_API,
          mode,
          lane: 'any',
          toolId: SS_TOOL,
          endpoint: SS_ENDPOINT,
          status: classified.category === 'rate_limited' ? 'error' : 'error',
          latencyMs: tookMs,
          error: errMsg,
          hitCount: 0,
          notes:
            classified.category === 'rate_limited'
              ? 'Rate limited — no federated fallback'
              : 'smart_search failed — no federated fallback',
        },
      ],
    },
  };
}

function imageOnlyDegradedSmartSearchResult(
  request: OneSearchRequest,
  started: number,
  err?: unknown
): OneSearchResult {
  const mode = request.mode ?? 'all';
  const query = request.query.trim();
  const lanes = emptyLaneResults('smart-search');
  const tookMs = Date.now() - started;
  const errMsg = err instanceof Error ? err.message : err != null ? String(err) : undefined;
  const note =
    errMsg != null
      ? `smart_search failed for image-only query: ${errMsg}`
      : 'Image-only search requires visual similarity binding; no text fallback available';

  return {
    response: {
      query,
      mode,
      total: 0,
      tookMs,
      lanes,
      facets: {
        byLane: Object.fromEntries(lanes.map((l) => [l.lane, 0])) as Record<string, number>,
      },
    },
    meta: {
      providerId: 'smart-search',
      query,
      mode,
      tookMs,
      primaryEndpoint: SS_ENDPOINT,
      searchKind: 'visual',
      hasMockLanes: false,
      hasRealLanes: false,
      degradedSources: {
        visual_search: note,
      },
      calls: [
        {
          targetApi: SS_TARGET_API,
          mode,
          lane: 'any',
          toolId: SS_TOOL,
          endpoint: SS_ENDPOINT,
          status: 'error',
          latencyMs: tookMs,
          hitCount: 0,
          error: errMsg,
          notes: 'Image-only query — no federated fallback; visual binding required',
        },
      ],
    },
  };
}

export const smartSearchProvider: OneSearchProvider = {
  id: 'smart-search',

  async search(request: OneSearchRequest): Promise<OneSearchResult> {
    const started = Date.now();
    const mode = request.mode ?? 'all';
    const query = request.query.trim();
    const args = buildSmartSearchArgs(request);

    if (!args) {
      return emptySmartSearchResult(request, started);
    }

    const axiosConfig = {
      timeout: ONE_SEARCH_SOURCE_TIMEOUT_MS,
      ...(request.signal ? { signal: request.signal } : {}),
    };

    try {
      const res = await withGateway429Retry(
        () =>
          gatewayClient.post<unknown>(SS_ENDPOINT, { args }, axiosConfig),
        'smart_search'
      );

      const parsed = parseSmartSearchResponse(res.data, request, { trustServerMode: true });
      if (!parsed) {
        throw new Error('smart_search response could not be parsed');
      }

      const tookMs = Date.now() - started;

      return {
        response: { ...parsed.response, tookMs: parsed.response.tookMs ?? tookMs },
        meta: {
          providerId: 'smart-search',
          query,
          mode,
          tookMs,
          primaryEndpoint: SS_ENDPOINT,
          degradedSources: parsed.degradedSources,
          searchKind: parsed.searchKind,
          aiSummary: parsed.aiSummary,
          queryImageEcho: parsed.queryImageEcho,
          calls: [
            {
              targetApi: SS_TARGET_API,
              mode,
              lane: 'any',
              toolId: SS_TOOL,
              endpoint: SS_ENDPOINT,
              args,
              status: 'ok',
              latencyMs: tookMs,
              hitCount: parsed.response.total ?? 0,
              notes: parsed.degradedSources
                ? 'plugin.smart_search — partial degradation'
                : 'plugin.smart_search',
            },
          ],
          hasMockLanes: false,
          hasRealLanes: (parsed.response.total ?? 0) > 0,
        },
      };
    } catch (err) {
      if (request.signal?.aborted) {
        throw err;
      }

      const hasText = query.length > 0;
      if (!hasText) {
        return imageOnlyDegradedSmartSearchResult(request, started, err);
      }

      if (!shouldUseTempFederatedFallback(err)) {
        if (isRateLimitedError(err)) {
          return smartSearchErrorResult(request, started, err);
        }
        throw err;
      }

      const fallback = await tempFederatedSearchProvider.search(request);
      const errMsg = err instanceof Error ? err.message : String(err);

      return {
        ...fallback,
        meta: {
          ...fallback.meta,
          providerId: 'smart-search',
          primaryEndpoint: SS_ENDPOINT,
          hasMockLanes: false,
          usedTempFederatedFallback: true,
          calls: [
            {
              targetApi: SS_TARGET_API,
              mode,
              lane: 'any',
              toolId: SS_TOOL,
              endpoint: SS_ENDPOINT,
              args,
              status: 'error',
              latencyMs: Date.now() - started,
              error: errMsg,
              hitCount: 0,
              notes: 'Fell back to temp-federated',
            },
            ...fallback.meta.calls,
          ],
        },
      };
    }
  },
};
