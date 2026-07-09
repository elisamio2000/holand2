// ============================================
// One Search — provider factory
// ============================================

import { getOneSearchProviderId } from '../config/search-config';
import { gatewayQueryProvider } from './gateway-query.provider';
import { mockOneSearchProvider } from './mock.provider';
import { smartSearchProvider } from './smart-search.provider';
import { tempFederatedSearchProvider } from './temp-federated.provider';
import type { OneSearchProvider } from './types';

/** Legacy stub — use gatewayQueryProvider when POST /search/query is live. */
export const gatewayQueryProviderStub: OneSearchProvider = gatewayQueryProvider;

export function createOneSearchProvider(
  providerId?: ReturnType<typeof getOneSearchProviderId>
): OneSearchProvider {
  const id = providerId ?? getOneSearchProviderId();
  switch (id) {
    case 'mock':
      return mockOneSearchProvider;
    case 'temp-federated':
      return tempFederatedSearchProvider;
    case 'smart-search':
      return smartSearchProvider;
    case 'gateway-query':
      return gatewayQueryProvider;
    default:
      return tempFederatedSearchProvider;
  }
}

export { gatewayQueryProvider, mockOneSearchProvider, smartSearchProvider, tempFederatedSearchProvider };
