// ============================================
// Shared map_explorer plugin transport
// Every map backend call goes through the API Gateway tool-runner:
//   POST /tools/map_explorer.<tool>/execute
// and returns the unwrapped storage/map-py payload (the plugin `data` body).
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { toolExecutePath } from '@/utils/tool-id';
import { assertGatewayToolSuccess, isGatewayToolError } from '@/utils/gateway-tool-success';
import { unwrapToolExecuteData } from '@/utils/tool-execute';
import type { AxiosError } from 'axios';

type AnyRecord = Record<string, unknown>;

/** Short names used in geo-location.service / executors → gateway tool IDs from tool.json */
const MAP_TOOL_IDS: Record<string, string> = {
  list: 'plugin_map_explorer_files_list',
  stats: 'plugin_map_explorer_stats',
  details: 'plugin_map_explorer_files_details',
  within: 'plugin_map_explorer_spatial_within',
  timeline: 'plugin_map_explorer_analysis_timeline',
  movement: 'plugin_map_explorer_analysis_movement',
  export: 'plugin_map_explorer_export',
  reverse_geocode: 'plugin_map_explorer_reverse_geocode',
  streetview_browse: 'plugin_map_explorer_streetview_browse',
  streetview_panoramas: 'plugin_map_explorer_streetview_panoramas',
  sat_tile_config: 'plugin_map_explorer_sat_tile_config',
  basemap_config: 'plugin_map_explorer_basemap_config',
  get_route: 'plugin_map_explorer_get_route',
  geocode_polygon: 'plugin_map_explorer_map_py_geocode_polygon',
  layers_list: 'plugin_map_explorer_layers_list',
  layers_register: 'plugin_map_explorer_layers_register',
  layers_remove: 'plugin_map_explorer_layers_remove',
  layers_detect: 'plugin_map_explorer_layers_detect',
  layers_detect_url: 'plugin_map_explorer_layers_detect_url',
  layers_import: 'plugin_map_explorer_layers_import',
  layers_browse: 'plugin_map_explorer_layers_browse',
};

function resolveMapToolId(tool: string): string {
  return MAP_TOOL_IDS[tool] ?? tool;
}

/** Human-readable map_explorer / gateway failure for geo UI banners. */
export function formatMapToolError(err: unknown, tool = 'map_explorer'): string {
  if (isGatewayToolError(err)) {
    if (err.statusCode === 404) {
      return `ابزار ${tool} روی gateway پیدا نشد (404). tool-runner را restart کنید.`;
    }
    const msg = err.message || '';
    if (msg.includes('storage_timeout')) {
      return 'مرور پوشه لایه‌ها بیش از حد طول کشید — دوباره تلاش کنید.';
    }
    if (msg.includes('storage_unreachable')) {
      return 'سرویس storage در دسترس نیست — وضعیت pod/storage را بررسی کنید.';
    }
    if (msg.includes('map_layers_import_shared_required')) {
      return 'دسترسی map_layers:import_shared لازم است — از ادمین بخواهید این مجوز را بدهد.';
    }
    return msg || `خطای gateway (${err.statusCode})`;
  }
  const ax = err as AxiosError<{ detail?: string; message?: string; error?: string }>;
  const status = ax.response?.status;
  const detail = ax.response?.data?.detail || ax.response?.data?.message || ax.response?.data?.error;
  if (status === 404) {
    return detail
      ? `درخواست map_explorer ناموفق (404): ${detail}`
      : 'درخواست map_explorer ناموفق بود (404). gateway یا tool-runner را بررسی کنید.';
  }
  if (status === 401 || status === 403) {
    return 'احراز هویت ناموفق — دوباره وارد شوید.';
  }
  if (typeof detail === 'string') {
    if (detail.includes('storage_timeout')) {
      return 'مرور پوشه لایه‌ها بیش از حد طول کشید — دوباره تلاش کنید.';
    }
    if (detail.includes('storage_unreachable')) {
      return 'سرویس storage در دسترس نیست — وضعیت pod/storage را بررسی کنید.';
    }
    if (detail.includes('map_layers_import_shared_required')) {
      return 'دسترسی map_layers:import_shared لازم است — از ادمین بخواهید این مجوز را بدهد.';
    }
    if (detail.trim()) return detail;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'بارگذاری دادهٔ نقشه ناموفق بود';
}

export async function runMapTool<T = AnyRecord>(
  tool: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const toolId = resolveMapToolId(tool);
  const res = await gatewayClient.post(
    toolExecutePath(toolId),
    { args },
    { signal }
  );
  assertGatewayToolSuccess(res);

  // Envelope can be { result: { data } } | { data } | plugin { ok, data, channels }
  let payload: unknown = unwrapToolExecuteData(res.data);
  if (payload == null) {
    const d = (res.data as AnyRecord)?.data;
    payload = d != null ? d : res.data;
  }
  if (
    payload &&
    typeof payload === 'object' &&
    'ok' in (payload as AnyRecord) &&
    'data' in (payload as AnyRecord)
  ) {
    payload = (payload as AnyRecord).data;
  }
  return payload as T;
}
