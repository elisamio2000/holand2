import { buildScenarioDashboard, getScenarioDefinition } from '@/app/shared/admin-dashboard/mock/scenario-engine';
import { getDashboardMockScenario } from '@/app/shared/admin-dashboard/config';
import { AUTH_ACTIVITY_FIXTURE } from '@/app/shared/admin-dashboard/mock/fixtures/auth-activity';
import { HYDROGEN_TEMPLATE_WIDGETS } from '@/app/shared/admin-dashboard/hydrogen-layout';
import { buildCarbonLayoutItem } from '@/app/shared/admin-dashboard/carbon-layout';

export function getMswSummaryWithFailedSections(failedSections: string[]) {
  const base = getMswSummaryPayload();
  return {
    ...base,
    body: {
      ...base.body,
      meta: {
        ...base.body.meta,
        partial: failedSections.length > 0,
        failed_sections: failedSections,
      },
    },
  };
}

export function getMswSummaryPayload() {
  const scenario = getDashboardMockScenario();
  const def = getScenarioDefinition(scenario);
  const dashboard = buildScenarioDashboard(scenario);
  const latency = def?.latencyMs ?? 0;

  return {
    latency,
    etag: `"msw-${scenario}"`,
    body: {
      refreshed_at: dashboard.refreshedAt ?? new Date().toISOString(),
      meta: {
        partial: !!dashboard.error,
        failed_sections: dashboard.error ? ['storage'] : [],
        section_timings_ms: { system: 45, storage: 120, ops: 80, users: 30, events: 25 },
        etag: `"msw-${scenario}"`,
        realtime: { mode: 'poll' as const, poll_critical_ms: 30_000, poll_standard_ms: 120_000 },
      },
      system_stats: dashboard.systemStats,
      service_health: dashboard.serviceHealth,
      import_queue: dashboard.queueStatus,
      storage: {
        facets: dashboard.facets
          ? {
              total_count: dashboard.facets.totalCount,
              total_bytes: dashboard.facets.totalBytes,
              media_type: dashboard.facets.mediaType,
              date_histogram: dashboard.facets.dateHistogram,
            }
          : undefined,
        quota: dashboard.quota,
        top_folders: dashboard.folders,
        recent_files: dashboard.recentFiles,
      },
      recent_cases: dashboard.recentCases,
      ops: {
        transfers: dashboard.transferStats,
      },
      users: {
        users: dashboard.users,
        roles: dashboard.roles,
      },
      events: {
        auth_activity: AUTH_ACTIVITY_FIXTURE,
      },
      llm: {
        models: dashboard.llmModels,
        routes: dashboard.llmRoutes,
        roles: dashboard.llmRoles,
      },
      gpu: {
        status: dashboard.gpuStatus,
        models: dashboard.gpuModels,
      },
      admin: {
        settings: dashboard.systemSettings,
        tool_bindings: dashboard.toolBindings,
        service_bindings: dashboard.serviceBindings,
        blocked_ips: dashboard.blockedIps,
      },
    },
  };
}

export function getMswTransferStats() {
  const dashboard = buildScenarioDashboard(getDashboardMockScenario());
  return dashboard.transferStats ?? { series: [], totals: { uploads: 0, downloads: 0 } };
}

export function getMswSessionStats() {
  return { active_sessions: 45, total_sessions: 340, by_device: [{ device: 'desktop', count: 30 }] };
}

export function getMswGraphHealth() {
  return { status: 'healthy', nodes_indexed: 12500, edges_indexed: 48000, last_sync_at: new Date().toISOString() };
}

export function getMswSearchMetrics() {
  return {
    series: [
      { day: '2026-06-07', queries: 420, zero_results: 12 },
      { day: '2026-06-08', queries: 380, zero_results: 8 },
    ],
    totals: { queries: 800, avg_latency_ms: 85 },
  };
}

export function getMswAuthEvents() {
  return { events: AUTH_ACTIVITY_FIXTURE.flatMap((g) =>
    g.threads.map((t, i) => ({
      id: `evt-${g.title}-${i}`,
      type: 'login',
      user: t.username,
      at: new Date().toISOString(),
    }))
  ) };
}

export function getMswDefaultPreferences(userId: string) {
  const visible = HYDROGEN_TEMPLATE_WIDGETS;
  const lg = visible.map((id) => buildCarbonLayoutItem(id));
  const md = lg.map((item) => ({
    ...item,
    w: Math.min(item.w, 10),
    x: item.x >= 6 ? Math.min(5, item.x) : item.x,
  }));
  const sm = visible.map((id, idx) => {
    const base = buildCarbonLayoutItem(id);
    return { ...base, x: 0, w: 6, y: idx * base.h };
  });
  return {
    schema_version: 3 as const,
    layout_engine: 'carbon' as const,
    visible_widgets: visible,
    layouts: { lg, md, sm },
    density: 'comfortable' as const,
    updated_at: new Date().toISOString(),
    userId,
  };
}

export function getMswAuditActivity() {
  return {
    items: [
      { id: 'aud-1', action: 'file.upload', actor: 'admin', at: new Date().toISOString() },
    ],
  };
}

export function getMswTraces() {
  return [
    { trace_id: 'tr-001', status: 'ok', duration_ms: 120, tool_calls: 2 },
  ];
}

export function getMswMyTasks() {
  return {
    items: [
      { id: 'task-1', title: 'Review import queue', status: 'open', due_at: new Date().toISOString(), project_id: null },
    ],
  };
}
