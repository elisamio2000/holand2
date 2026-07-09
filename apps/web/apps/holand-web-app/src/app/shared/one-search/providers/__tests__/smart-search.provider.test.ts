import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GatewayToolError } from '@/utils/gateway-tool-success';
import { smartSearchProvider } from '../smart-search.provider';

const postMock = vi.fn();
const fallbackSearchMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock('@/lib/gateway-retry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gateway-retry')>();
  return {
    ...actual,
    withGateway429Retry: (fn: () => Promise<unknown>) => fn(),
  };
});

vi.mock('@/app/shared/one-search/config/search-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/shared/one-search/config/search-config')>();
  return {
    ...actual,
    getOneSearchSmartFallbackMode: () => 'full' as const,
  };
});

vi.mock('../temp-federated.provider', () => ({
  tempFederatedSearchProvider: {
    search: (...args: unknown[]) => fallbackSearchMock(...args),
  },
}));

describe('smartSearchProvider', () => {
  beforeEach(() => {
    postMock.mockReset();
    fallbackSearchMock.mockReset();
  });

  it('returns rate-limited meta without fallback storm on 429', async () => {
    postMock.mockRejectedValue(new GatewayToolError('Too Many Requests', 429));

    const result = await smartSearchProvider.search({
      query: 'cats',
      mode: 'text',
    });

    expect(fallbackSearchMock).not.toHaveBeenCalled();
    expect(result.meta.rateLimited).toBe(true);
    expect(result.meta.calls?.[0]?.notes).toContain('Rate limited');
  });

  it('returns degraded meta for image-only smart_search failure', async () => {
    postMock.mockRejectedValue(new Error('binding_not_configured'));

    const result = await smartSearchProvider.search({
      query: '',
      mode: 'image',
      queryImage: { artifact_id: 'img-only-1' },
    });

    expect(fallbackSearchMock).not.toHaveBeenCalled();
    expect(result.meta.degradedSources?.visual_search).toContain('image-only');
    expect(result.meta.calls?.[0]?.notes).toContain('Image-only');
  });

  it('uses temp-federated fallback when smart_search fails', async () => {
    postMock.mockRejectedValue(new Error('upstream timeout'));
    fallbackSearchMock.mockResolvedValue({
      response: { query: 'cats', mode: 'text', total: 1, tookMs: 5, lanes: [], facets: {} },
      meta: {
        providerId: 'temp-federated',
        tookMs: 5,
        calls: [{ lane: 'files', toolId: 'x', endpoint: '/x', status: 'ok' }],
        hasRealLanes: true,
        hasMockLanes: false,
      },
    });

    const result = await smartSearchProvider.search({ query: 'cats', mode: 'text' });

    expect(fallbackSearchMock).toHaveBeenCalled();
    expect(result.meta.usedTempFederatedFallback).toBe(true);
    expect(result.meta.calls?.length).toBeGreaterThan(1);
  });
});
