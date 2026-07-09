// ============================================
// Chat plugin model — GET /admin/llm/routes (orchestrator chat route)
// ============================================

import type { ModelInfo, ChatModelsSnapshot } from '@/types/chat.types';

/** Gateway route for orchestrator chat (see GET /admin/llm/routes) */
export const CHAT_ORCHESTRATOR_ROUTE_KEY = 'service.orchestrator.chat';

/** Row from GET /admin/llm/routes */
export interface AdminLlmRouteRow {
  id?: string;
  route_key: string;
  model_name: string;
  fallback_model_name?: string | null;
  constraints?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Row from GET /admin/llm/models (optional display enrichment) */
export interface AdminLlmModelRow {
  name: string;
  external_model_id?: string | null;
  task?: string;
  backend_kind?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

function normalizeAdminRouteRow(raw: unknown): AdminLlmRouteRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const route_key = typeof o.route_key === 'string' ? o.route_key : '';
  const model_name = typeof o.model_name === 'string' ? o.model_name : '';
  if (!route_key || !model_name) return null;
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    route_key,
    model_name,
    fallback_model_name:
      typeof o.fallback_model_name === 'string' ? o.fallback_model_name : null,
    constraints: typeof o.constraints === 'string' ? o.constraints : undefined,
    is_active: typeof o.is_active === 'boolean' ? o.is_active : undefined,
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
  };
}

/** Parse GET /admin/llm/routes response. */
export function parseAdminLlmRoutesPayload(data: unknown): AdminLlmRouteRow[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map(normalizeAdminRouteRow)
      .filter((r): r is AdminLlmRouteRow => r !== null);
  }
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const list =
      (Array.isArray(o.routes) && o.routes) ||
      (Array.isArray(o.data) && o.data) ||
      (Array.isArray(o.items) && o.items) ||
      [];
    return list
      .map(normalizeAdminRouteRow)
      .filter((r): r is AdminLlmRouteRow => r !== null);
  }
  return [];
}

/** Active route for orchestrator chat plugin. */
export function findChatOrchestratorRoute(
  routes: AdminLlmRouteRow[]
): AdminLlmRouteRow | null {
  const match = routes.find(
    (r) =>
      r.route_key === CHAT_ORCHESTRATOR_ROUTE_KEY && r.is_active !== false
  );
  return match ?? null;
}

function normalizeAdminModelRow(raw: unknown): AdminLlmModelRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name =
    (typeof o.name === 'string' && o.name) ||
    (typeof o.model_name === 'string' && o.model_name) ||
    '';
  if (!name) return null;
  return {
    name,
    external_model_id:
      typeof o.external_model_id === 'string' ? o.external_model_id : null,
    task: typeof o.task === 'string' ? o.task : undefined,
    backend_kind:
      typeof o.backend_kind === 'string' ? o.backend_kind : undefined,
    is_active: typeof o.is_active === 'boolean' ? o.is_active : undefined,
    metadata:
      o.metadata && typeof o.metadata === 'object'
        ? (o.metadata as Record<string, unknown>)
        : null,
  };
}

export function parseAdminLlmModelsPayload(data: unknown): AdminLlmModelRow[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map(normalizeAdminModelRow)
      .filter((m): m is AdminLlmModelRow => m !== null);
  }
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const list =
      (Array.isArray(o.models) && o.models) ||
      (Array.isArray(o.data) && o.data) ||
      (Array.isArray(o.items) && o.items) ||
      [];
    return list
      .map(normalizeAdminModelRow)
      .filter((m): m is AdminLlmModelRow => m !== null);
  }
  return [];
}

export function matchRegisteredModel(
  id: string,
  registered: AdminLlmModelRow[]
): AdminLlmModelRow | undefined {
  if (!id) return undefined;
  const byName = new Map(registered.map((m) => [m.name, m]));
  if (byName.has(id)) return byName.get(id);
  return registered.find(
    (m) =>
      m.external_model_id === id ||
      m.name === id ||
      m.name.includes(id) ||
      id.includes(m.name)
  );
}

