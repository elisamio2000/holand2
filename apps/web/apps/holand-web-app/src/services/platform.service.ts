/**
 * Public platform defaults (language, theme, layout).
 */
import { gatewayClient } from '@/lib/api-client';
import type { PlatformDefaultsResponse } from '@/types/auth.types';

let defaultsEndpointUnavailable = false;

export const platformService = {
  /**
   * @endpoint GET /platform/defaults
   */
  async getDefaults(): Promise<PlatformDefaultsResponse | null> {
    if (defaultsEndpointUnavailable) {
      return null;
    }

    console.info('[PlatformService] Fetching platform defaults...');
    try {
      const res = await gatewayClient.get<PlatformDefaultsResponse>('/platform/defaults', {
        timeout: 5000,
      });
      return res.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        defaultsEndpointUnavailable = true;
        console.info('[PlatformService] /platform/defaults is not available in this environment.');
        return null;
      }
      if (error?.code === 'ECONNABORTED') {
        console.info('[PlatformService] /platform/defaults timed out; skipping defaults for this session.');
        defaultsEndpointUnavailable = true;
        return null;
      }
      throw error;
    }
  },
};
