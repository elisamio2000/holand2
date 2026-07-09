import type { AdminDashboardData, AuthActivityGroup } from '@/app/shared/admin-dashboard/types';
import {
  readSummaryCache,
  readSummaryEtag,
  writeSummaryCache,
} from '@/app/shared/admin-dashboard/utils/dashboard-summary-etag';
import { gatewayClient } from '@/lib/api-client';

export type DashboardSummaryInclude =
  | 'system'
  | 'storage'
  | 'ops'
  | 'users'
  | 'events'
  | 'llm'
  | 'gpu'
  | 'admin';

export type DashboardSummaryResponse = {
  refreshed_at?: string;
  meta?: {
    partial?: boolean;
    failed_sections?: string[];
    section_timings_ms?: Record<string, number>;
    etag?: string;
    realtime?: {
      mode?: 'poll' | 'ws' | 'hybrid' | 'off';
      ws_url?: string;
      poll_critical_ms?: number;
      poll_standard_ms?: number;
    };
  };
  system_stats?: AdminDashboardData['systemStats'] & {
    trends?: Record<string, { increased: boolean; value: string }>;
  };
  service_health?: AdminDashboardData['serviceHealth'];
  import_queue?: Record<string, unknown>;
  storage?: {
    facets?: {
      total_count?: number;
      total_bytes?: number;
      media_type?: Record<string, number>;
      date_histogram?: Array<{ key: string; count: number; bytes?: number }>;
    };
    quota?: AdminDashboardData['quota'];
    top_folders?: AdminDashboardData['folders'];
    recent_files?: AdminDashboardData['recentFiles'];
    incidents?: Array<{ at: string; label: string; severity?: string }>;
  };
  recent_cases?: AdminDashboardData['recentCases'];
  ops?: {
    transfers?: AdminDashboardData['transferStats'];
  };
  users?: {
    users?: AdminDashboardData['users'];
    roles?: AdminDashboardData['roles'];
  };
  events?: {
    auth_activity?: AuthActivityGroup[];
  };
  llm?: {
    models?: AdminDashboardData['llmModels'];
    routes?: AdminDashboardData['llmRoutes'];
    roles?: AdminDashboardData['llmRoles'];
  };
  gpu?: { status?: AdminDashboardData['gpuStatus']; models?: AdminDashboardData['gpuModels'] };
  admin?: {
    settings?: Record<string, unknown>;
    tool_bindings?: AdminDashboardData['toolBindings'];
    service_bindings?: AdminDashboardData['serviceBindings'];
    blocked_ips?: string[];
  };
  incidents?: Array<{ at: string; label: string; severity?: string }>;
};

export type SummaryFetchResult =
  | { status: 'ok'; data: DashboardSummaryResponse }
  | { status: 'not_modified'; data: DashboardSummaryResponse }
  | { status: 'unavailable' };

const DEFAULT_INCLUDE: DashboardSummaryInclude[] = [
  'system',
  'storage',
  'ops',
  'users',
  'events',
];

function unwrapSummaryPayload(res: { data?: unknown; status?: number }): DashboardSummaryResponse | null {
  const payload = (res.data as { data?: DashboardSummaryResponse })?.data ?? (res.data as DashboardSummaryResponse);
  if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
    return payload;
  }
  return null;
}

export const dashboardSummaryService = {
  async getSummary(options?: {
    include?: DashboardSummaryInclude[];
    foldersLimit?: number;
    filesLimit?: number;
    casesLimit?: number;
    etag?: string | null;
    signal?: AbortSignal;
  }): Promise<SummaryFetchResult> {
    const include = (options?.include ?? DEFAULT_INCLUDE).join(',');
    const etag = options?.etag ?? readSummaryEtag();
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;

    try {
      const res = await gatewayClient.get<{ data?: DashboardSummaryResponse }>(
        `/admin/dashboard/summary?include=${include}&folders_limit=${options?.foldersLimit ?? 8}&files_limit=${options?.filesLimit ?? 8}&cases_limit=${options?.casesLimit ?? 8}`,
        { headers, signal: options?.signal, validateStatus: (s) => s === 200 || s === 304 }
      );

      if (res.status === 304) {
        const cached = readSummaryCache<DashboardSummaryResponse>();
        if (cached) return { status: 'not_modified', data: cached };
        return { status: 'unavailable' };
      }

      const payload = unwrapSummaryPayload(res);
      if (!payload) return { status: 'unavailable' };

      writeSummaryCache(payload.meta?.etag, payload);
      return { status: 'ok', data: payload };
    } catch {
      const cached = readSummaryCache<DashboardSummaryResponse>();
      if (cached) return { status: 'not_modified', data: cached };
      return { status: 'unavailable' };
    }
  },
};
