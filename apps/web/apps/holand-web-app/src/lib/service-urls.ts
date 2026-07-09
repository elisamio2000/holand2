// ============================================
// Service URL resolution — no hardcoded hosts.
// All values come from .env.local (managed by check-and-run.ps1).
// ============================================

const ENV_HINT =
  ' Set missing variables via check-and-run.ps1 (Configuration Wizard) and restart the dev server.';

function trimUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

/** Throw when a required server-side env var is missing or empty. */
export function requireServiceUrl(
  envName: string,
  value: string | undefined
): string {
  const url = trimUrl(value);
  if (!url) {
    throw new Error(`${envName} is not configured.${ENV_HINT}`);
  }
  return url;
}

/** API Gateway — server-side direct calls. */
export function getGatewayUrl(): string {
  return requireServiceUrl(
    'API_GATEWAY_URL',
    process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL
  );
}

/** Tile server — server-side proxy target for /api/tiles/*. */
export function getTileServerUrl(): string {
  return requireServiceUrl('TILE_SERVER_URL', process.env.TILE_SERVER_URL);
}

/** Plugin Executor — server-side only (browser uses /api/plugins/executor proxy). */
export function getPluginExecutorUrl(): string {
  return requireServiceUrl(
    'PLUGIN_EXECUTOR_URL',
    process.env.PLUGIN_EXECUTOR_URL
  );
}

/** TTS backend — server-side proxy target. */
export function getTtsBackendUrl(): string {
  return requireServiceUrl('TTS_BACKEND_URL', process.env.TTS_BACKEND_URL);
}

/** Map Python sidecar — server-side / client via NEXT_PUBLIC_MAP_PY_URL. */
export function getMapPyUrl(): string {
  return requireServiceUrl(
    'NEXT_PUBLIC_MAP_PY_URL',
    process.env.NEXT_PUBLIC_MAP_PY_URL
  );
}

/** Ollama / local LLM upstream for map-chat server route. */
export function getOllamaUrl(): string {
  return requireServiceUrl('OLLAMA_URL', process.env.OLLAMA_URL);
}

/**
 * WebSocket base for import realtime.
 * Prefer NEXT_PUBLIC_WS_BASE; otherwise derive ws:// from gateway URL.
 */
export function getImportWsBaseUrl(): string {
  const explicit = trimUrl(process.env.NEXT_PUBLIC_WS_BASE);
  if (explicit) return explicit;

  const gateway =
    trimUrl(process.env.NEXT_PUBLIC_API_GATEWAY_URL) ||
    trimUrl(process.env.API_GATEWAY_URL);
  if (gateway) {
    return gateway.replace(/^http/i, 'ws');
  }

  throw new Error(
    `NEXT_PUBLIC_WS_BASE or NEXT_PUBLIC_API_GATEWAY_URL is not configured.${ENV_HINT}`
  );
}

/** Local terrain tile template — never use remote DEM providers. */
export function getTerrainTilesUrl(): string {
  return (
    process.env.NEXT_PUBLIC_TERRAIN_URL?.trim() ||
    '/api/tiles/terrain-dem/{z}/{x}/{y}.png'
  );
}

/** Browser-safe executor base — same-origin proxy, no direct host. */
export const PLUGIN_EXECUTOR_PROXY_BASE = '/api/plugins/executor';
