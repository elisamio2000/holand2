// ============================================
// One Search — provider & lane env config
// ============================================

import type {
  OneSearchLaneId,
  OneSearchLaneSourceMode,
  OneSearchProviderId,
} from '@/types/one-search.types';

const LANE_ENV_KEYS: Record<OneSearchLaneId, string> = {
  chat: 'NEXT_PUBLIC_ONE_SEARCH_LANE_CHAT',
  cases: 'NEXT_PUBLIC_ONE_SEARCH_LANE_CASES',
  files: 'NEXT_PUBLIC_ONE_SEARCH_LANE_FILES',
  storage: 'NEXT_PUBLIC_ONE_SEARCH_LANE_STORAGE',
  graph: 'NEXT_PUBLIC_ONE_SEARCH_LANE_GRAPH',
  users: 'NEXT_PUBLIC_ONE_SEARCH_LANE_USERS',
  projects_tasks: 'NEXT_PUBLIC_ONE_SEARCH_LANE_PROJECTS_TASKS',
};

/** User/script preference: auto resolved at startup by check-and-run.ps1 */
export type OneSearchModePref = 'auto' | 'mock' | 'real';

function readEnv(key: string): string | undefined {
  const primary = process.env[key];
  if (primary !== undefined && primary !== '') return primary;
  const legacyKey = key.replace('ONE_SEARCH', 'UNIFIED_SEARCH');
  if (legacyKey !== key) {
    const legacy = process.env[legacyKey];
    if (legacy !== undefined && legacy !== '') return legacy;
  }
  return undefined;
}

/** Legacy global mock flag (development default ON when unset and provider unset). */
export function isOneSearchMockEnabled(): boolean {
  const flag = readEnv('NEXT_PUBLIC_ONE_SEARCH_MOCK');
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  const provider = parseProviderEnv(readEnv('NEXT_PUBLIC_ONE_SEARCH_PROVIDER'));
  if (provider === 'temp-federated' || provider === 'smart-search' || provider === 'gateway-query') {
    return false;
  }
  if (provider === 'mock') return true;
  if (readEnv('NEXT_PUBLIC_API_GATEWAY_URL') || readEnv('API_GATEWAY_URL')) return false;
  return process.env.NODE_ENV === 'development';
}

function parseProviderEnv(value: string | undefined): OneSearchProviderId | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === 'mock') return 'mock';
  if (v === 'temp-federated' || v === 'temp') return 'temp-federated';
  if (v === 'smart-search' || v === 'smart_search') return 'smart-search';
  if (v === 'gateway-query' || v === 'gateway') return 'gateway-query';
  return null;
}

export function getOneSearchModePref(): OneSearchModePref {
  const raw = readEnv('NEXT_PUBLIC_ONE_SEARCH_MODE')?.trim().toLowerCase();
  if (raw === 'mock' || raw === 'real' || raw === 'auto') return raw;
  return 'auto';
}

/** Resolve active provider from env (check-and-run writes final PROVIDER + MOCK). */
export function getOneSearchProviderId(): OneSearchProviderId {
  const explicit = parseProviderEnv(readEnv('NEXT_PUBLIC_ONE_SEARCH_PROVIDER'));
  if (explicit) return explicit;
  if (isOneSearchMockEnabled()) return 'mock';
  return 'smart-search';
}

export function isOneSearchLaneFallbackMockEnabled(): boolean {
  const flag = readEnv('NEXT_PUBLIC_ONE_SEARCH_LANE_FALLBACK_MOCK');
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  // Default off — real-only when smart_search falls back to temp-federated.
  return false;
}

export function parseLaneSourceMode(raw: string | undefined): OneSearchLaneSourceMode {
  const v = raw?.trim().toLowerCase();
  if (v === 'mock') return 'mock';
  if (v === 'off' || v === 'disabled') return 'off';
  return 'real';
}

/** Per-lane override: real | mock | off (default real). */
export function getLaneSourceMode(lane: OneSearchLaneId): OneSearchLaneSourceMode {
  const key = LANE_ENV_KEYS[lane];
  return parseLaneSourceMode(readEnv(key));
}

export function getAllLaneSourceModes(): Record<OneSearchLaneId, OneSearchLaneSourceMode> {
  return {
    chat: getLaneSourceMode('chat'),
    cases: getLaneSourceMode('cases'),
    files: getLaneSourceMode('files'),
    storage: getLaneSourceMode('storage'),
    graph: getLaneSourceMode('graph'),
    users: getLaneSourceMode('users'),
    projects_tasks: getLaneSourceMode('projects_tasks'),
  };
}

export const ONE_SEARCH_SOURCE_TIMEOUT_MS = 25_000;

export const ONE_SEARCH_DEFAULT_LIMIT = 15;

/** smart_search failure → temp-federated: off (default) | limited | full */
export type OneSearchSmartFallbackMode = 'off' | 'limited' | 'full';

function readEnvInt(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getOneSearchSmartFallbackMode(): OneSearchSmartFallbackMode {
  const raw = readEnv('NEXT_PUBLIC_ONE_SEARCH_SMART_FALLBACK')?.trim().toLowerCase();
  if (raw === 'limited' || raw === 'full') return raw;
  return 'off';
}

export function getOneSearchDebounceMs(): number {
  return readEnvInt('NEXT_PUBLIC_ONE_SEARCH_DEBOUNCE_MS', 400);
}

export function getOneSearchScoreDebounceMs(): number {
  return readEnvInt('NEXT_PUBLIC_ONE_SEARCH_SCORE_DEBOUNCE_MS', 600);
}

export function getOneSearchCacheStaleMs(): number {
  return readEnvInt('NEXT_PUBLIC_ONE_SEARCH_CACHE_STALE_MS', 45_000);
}

export function getOneSearchFederatedConcurrency(): number {
  return readEnvInt('NEXT_PUBLIC_ONE_SEARCH_FEDERATED_CONCURRENCY', 3);
}

/** Dev-only backend handoff panels (API footprint, endpoint guide). */
export function isOneSearchDevPanelEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.NEXT_PUBLIC_ONE_SEARCH_DEV_PANELS === 'true';
}

/** Lanes not yet implemented by plugin_smart_search — hidden in live UI. */
export const ONE_SEARCH_LANES_PENDING_BACKEND: OneSearchLaneId[] = ['projects_tasks'];

/** Lane ids shown in UI for the given provider (mock keeps all lanes). */
export function getOneSearchVisibleLaneIds(
  providerId?: OneSearchProviderId
): OneSearchLaneId[] {
  const all: OneSearchLaneId[] = [
    'chat',
    'cases',
    'files',
    'storage',
    'users',
    'graph',
    'projects_tasks',
  ];
  const pid = providerId ?? getOneSearchProviderId();
  if (pid === 'mock') return all;
  return all.filter((l) => !ONE_SEARCH_LANES_PENDING_BACKEND.includes(l));
}
