// ============================================
// One Search — service entry (delegates to fetch coordinator)
// ============================================

import { fetchOneSearch } from '@/app/shared/one-search/utils/search-fetch-coordinator';
import { getOneSearchProviderId } from '@/app/shared/one-search/config/search-config';
import type {
  OneSearchProviderId,
  OneSearchRequest,
  OneSearchResult,
} from '@/types/one-search.types';

export const oneSearchService = {
  async search(
    request: OneSearchRequest,
    providerIdOverride?: OneSearchProviderId,
    options?: {
      cacheKey?: string;
      staleTimeMs?: number;
      force?: boolean;
      includeUserIdInKey?: boolean;
    }
  ): Promise<OneSearchResult> {
    const providerId = providerIdOverride ?? getOneSearchProviderId();
    return fetchOneSearch(request, {
      providerId,
      cacheKey: options?.cacheKey ?? '',
      staleTimeMs: options?.staleTimeMs ?? 0,
      force: options?.force,
      includeUserIdInKey: options?.includeUserIdInKey,
    });
  },
};
