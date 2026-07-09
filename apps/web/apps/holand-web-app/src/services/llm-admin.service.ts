// ============================================
// LLM & Tool Routing Admin Service
// Backend: /admin/llm/*, /admin/tools/*
// @deprecated Prefer pipelineAdminService and /admin/pipeline — llm-routing redirects.
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { toApiToolId } from '@/utils/tool-id';

export interface LlmModelRow {
  id: string;
  name: string;
  task: string;
  backend_kind: string;
  is_active: boolean;
  metadata?: string | Record<string, unknown> | null;
}

export interface LlmRouteRow {
  id: string;
  route_key: string;
  model_name: string;
  fallback_model_name?: string | null;
  constraints?: string | Record<string, unknown> | null;
  is_active: boolean;
}

export interface LlmRoleRow {
  route_key: string;
  task: string;
  modality: string;
  title_fa?: string;
  description_fa?: string;
  required?: boolean;
  current_model?: string | null;
  fallback_model_name?: string | null;
  candidate_models?: Array<{
    name: string;
    backend_kind: string;
    is_active: boolean;
    endpoint?: { id: string; name: string; host: string; port: number } | null;
  }>;
  is_assigned?: boolean;
}

export interface ToolRegistryRow {
  tool_id: string;
  plugin_id?: string | null;
  description?: string;
  category?: string;
  enabled?: boolean;
  tags?: string[] | null;
  backend?: string | null;
  uses_llm?: boolean;
  llm_api?: string | null;
  llm_profile?: Record<string, unknown> | null;
  bound_model?: string | null;
  bound_route_key?: string | null;
  bound_fallback_model?: string | null;
  is_bound?: boolean;
}

export interface ToolBindingRequest {
  model: string;
  input_modalities?: string[];
  output_modalities?: string[];
  api?: string | null;
  purpose?: string | null;
  pipeline_tag?: string | null;
  fallback_model?: string | null;
}

export interface ToolLlmSuggestion {
  tool_id: string;
  suggested?: ToolBindingRequest;
  route_key?: string;
  model_name?: string;
  [key: string]: unknown;
}

function parseJsonField<T>(value: string | Record<string, unknown> | null | undefined): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export const llmAdminService = {
  async listModels(): Promise<LlmModelRow[]> {
    const res = await gatewayClient.get<LlmModelRow[]>('/admin/llm/models');
    return Array.isArray(res.data) ? res.data : [];
  },

  async listRoutes(): Promise<LlmRouteRow[]> {
    const res = await gatewayClient.get<LlmRouteRow[]>('/admin/llm/routes');
    return Array.isArray(res.data) ? res.data : [];
  },

  async upsertRoute(payload: {
    route_key: string;
    model_name: string;
    fallback_model_name?: string | null;
    constraints?: Record<string, unknown>;
    is_active?: boolean;
  }): Promise<LlmRouteRow> {
    const res = await gatewayClient.post<LlmRouteRow>('/admin/llm/routes', payload);
    return res.data;
  },

  async listRoles(): Promise<LlmRoleRow[]> {
    const res = await gatewayClient.get<LlmRoleRow[]>('/admin/llm/roles');
    return Array.isArray(res.data) ? res.data : [];
  },

  async assignRoleModel(roleKey: string, modelName: string): Promise<void> {
    await gatewayClient.post(`/admin/llm/roles/${encodeURIComponent(roleKey)}/assign`, {
      model_name: modelName,
    });
  },

  async listToolRegistry(): Promise<ToolRegistryRow[]> {
    const res = await gatewayClient.get('/admin/tools/registry');
    if (Array.isArray(res.data)) return res.data as ToolRegistryRow[];
    const obj = res.data as { data?: ToolRegistryRow[]; count?: number } | null;
    return obj?.data ?? [];
  },

  async getToolBinding(toolId: string): Promise<ToolBindingRequest | null> {
    try {
      const res = await gatewayClient.get<{
        model?: string;
        fallback_model?: string | null;
        api?: string | null;
        input_modalities?: string[];
        output_modalities?: string[];
        pipeline_tag?: string | null;
      }>(`/admin/tools/${encodeURIComponent(toApiToolId(toolId))}/binding`);
      const d = res.data;
      if (!d?.model) return null;
      return {
        model: d.model,
        fallback_model: d.fallback_model ?? null,
        api: d.api ?? 'chat',
        input_modalities: d.input_modalities ?? ['text'],
        output_modalities: d.output_modalities ?? ['text'],
        pipeline_tag: d.pipeline_tag ?? null,
      };
    } catch {
      return null;
    }
  },

  async setToolBinding(toolId: string, binding: ToolBindingRequest): Promise<void> {
    await gatewayClient.put(
      `/admin/tools/${encodeURIComponent(toApiToolId(toolId))}/binding`,
      binding
    );
  },

  async suggestToolLlm(toolId: string): Promise<ToolLlmSuggestion | null> {
    try {
      const res = await gatewayClient.get<ToolLlmSuggestion>(
        `/admin/tools/${encodeURIComponent(toApiToolId(toolId))}/llm-suggestion`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  parseConstraints(route: LlmRouteRow): Record<string, unknown> | null {
    return parseJsonField<Record<string, unknown>>(route.constraints ?? null);
  },

  parseModelMetadata(model: LlmModelRow): Record<string, unknown> | null {
    return parseJsonField<Record<string, unknown>>(model.metadata ?? null);
  },
};
