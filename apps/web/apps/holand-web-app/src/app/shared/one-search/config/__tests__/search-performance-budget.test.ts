import { describe, expect, it } from 'vitest';
import {
  evaluateSearchPerformanceBudget,
  SEARCH_GATEWAY_CALL_BUDGET,
} from '../search-performance-budget';
import type {
  OneSearchExecutionMeta,
  OneSearchDataSourceCall,
} from '@/types/one-search.types';

function meta(partial: Partial<OneSearchExecutionMeta>): OneSearchExecutionMeta {
  return {
    providerId: 'smart-search',
    query: 'test',
    mode: 'all',
    tookMs: 500,
    calls: [],
    hasRealLanes: true,
    hasMockLanes: false,
    ...partial,
  };
}

describe('evaluateSearchPerformanceBudget', () => {
  it('returns null when meta is missing', () => {
    expect(evaluateSearchPerformanceBudget(null)).toBeNull();
  });

  it('passes when calls are within budget', () => {
    const result = evaluateSearchPerformanceBudget(
      meta({
        calls: [
          {
            mode: 'all',
            lane: 'storage',
            toolId: 'plugin.smart_search',
            endpoint: '/execute',
            targetApi: 'POST /tools/plugin_smart_search/execute',
            status: 'ok',
          },
        ],
      })
    );
    expect(result?.ok).toBe(true);
    expect(result?.callCount).toBe(1);
    expect(result?.callBudget).toBe(SEARCH_GATEWAY_CALL_BUDGET);
  });

  it('fails when call count exceeds budget', () => {
    const result = evaluateSearchPerformanceBudget(
      meta({
        calls: Array.from({ length: 3 }, (_, i) => ({
          mode: 'all' as const,
          lane: `lane-${i}` as OneSearchDataSourceCall['lane'],
          toolId: 'plugin.smart_search',
          endpoint: '/execute',
          targetApi: 'POST /tools/plugin_smart_search/execute',
          status: 'ok' as const,
        })),
      })
    );
    expect(result?.ok).toBe(false);
    expect(result?.reasons.some((r) => r.startsWith('calls:'))).toBe(true);
  });

  it('fails on temp-federated fallback or rate limit', () => {
    expect(
      evaluateSearchPerformanceBudget(meta({ usedTempFederatedFallback: true }))?.ok
    ).toBe(false);
    expect(evaluateSearchPerformanceBudget(meta({ rateLimited: true }))?.ok).toBe(false);
  });
});
