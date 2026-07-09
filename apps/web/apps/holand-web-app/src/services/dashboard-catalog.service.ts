import { gatewayClient } from '@/lib/api-client';
import type { WidgetCatalogEntry, WidgetPolicy } from '@/app/shared/admin-dashboard/catalog/types';

export const dashboardCatalogService = {
  async getCatalog(): Promise<WidgetCatalogEntry[] | null> {
    try {
      const res = await gatewayClient.get<{ data?: { entries?: WidgetCatalogEntry[] } }>('/admin/dashboard/catalog');
      return res.data?.data?.entries ?? null;
    } catch {
      return null;
    }
  },

  async saveCatalog(entries: WidgetCatalogEntry[]): Promise<boolean> {
    try {
      await gatewayClient.put('/admin/dashboard/catalog', { entries });
      return true;
    } catch {
      return false;
    }
  },

  async getPolicies(): Promise<WidgetPolicy[] | null> {
    try {
      const res = await gatewayClient.get<{ data?: { policies?: WidgetPolicy[] } }>('/admin/dashboard/policies');
      return res.data?.data?.policies ?? null;
    } catch {
      return null;
    }
  },

  async savePolicies(policies: WidgetPolicy[]): Promise<boolean> {
    try {
      await gatewayClient.put('/admin/dashboard/policies', { policies });
      return true;
    } catch {
      return false;
    }
  },
};
