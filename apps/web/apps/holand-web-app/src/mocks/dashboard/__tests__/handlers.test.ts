import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { dashboardMswServer } from '../server';
import { safeParseSummary } from '@/app/shared/admin-dashboard/catalog/schemas/dashboard-api.schemas';

const GATEWAY =
  process.env.API_GATEWAY_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() ||
  'http://localhost:8000';

beforeAll(() => dashboardMswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => dashboardMswServer.resetHandlers());
afterAll(() => dashboardMswServer.close());

describe('dashboard MSW handlers', () => {
  it('summary response matches Zod schema', async () => {
    const res = await fetch(`${GATEWAY}/admin/dashboard/summary`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { data?: unknown };
    const parsed = safeParseSummary(json.data ?? json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.system_stats).toBeTruthy();
      expect(parsed.data.import_queue).toBeTruthy();
      expect(parsed.data.meta?.realtime?.mode).toBe('poll');
    }
  });

  it('returns 304 when If-None-Match matches etag', async () => {
    const first = await fetch(`${GATEWAY}/admin/dashboard/summary`);
    const json = (await first.json()) as { data?: { meta?: { etag?: string } } };
    const etag = json.data?.meta?.etag ?? first.headers.get('ETag');
    expect(etag).toBeTruthy();

    const second = await fetch(`${GATEWAY}/admin/dashboard/summary`, {
      headers: { 'If-None-Match': etag! },
    });
    expect(second.status).toBe(304);
  });

  it('preferences PUT returns updated_at', async () => {
    const res = await fetch(`${GATEWAY}/admin/users/u1/dashboard-preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema_version: 3, visible_widgets: ['system-kpi-strip'] }),
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { data?: { updated_at?: string } };
    expect(json.data?.updated_at).toBeTruthy();
  });

  it('P2 graph health handler returns healthy status', async () => {
    const res = await fetch(`${GATEWAY}/graph/health`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { data?: { status?: string } };
    expect(json.data?.status).toBe('healthy');
  });
});
