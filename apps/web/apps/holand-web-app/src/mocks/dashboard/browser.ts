import { setupWorker } from 'msw/browser';
import { dashboardHandlers } from './handlers';

export async function startDashboardMsw() {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_DASHBOARD_MSW !== 'true') return;
  const worker = setupWorker(...dashboardHandlers);
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
}
