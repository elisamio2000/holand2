import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  buildSearchCacheKey,
  shouldSupplementAfterSearch,
  shouldUseTempFederatedFallback,
} from '../search-request-policy';
import { emptyLaneResults } from '../filter-response-by-mode';
import type { OneSearchExecutionMeta, OneSearchResponse } from '@/types/one-search.types';
import { FM_TOOL } from '../../mappers/file-manager-to-hit';

function baseResponse(): OneSearchResponse {
  return {
    query: 'screen',
    mode: 'all',
    lanes: emptyLaneResults(),
    total: 0,
  };
}

describe('buildSearchCacheKey', () => {
  it('builds stable key from query and mode', () => {
    const key = buildSearchCacheKey({ query: 'test', mode: 'all' }, 'smart-search');
    expect(key).toBe('one-search:smart-search:all:test::::::');
  });

  it('includes visual artifact in key', () => {
    const key = buildSearchCacheKey(
      { query: '', mode: 'image', queryImage: { artifact_id: 'uuid-1' } },
      'smart-search'
    );
    expect(key).toContain('uuid-1');
  });
});

describe('shouldUseTempFederatedFallback', () => {
  function axiosStatus(status: number): AxiosError {
    return new AxiosError('err', String(status), undefined, undefined, {
      status,
      statusText: String(status),
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    });
  }

  it('returns false for 429', () => {
    expect(shouldUseTempFederatedFallback(axiosStatus(429), 'full')).toBe(false);
  });

  it('returns false when policy is off', () => {
    expect(shouldUseTempFederatedFallback(new Error('server'), 'off')).toBe(false);
  });

  it('returns true for 503 when policy is full', () => {
    expect(shouldUseTempFederatedFallback(axiosStatus(503), 'full')).toBe(true);
  });

  it('returns true for timeout message when policy is limited', () => {
    expect(shouldUseTempFederatedFallback(new Error('timeout:smart_search'), 'limited')).toBe(true);
  });
});

describe('shouldSupplementAfterSearch', () => {
  it('skips when temp-federated fallback was used', () => {
    const meta: OneSearchExecutionMeta = {
      providerId: 'smart-search',
      query: 'screen',
      mode: 'all',
      tookMs: 10,
      calls: [],
      hasMockLanes: false,
      hasRealLanes: false,
      usedTempFederatedFallback: true,
    };
    expect(shouldSupplementAfterSearch(meta, { query: 'screen' }, baseResponse())).toBe(false);
  });

  it('skips when file_manager already called', () => {
    const meta: OneSearchExecutionMeta = {
      providerId: 'smart-search',
      query: 'screen',
      mode: 'all',
      tookMs: 10,
      calls: [
        {
          mode: 'all',
          lane: 'files',
          toolId: FM_TOOL,
          endpoint: '/x',
          targetApi: 'POST /x',
          status: 'ok',
        },
      ],
      hasMockLanes: false,
      hasRealLanes: true,
    };
    expect(shouldSupplementAfterSearch(meta, { query: 'screen' }, baseResponse())).toBe(false);
  });
});
