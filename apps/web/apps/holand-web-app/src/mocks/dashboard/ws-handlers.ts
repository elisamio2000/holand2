import { ws } from 'msw';
import { buildScenarioDashboard } from '@/app/shared/admin-dashboard/mock/scenario-engine';
import { getDashboardMockScenario } from '@/app/shared/admin-dashboard/config';

/** Matches ws://{host}/admin/dashboard/stream with optional query (access_token). */
const dashboardStream = ws.link(/\/admin\/dashboard\/stream(\?.*)?$/);

function buildImportQueuePatch() {
  const dashboard = buildScenarioDashboard(getDashboardMockScenario());
  const queue = dashboard.queueStatus ?? { pending: 0, running: 0, failed: 0, active: 0 };
  return {
    event: 'section_patch',
    section: 'import_queue',
    data: queue,
    refreshed_at: new Date().toISOString(),
  };
}

function buildHealthFlipPatch() {
  return {
    event: 'health_flip',
    service: 'orchestrator',
    healthy: Math.random() > 0.15,
    at: new Date().toISOString(),
  };
}

export const dashboardWsHandlers = [
  dashboardStream.addEventListener('connection', ({ client }) => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const sendQueuePatch = () => {
      client.send(JSON.stringify(buildImportQueuePatch()));
    };

    timeouts.push(setTimeout(sendQueuePatch, 150));
    intervals.push(setInterval(sendQueuePatch, 30_000));
    intervals.push(setInterval(() => {
      client.send(JSON.stringify(buildHealthFlipPatch()));
    }, 45_000));

    client.addEventListener('close', () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    });
  }),
];
