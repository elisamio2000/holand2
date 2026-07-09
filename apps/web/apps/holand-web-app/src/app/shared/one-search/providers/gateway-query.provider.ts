// ============================================
// One Search — POST /search/query gateway provider
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { classifyApiError } from '@/lib/api-errors';
import { isRateLimitedError, withGateway429Retry } from '@/lib/gateway-retry';
import type { OneSearchRequest, OneSearchResult } from '@/types/one-search.types';
import { ONE_SEARCH_SOURCE_TIMEOUT_MS } from '../config/search-config';
import { emptyLaneResults } from '../utils/filter-response-by-mode';
import { buildSmartSearchArgs } from './build-smart-search-args';
import type { OneSearchProvider } from './types';

export const GATEWAY_QUERY_ENDPOINT = '/search/query';
export const GATEWAY_QUERY_TARGET = 'POST /search/query';

/** Federated search via REST POST /search/query (maps to plugin_smart_search server-side). */
export const gatewayQueryProvider: OneSearchProvider = {
  id: 'gateway-query',
  async search(request: OneSearchRequest): Promise<OneSearchResult> {
    const started = Date.now();
    const mode = request.mode ?? 'all';
    const query = request.query.trim();
    const args = buildSmartSearchArgs(request);
    if (!args) {
      throw new Error('One Search requires query text or query_image');
    }

    const body: Record<string, unknown> = {
      query: (args.query as string) ?? query,
      mode: args.mode ?? mode,
      top_k: args.top_k,
      sort: args.sort,
      score_threshold: args.score_threshold,
      filters: args.filters,
      pagination: args.pagination,
      query_image: args.query_image,
      session_id: request.sessionId,
    };

    try {
      const res = await withGateway429Retry(() =>
        gatewayClient.post<Record<string, unknown>>(GATEWAY_QUERY_ENDPOINT, body, {
          timeout: ONE_SEARCH_SOURCE_TIMEOUT_MS,
          signal: request.signal,
        })
      );
      const data = res.data;
      const lanesRaw = Array.isArray(data.lanes) ? data.lanes : [];
      const lanes = lanesRaw.length ? lanesRaw : emptyLaneResults('gateway-query');
      const tookMs = typeof data.tookMs === 'number' ? data.tookMs : Date.now() - started;

      return {
        response: {
          query,
          mode,
          total: typeof data.total === 'number' ? data.total : 0,
          tookMs,
          lanes: lanes as OneSearchResult['response']['lanes'],
          facets: (data.facets as OneSearchResult['response']['facets']) ?? {
            byLane: Object.fromEntries(lanes.map((l) => [l.lane, l.total ?? 0])),
          },
          suggestions: data.suggestions as OneSearchResult['response']['suggestions'],
        },
        meta: {
          providerId: 'gateway-query',
          query,
          mode,
          tookMs,
          primaryEndpoint: GATEWAY_QUERY_ENDPOINT,
          calls: [
            {
              mode,
              lane: 'any',
              toolId: 'search.gateway_query',
              endpoint: GATEWAY_QUERY_TARGET,
              targetApi: GATEWAY_QUERY_TARGET,
              status: 'ok',
              latencyMs: tookMs,
            },
          ],
          hasMockLanes: false,
          hasRealLanes: lanes.some((l) => (l.hits?.length ?? 0) > 0),
        },
      };
    } catch (err) {
      if (isRateLimitedError(err)) {
        throw err;
      }
      const classified = classifyApiError(err);
      throw new Error(classified.message || 'POST /search/query failed');
    }
  },
};