function displayFromRegistry(row: AdminLlmModelRow | undefined): string {
  if (!row) return '';
  const meta = row.metadata;
  if (meta && typeof meta === 'object') {
    const label =
      (typeof meta.display_name === 'string' && meta.display_name) ||
      (typeof meta.label === 'string' && meta.label) ||
      (typeof meta.title_fa === 'string' && meta.title_fa) ||
      '';
    if (label.trim()) return label.trim();
  }
  if (row.external_model_id?.trim()) return row.external_model_id.trim();
  return row.name;
}

/**
 * Resolve chat model from `service.orchestrator.chat` route (+ optional registry label).
 */
export function resolveChatPluginModel(input: {
  chatRoute: AdminLlmRouteRow | null;
  registeredModels: AdminLlmModelRow[];
}): ChatModelsSnapshot {
  const route = input.chatRoute;
  if (!route || route.is_active === false) {
    return { models: [], defaultModel: '', resolved: false };
  }

  const modelId =
    route.model_name?.trim() ||
    (typeof route.fallback_model_name === 'string'
      ? route.fallback_model_name.trim()
      : '') ||
    '';

  if (!modelId) {
    return { models: [], defaultModel: '', resolved: false };
  }

  const registered = input.registeredModels.filter((m) => m.is_active !== false);
  const reg = matchRegisteredModel(modelId, registered);
  const display_name = displayFromRegistry(reg) || modelId;

  const model: ModelInfo = {
    id: modelId,
    object: 'model',
    owned_by: 'platform',
    display_name,
    route_key: route.route_key,
  };

  return {
    models: [model],
    defaultModel: modelId,
    resolved: true,
  };
}

export function getModelDisplayLabel(
  model: ModelInfo | undefined,
  fallbackId?: string
): string {
  if (!model) return fallbackId?.trim() || '';
  const dn = model.display_name;
  if (typeof dn === 'string' && dn.trim()) return dn.trim();
  return model.id;
}

/** Parse OpenAI-style GET /v1/models or GET /gpu/models list */
export function parseGatewayModelsList(data: unknown): ModelInfo[] {
  if (!data) return [];
  const rawList = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null
      ? (Array.isArray((data as Record<string, unknown>).data) &&
          (data as { data: unknown[] }).data) ||
        (Array.isArray((data as Record<string, unknown>).models) &&
          (data as { models: unknown[] }).models) ||
        (Array.isArray((data as Record<string, unknown>).items) &&
          (data as { items: unknown[] }).items) ||
        []
      : [];

  const models: ModelInfo[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id =
      (typeof o.id === 'string' && o.id) ||
      (typeof o.name === 'string' && o.name) ||
      (typeof o.model_name === 'string' && o.model_name) ||
      '';
    if (!id) continue;
    const display_name =
      (typeof o.display_name === 'string' && o.display_name) ||
      (typeof o.title === 'string' && o.title) ||
      undefined;
    models.push({
      id,
      object: 'model',
      owned_by: typeof o.owned_by === 'string' ? o.owned_by : 'platform',
      display_name,
    });
  }
  return models;
}

/** Merge model lists by id; primary wins for display_name */
export function mergeChatModelLists(
  primary: ModelInfo[],
  ...extras: ModelInfo[][]
): ModelInfo[] {
  const map = new Map<string, ModelInfo>();
  for (const list of [primary, ...extras]) {
    for (const m of list) {
      if (!m.id) continue;
      const existing = map.get(m.id);
      map.set(m.id, existing ? { ...m, ...existing, display_name: existing.display_name || m.display_name } : m);
    }
  }
  return Array.from(map.values());
}

export const CHAT_PREFERRED_MODEL_STORAGE_KEY = 'ai-chat-preferred-model';
