import { gatewayClient } from '@/lib/api-client';

export type ApiCapabilityStatus = 'live' | 'readonly' | 'unavailable';

export interface ApiCapability {
  id: string;
  label: string;
  method: string;
  path: string;
  status: ApiCapabilityStatus;
  note?: string;
}

const PROBE_TIMEOUT_MS = 4000;

async function probeGet(path: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    await gatewayClient.get(path, { signal: ctrl.signal });
    clearTimeout(t);
    return true;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403 || status === 404) return false;
    return status === 405 ? false : true;
  }
}

export async function probeApiCapabilities(): Promise<ApiCapability[]> {
  const checks: Array<Omit<ApiCapability, 'status'>> = [
    { id: 'tools', label: 'Tool bindings', method: 'GET', path: '/admin/tools/registry' },
    { id: 'routes', label: 'Routes', method: 'GET', path: '/admin/llm/routes' },
    { id: 'roles', label: 'Roles', method: 'GET', path: '/admin/llm/roles' },
    { id: 'models', label: 'Models', method: 'GET', path: '/admin/llm/models?probe=false' },
    { id: 'endpoints', label: 'Endpoints', method: 'GET', path: '/admin/llm/endpoints' },
    { id: 'plugins', label: 'Plugin bindings', method: 'GET', path: '/admin/plugins/bindings' },
    { id: 'services', label: 'Service bindings', method: 'GET', path: '/admin/services/bindings' },
    { id: 'nodes', label: 'Remote nodes', method: 'GET', path: '/admin/nodes/remote?live=false' },
    { id: 'layout', label: 'Board layout persist', method: 'GET', path: '/admin/pipeline/topology/layout' },
  ];

  const results = await Promise.all(
    checks.map(async (c) => {
      if (c.id === 'layout') {
        return { ...c, status: 'unavailable' as ApiCapabilityStatus, note: 'backend_gap' };
      }
      const ok = await probeGet(c.path.split('?')[0] + (c.path.includes('?') ? '?' + c.path.split('?')[1] : ''));
      return { ...c, status: (ok ? 'live' : 'unavailable') as ApiCapabilityStatus };
    })
  );
  return results;
}
