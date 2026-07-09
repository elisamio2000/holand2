// ============================================
// One Search — provider interface
// ============================================

import type {
  OneSearchProviderId,
  OneSearchRequest,
  OneSearchResult,
} from '@/types/one-search.types';

export interface OneSearchProvider {
  readonly id: OneSearchProviderId;
  search(request: OneSearchRequest): Promise<OneSearchResult>;
}
