// ============================================
// Node GPU WebSocket utilities
// ============================================

import { getImportWsBaseUrl } from '@/lib/service-urls';

/** Build authenticated WebSocket URL for live GPU snapshots. */
export function buildNodeGpuWsUrl(nodeId: string, accessToken: string): string {
  const base = getImportWsBaseUrl();
  const url = `${base}/admin/nodes/${encodeURIComponent(nodeId)}/gpu/ws`;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}access_token=${encodeURIComponent(accessToken)}`;
}

export function getReconnectDelay(attempt: number, maxMs = 30000): number {
  return Math.min(1000 * 2 ** attempt, maxMs);
}
