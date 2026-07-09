/**
 * Public platform defaults (language, theme, layout).
 */
import { gatewayClient } from '@/lib/api-client';
import type { PlatformDefaultsResponse } from '@/types/auth.types';

export const platformService = {
  /**
   * @endpoint GET /platform/defaults
   */
  async getDefaults(): Promise<PlatformDefaultsResponse> {
    console.info('[PlatformService] Fetching platform defaults...');
    const res = await gatewayClient.get<PlatformDefaultsResponse>('/platform/defaults');
    return res.data;
  },
};
