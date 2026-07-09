// ============================================
// One Search — temp federated provider
// ============================================

import type {
  OneSearchLaneId,
  OneSearchLaneResult,
  OneSearchRequest,
  OneSearchResponse,
  OneSearchResult,
} from '@/types/one-search.types';
import { fetchTempFederatedLanes } from '../adapters/temp-federated.adapter';
import {
  emptyLaneResults,
  filterResponseByMode,
  mergeLaneHits,
} from '../utils/filter-response-by-mode';
import type { OneSearchProvider } from './types';

export const tempFederatedSearchProvider: OneSearchProvider = {
  id: 'temp-federated',

  async search(request: OneSearchRequest): Promise<OneSearchResult> {
    const started = Date.now();
    const mode = request.mode ?? 'all';
    const query = request.query.trim();
    const limit = request.pagination?.limit ?? 15;

    if (!query) {
      return {
        response: { query: '', mode, tookMs: 0, lanes: emptyLaneResults(), total: 0 },
        meta: {
          providerId: 'temp-federated',
          query,
          mode,
          tookMs: 0,
          calls: [],
          hasMockLanes: false,
          hasRealLanes: false,
        },
      };
    }

    const laneResults = await fetchTempFederatedLanes({
      query,
      mode,
      limit,
      userId: request.userId,
    });
    let lanes: OneSearchLaneResult[] = emptyLaneResults();

    for (const row of laneResults) {
      lanes = mergeLaneHits(lanes, row.lane, row.hits);
    }

    const rawResponse: OneSearchResponse = {
      query,
      mode,
      tookMs: Date.now() - started,
      total: lanes.reduce((s, l) => s + l.hits.length, 0),
      lanes,
      facets: {
        byLane: Object.fromEntries(lanes.map((l) => [l.lane, l.hits.length])) as Record<
          OneSearchLaneId,
          number
        >,
      },
    };

    const response = filterResponseByMode(rawResponse, mode);
    const calls = laneResults.map((r) => r.call);
    const hasMockLanes = calls.some((c) => c.status === 'mock');
    const hasRealLanes = calls.some((c) => c.status === 'ok');

    return {
      response,
      meta: {
        providerId: 'temp-federated',
        query,
        mode,
        tookMs: Date.now() - started,
        calls,
        hasMockLanes,
        hasRealLanes,
      },
    };
  },
};
