// ============================================
// One Search — mock provider
// ============================================

import type {
  OneSearchRequest,
  OneSearchResult,
} from '@/types/one-search.types';
import { runMockOneSearch } from '../mock/mock-one-search';
import { filterResponseByMode } from '../utils/filter-response-by-mode';
import type { OneSearchProvider } from './types';

export const mockOneSearchProvider: OneSearchProvider = {
  id: 'mock',

  async search(request: OneSearchRequest): Promise<OneSearchResult> {
    const started = Date.now();
    const mode = request.mode ?? 'all';
    const query = request.query.trim();
    const raw = await runMockOneSearch({ query, mode });
    const response = filterResponseByMode(raw, mode);

    return {
      response,
      meta: {
        providerId: 'mock',
        query,
        mode,
        tookMs: Date.now() - started,
        calls: [
          {
            mode,
            lane: 'chat',
            toolId: 'mock.unified_search',
            endpoint: 'local/mock-one-search.ts',
            targetApi: 'POST /search/query (federated lanes)',
            status: 'mock',
            hitCount: response.lanes.reduce((s, l) => s + l.hits.length, 0),
            notes: 'All lanes from mock dataset',
          },
        ],
        hasMockLanes: true,
        hasRealLanes: false,
      },
    };
  },
};
