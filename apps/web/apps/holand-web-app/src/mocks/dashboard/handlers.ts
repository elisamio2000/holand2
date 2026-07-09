import { http, HttpResponse, delay } from 'msw';
import { dashboardWsHandlers } from './ws-handlers';
import {
  getMswAuditActivity,
  getMswAuthEvents,
  getMswDefaultPreferences,
  getMswGraphHealth,
  getMswMyTasks,
  getMswSearchMetrics,
  getMswSessionStats,
  getMswSummaryPayload,
  getMswTransferStats,
  getMswTraces,
} from './fixtures';

const GATEWAY =
  process.env.API_GATEWAY_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() ||
  'http://localhost:8000';

function gatewayPath(path: string) {
  return `${GATEWAY}${path}`;
}

const prefsStore = new Map<string, ReturnType<typeof getMswDefaultPreferences>>();

export const dashboardHandlers = [
  http.get(gatewayPath('/admin/dashboard/summary'), async ({ request }) => {
    const { latency, body, etag } = getMswSummaryPayload();
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === body.meta?.etag) {
      return new HttpResponse(null, { status: 304, headers: { ETag: body.meta!.etag! } });
    }
    if (latency > 0) await delay(latency);
    return HttpResponse.json(
      { data: body },
      { headers: { ETag: etag ?? body.meta?.etag ?? '"msw-summary"' } }
    );
  }),

  http.get(gatewayPath('/admin/users/:userId/dashboard-preferences'), ({ params }) => {
    const userId = String(params.userId);
    const stored = prefsStore.get(userId) ?? getMswDefaultPreferences(userId);
    return HttpResponse.json({ data: stored });
  }),

  http.put(gatewayPath('/admin/users/:userId/dashboard-preferences'), async ({ params, request }) => {
    const userId = String(params.userId);
    const body = (await request.json()) as Record<string, unknown>;
    const next = {
      ...getMswDefaultPreferences(userId),
      ...body,
      schema_version: 3 as const,
      updated_at: new Date().toISOString(),
    };
    prefsStore.set(userId, next);
    return HttpResponse.json({ data: next });
  }),

  http.get(gatewayPath('/admin/transfers/stats'), async () => {
    return HttpResponse.json({ data: getMswTransferStats() });
  }),

  http.get(gatewayPath('/admin/sessions/stats'), () => {
    return HttpResponse.json({ data: getMswSessionStats() });
  }),

  http.get(gatewayPath('/admin/events/user'), () => {
    return HttpResponse.json({ data: getMswAuthEvents() });
  }),

  http.get(gatewayPath('/admin/activity/audit'), () => {
    return HttpResponse.json({ data: getMswAuditActivity() });
  }),

  http.get(gatewayPath('/graph/health'), () => {
    return HttpResponse.json({ data: getMswGraphHealth() });
  }),

  http.get(gatewayPath('/search/metrics'), () => {
    return HttpResponse.json({ data: getMswSearchMetrics() });
  }),

  http.get(gatewayPath('/traces'), () => {
    return HttpResponse.json(getMswTraces());
  }),

  http.get(gatewayPath('/tasks/mine'), () => {
    return HttpResponse.json({ data: getMswMyTasks() });
  }),
  ...dashboardWsHandlers,
];
