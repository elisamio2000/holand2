import { gatewayClient } from '@/lib/api-client';
import type { DashboardPreferencesV3 } from '@/app/shared/admin-dashboard/catalog/types';

const PREFS_PATH = (userId: string) => `/admin/users/${encodeURIComponent(userId)}/dashboard-preferences`;

/** Suppress global 403 toast — migrator handles denied/not-found inline. */
const SILENT_403 = { 'X-Skip-Access-Denied-Toast': '1' };

export type PreferencesFetchStatus = 'ok' | 'not_found' | 'error';

export type PreferencesFetchResult =
  | { status: 'ok'; data: DashboardPreferencesV3 }
  | { status: 'not_found' }
  | { status: 'error' };

export const dashboardPreferencesService = {
  async getWithStatus(userId: string): Promise<PreferencesFetchResult> {
    try {
      const res = await gatewayClient.get<{ data?: DashboardPreferencesV3 }>(PREFS_PATH(userId), {
        headers: SILENT_403,
        validateStatus: (s) => s === 200 || s === 404,
      });
      if (res.status === 404) return { status: 'not_found' };
      const data = res.data?.data ?? (res.data as unknown as DashboardPreferencesV3);
      if (data && typeof data === 'object' && data.schema_version === 3) {
        return { status: 'ok', data };
      }
      return { status: 'not_found' };
    } catch {
      return { status: 'error' };
    }
  },

  async get(userId: string): Promise<DashboardPreferencesV3 | null> {
    const result = await this.getWithStatus(userId);
    return result.status === 'ok' ? result.data : null;
  },

  async save(userId: string, prefs: DashboardPreferencesV3): Promise<DashboardPreferencesV3 | null> {
    try {
      const res = await gatewayClient.put<{ data?: DashboardPreferencesV3 }>(PREFS_PATH(userId), prefs, {
        headers: SILENT_403,
        validateStatus: (s) => s === 200 || s === 404,
      });
      if (res.status === 404) return null;
      return (res.data?.data ?? prefs) as DashboardPreferencesV3;
    } catch {
      return null;
    }
  },

  async isAvailable(userId: string): Promise<boolean> {
    const result = await this.getWithStatus(userId);
    return result.status === 'ok';
  },
};
