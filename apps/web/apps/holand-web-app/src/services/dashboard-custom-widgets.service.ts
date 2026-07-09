import { DASHBOARD_CUSTOM_WIDGETS_STORAGE_KEY } from '@/app/shared/admin-dashboard/config';
import type { CustomWidgetDefinition } from '@/app/shared/admin-dashboard/catalog/types';

function readAll(): CustomWidgetDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DASHBOARD_CUSTOM_WIDGETS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomWidgetDefinition[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: CustomWidgetDefinition[]): CustomWidgetDefinition[] {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DASHBOARD_CUSTOM_WIDGETS_STORAGE_KEY, JSON.stringify(list));
  }
  return list;
}

export const dashboardCustomWidgetsService = {
  list(): CustomWidgetDefinition[] {
    return readAll().filter((w) => w.published);
  },

  save(entry: CustomWidgetDefinition): CustomWidgetDefinition[] {
    const next = [...readAll(), entry];
    return writeAll(next);
  },

  remove(id: string): CustomWidgetDefinition[] {
    return writeAll(readAll().filter((w) => w.id !== id));
  },

  getById(id: string): CustomWidgetDefinition | undefined {
    return readAll().find((w) => w.id === id);
  },
};
