import { gatewayClient } from '@/lib/api-client';
import type { TopologyLayoutSnapshot } from './topology-board-types';
import { loadTopologyLayout, saveTopologyLayout as saveLocalLayout } from './layout-storage';

const LOG_TAG = '[topology-layout-api]';

/** GET /admin/pipeline/topology/layout — falls back to localStorage when missing. */
export async function fetchServerLayout(): Promise<TopologyLayoutSnapshot | null> {
  try {
    const res = await gatewayClient.get('/admin/pipeline/topology/layout');
    const data = res.data as TopologyLayoutSnapshot;
    if (data?.version === 3) {
      saveLocalLayout(data);
      return data;
    }
  } catch {
    console.info(LOG_TAG, 'Server layout unavailable — using localStorage');
  }
  return loadTopologyLayout();
}

/** PUT /admin/pipeline/topology/layout — always persists locally; server when available. */
export async function persistTopologyLayout(
  snapshot: Partial<TopologyLayoutSnapshot>
): Promise<void> {
  saveLocalLayout(snapshot);
  try {
    const prev = loadTopologyLayout();
    const body = {
      version: 3,
      ...prev,
      ...snapshot,
      updatedAt: new Date().toISOString(),
    };
    await gatewayClient.put('/admin/pipeline/topology/layout', body);
  } catch {
    // localStorage already saved — non-fatal
  }
}

/** POST /admin/pipeline/topology/batch — optional atomic save when backend ready. */
export async function saveTopologyBatch(payload: unknown): Promise<{ ok: boolean; errors?: string[] }> {
  try {
    await gatewayClient.post('/admin/pipeline/topology/batch', payload);
    return { ok: true };
  } catch (err) {
    console.warn(LOG_TAG, 'Batch save unavailable', err);
    return { ok: false, errors: ['batch API unavailable'] };
  }
}

/** GET /admin/pipeline/topology/graph — optional unified hydrate. */
export async function fetchTopologyGraph(): Promise<unknown | null> {
  try {
    const res = await gatewayClient.get('/admin/pipeline/topology/graph');
    return res.data;
  } catch {
    return null;
  }
}
