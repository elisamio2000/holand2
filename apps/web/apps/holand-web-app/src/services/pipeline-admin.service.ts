// ============================================
// Pipeline Admin Service — Extended LLM & Tool Management
//
// Extends llm-admin.service.ts with full CRUD for endpoints,
// model discovery, probing, taxonomy, and service bindings.
//
// Backend: /admin/llm/*, /admin/tools/*, /admin/services/*
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { toApiToolId } from '@/utils/tool-id';
import type {
  LlmModel,
  LlmModelMeta,
  LlmEndpoint,
  LlmEndpointCreatePayload,
  LlmEndpointPatchPayload,
  LlmEndpointDiscoverRequest,
  LlmEndpointDiscoverResult,
  LlmEndpointProbeResult,
  ModelImportSpec,
  ModelImportResult,
  LogicalCatalogEntry,
  LlmRoute,
  LlmRouteConstraints,
  LlmRouteUpsertPayload,
  LlmRole,
  ToolRegistryEntry,
  ToolBinding,
  ToolLlmSuggestion,
  LlmTaxonomyEntry,
  ServiceBinding,
  LlmPool,
  LlmPoolPolicy,
  BindingsCatalogEntry,
} from '@/types/pipeline-admin.types';

const LOG_TAG = '[PipelineAdminService]';

/**
 * Safely parse a JSON string field that might already be an object.
 * Many backend fields store JSON as string or object depending on
 * serialization context.
 */
function parseJsonField<T>(
  value: string | Record<string, unknown> | null | undefined
): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Normalize array responses — backend may return { data: T[] } or T[] directly.
 */
function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

// ==========================================
// Service Implementation
// ==========================================

export const pipelineAdminService = {
  // ========================================
  // Models
  // ========================================

  /**
   * List all registered LLM models (KServe + external).
   * @endpoint GET /admin/llm/models
   */
  async listModels(options?: { probe?: boolean }): Promise<LlmModel[]> {
    console.info(LOG_TAG, 'Fetching model list...');
    const probe = options?.probe !== false;
    const res = await gatewayClient.get<LlmModel[]>('/admin/llm/models', {
      params: { probe },
    });
    const models = normalizeArray<LlmModel>(res.data);
    console.info(LOG_TAG, `Models loaded: ${models.length}`);
    return models;
  },

  /**
   * Bulk health map keyed by catalog name.
   * @endpoint GET /admin/llm/health
   */
  async fetchLlmHealth(): Promise<{
    gateway_status?: string;
    models: Record<string, LlmModel['health']>;
    endpoints?: Record<string, unknown>;
  }> {
    const res = await gatewayClient.get<{
      gateway_status?: string;
      models: Record<string, LlmModel['health']>;
      endpoints?: Record<string, unknown>;
    }>('/admin/llm/health');
    return res.data ?? { models: {} };
  },

  /**
   * Merge health snapshots into model rows (for poll refresh).
   */
  mergeModelHealth(
    models: LlmModel[],
    healthMap: Record<string, LlmModel['health']>
  ): LlmModel[] {
    return models.map((m) => ({
      ...m,
      health: healthMap[m.name] ?? m.health ?? null,
    }));
  },

  /**
   * Get a single model by name.
   * @endpoint GET /admin/llm/models/{model_name}
   */
  async getModel(modelName: string): Promise<LlmModel | null> {
    try {
      const res = await gatewayClient.get<LlmModel>(
        `/admin/llm/models/${encodeURIComponent(modelName)}`
      );
      return res.data ?? null;
    } catch {
      console.warn(LOG_TAG, `Model not found: ${modelName}`);
      return null;
    }
  },

  /**
   * Update a model registration.
   * @endpoint PUT /admin/llm/models/{model_name}
   */
  async updateModel(
    modelName: string,
    payload: Partial<LlmModel>
  ): Promise<LlmModel> {
    console.info(LOG_TAG, 'Updating model:', modelName);
    const res = await gatewayClient.put<LlmModel>(
      `/admin/llm/models/${encodeURIComponent(modelName)}`,
      payload
    );
    return res.data;
  },

  /**
   * Delete a model registration.
   * @endpoint DELETE /admin/llm/models/{model_name}
   */
  async deleteModel(modelName: string): Promise<void> {
    console.info(LOG_TAG, 'Deleting model:', modelName);
    await gatewayClient.delete(
      `/admin/llm/models/${encodeURIComponent(modelName)}`
    );
  },

  /**
   * Parse the metadata JSON field from a model row.
   */
  parseModelMeta(model: LlmModel): LlmModelMeta | null {
    return parseJsonField<LlmModelMeta>(model.metadata ?? null);
  },

  // ========================================
  // Endpoints
  // ========================================

  /**
   * List all external LLM endpoints.
   * @endpoint GET /admin/llm/endpoints
   */
  async listEndpoints(): Promise<LlmEndpoint[]> {
    console.info(LOG_TAG, 'Fetching endpoints...');
    const res = await gatewayClient.get('/admin/llm/endpoints');
    return normalizeArray<LlmEndpoint>(res.data);
  },

  /**
   * Create a new external endpoint.
   * @endpoint POST /admin/llm/endpoints
   */
  async createEndpoint(
    payload: LlmEndpointCreatePayload
  ): Promise<LlmEndpoint> {
    console.info(LOG_TAG, 'Creating endpoint:', payload.name);
    const res = await gatewayClient.post<LlmEndpoint>(
      '/admin/llm/endpoints',
      payload
    );
    return res.data;
  },

  /**
   * Delete an endpoint.
   * @endpoint DELETE /admin/llm/endpoints/{id}
   */
  async deleteEndpoint(endpointId: string): Promise<void> {
    console.info(LOG_TAG, 'Deleting endpoint:', endpointId);
    await gatewayClient.delete(
      `/admin/llm/endpoints/${encodeURIComponent(endpointId)}`
    );
  },

  /**
   * Get a single external endpoint.
   * @endpoint GET /admin/llm/endpoints/{id}
   */
  async getEndpoint(endpointId: string): Promise<LlmEndpoint | null> {
    try {
      const res = await gatewayClient.get<LlmEndpoint>(
        `/admin/llm/endpoints/${encodeURIComponent(endpointId)}`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Update an external endpoint (host/port/auth).
   * @endpoint PATCH /admin/llm/endpoints/{id}
   */
  async patchEndpoint(
    endpointId: string,
    patch: LlmEndpointPatchPayload
  ): Promise<LlmEndpoint> {
    console.info(LOG_TAG, 'Patching endpoint:', endpointId);
    const res = await gatewayClient.patch<LlmEndpoint>(
      `/admin/llm/endpoints/${encodeURIComponent(endpointId)}`,
      patch
    );
    return res.data;
  },

  /**
   * Probe an endpoint for health status and latency.
   * @endpoint GET|POST /admin/llm/endpoints/{id}/probe
   */
  async probeEndpoint(
    endpointId: string,
    method: 'GET' | 'POST' = 'GET'
  ): Promise<LlmEndpointProbeResult> {
    console.info(LOG_TAG, 'Probing endpoint:', endpointId, method);
    const path = `/admin/llm/endpoints/${encodeURIComponent(endpointId)}/probe`;
    const res =
      method === 'GET'
        ? await gatewayClient.get<LlmEndpointProbeResult>(path)
        : await gatewayClient.post<LlmEndpointProbeResult>(path);
    return res.data;
  },

  /**
   * Discover models at a URL (read-only probe; does not write DB).
   * @endpoint POST /admin/llm/endpoints/discover
   */
  async discoverEndpoint(
    payload: LlmEndpointDiscoverRequest
  ): Promise<LlmEndpointDiscoverResult> {
    console.info(LOG_TAG, 'Discovering endpoint:', payload.host, payload.port);
    const res = await gatewayClient.post<LlmEndpointDiscoverResult>(
      '/admin/llm/endpoints/discover',
      payload
    );
    return res.data;
  },

  /**
   * @deprecated Use discoverEndpoint({ name, host, port, ... }) — discover is URL-based, not endpoint_id.
   */
  async discoverEndpointModels(
    endpointId: string
  ): Promise<LlmEndpointDiscoverResult> {
    const ep = await this.getEndpoint(endpointId);
    if (!ep) {
      throw new Error('endpoint_not_found');
    }
    return this.discoverEndpoint({
      name: ep.name,
      host: ep.host,
      port: ep.port,
      scheme: typeof ep.scheme === 'string' ? ep.scheme : 'http',
      base_path: typeof ep.base_path === 'string' ? ep.base_path : '',
    });
  },

  /**
   * Import models with logical_id under a registered endpoint.
   * @endpoint POST /admin/llm/endpoints/{id}/import
   */
  async importEndpointModels(
    endpointId: string,
    models: ModelImportSpec[]
  ): Promise<ModelImportResult> {
    console.info(LOG_TAG, 'Importing models from endpoint:', endpointId, models.length);
    const res = await gatewayClient.post<ModelImportResult>(
      `/admin/llm/endpoints/${encodeURIComponent(endpointId)}/import`,
      { models }
    );
    return res.data;
  },

  /**
   * Logical catalog for binding dropdowns.
   * @endpoint GET /admin/llm/catalog
   */
  async listLogicalCatalog(params?: {
    suggest?: boolean;
    input_modalities?: string[];
    output_modalities?: string[];
  }): Promise<LogicalCatalogEntry[]> {
    const res = await gatewayClient.get<unknown>('/admin/llm/catalog', {
      params: {
        suggest: params?.suggest ? 1 : undefined,
        input_modalities: params?.input_modalities?.join(','),
        output_modalities: params?.output_modalities?.join(','),
      },
    });
    return normalizeArray<LogicalCatalogEntry>(res.data);
  },

  // ========================================
  // Routes
  // ========================================

  /**
   * List all LLM route rules.
   * @endpoint GET /admin/llm/routes
   */
  async listRoutes(): Promise<LlmRoute[]> {
    console.info(LOG_TAG, 'Fetching routes...');
    const res = await gatewayClient.get('/admin/llm/routes');
    return normalizeArray<LlmRoute>(res.data);
  },

  /**
   * Create or update a route rule.
   * @endpoint POST /admin/llm/routes
   */
  async upsertRoute(payload: LlmRouteUpsertPayload): Promise<LlmRoute> {
    console.info(LOG_TAG, 'Upserting route:', payload.route_key);
    const res = await gatewayClient.post<LlmRoute>(
      '/admin/llm/routes',
      payload
    );
    return res.data;
  },

  /**
   * Get a single route by key.
   * @endpoint GET /admin/llm/routes/{route_key}
   */
  async getRoute(routeKey: string): Promise<LlmRoute | null> {
    try {
      const res = await gatewayClient.get<LlmRoute>(
        `/admin/llm/routes/${encodeURIComponent(routeKey)}`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Update a route rule.
   * @endpoint PUT /admin/llm/routes/{route_key}
   */
  async updateRoute(
    routeKey: string,
    payload: Partial<LlmRouteUpsertPayload>
  ): Promise<LlmRoute> {
    console.info(LOG_TAG, 'Updating route:', routeKey);
    const res = await gatewayClient.put<LlmRoute>(
      `/admin/llm/routes/${encodeURIComponent(routeKey)}`,
      payload
    );
    return res.data;
  },

  /**
   * Delete a route rule.
   * @endpoint DELETE /admin/llm/routes/{route_key}
   */
  async deleteRoute(routeKey: string): Promise<void> {
    console.info(LOG_TAG, 'Deleting route:', routeKey);
    await gatewayClient.delete(
      `/admin/llm/routes/${encodeURIComponent(routeKey)}`
    );
  },

  /**
   * Parse constraints JSON from a route row.
   */
  parseConstraints(route: LlmRoute): LlmRouteConstraints | null {
    return parseJsonField<LlmRouteConstraints>(route.constraints ?? null);
  },

  // ========================================
  // Roles
  // ========================================

  /**
   * List all semantic chat roles.
   * @endpoint GET /admin/llm/roles
   */
  async listRoles(): Promise<LlmRole[]> {
    console.info(LOG_TAG, 'Fetching roles...');
    const res = await gatewayClient.get('/admin/llm/roles');
    return normalizeArray<LlmRole>(res.data);
  },

  /**
   * Get details of a single role.
   * @endpoint GET /admin/llm/roles/{role_key}
   */
  async getRole(roleKey: string): Promise<LlmRole | null> {
    try {
      const res = await gatewayClient.get<LlmRole>(
        `/admin/llm/roles/${encodeURIComponent(roleKey)}`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Update a role configuration.
   * @endpoint PUT /admin/llm/roles/{role_key}
   */
  async updateRole(
    roleKey: string,
    payload: Partial<LlmRole>
  ): Promise<LlmRole> {
    console.info(LOG_TAG, 'Updating role:', roleKey);
    const res = await gatewayClient.put<LlmRole>(
      `/admin/llm/roles/${encodeURIComponent(roleKey)}`,
      payload
    );
    return res.data;
  },

  /**
   * Assign a model to a chat role.
   * @endpoint POST /admin/llm/roles/{role_key}/assign
   */
  async assignRoleModel(
    roleKey: string,
    modelName: string
  ): Promise<void> {
    console.info(LOG_TAG, `Assigning model "${modelName}" to role "${roleKey}"`);
    await gatewayClient.post(
      `/admin/llm/roles/${encodeURIComponent(roleKey)}/assign`,
      { model_name: modelName }
    );
  },

  // ========================================
  // Tool Registry & Binding
  // ========================================

  /**
   * List all tools from the registry.
   * @endpoint GET /admin/tools/registry
   */
  async listToolRegistry(): Promise<ToolRegistryEntry[]> {
    console.info(LOG_TAG, 'Fetching tool registry...');
    const res = await gatewayClient.get('/admin/tools/registry');
    return normalizeArray<ToolRegistryEntry>(res.data);
  },

  /**
   * Get the current model binding for a tool.
   * @endpoint GET /admin/tools/{tool_id}/binding
   */
  async getToolBinding(toolId: string): Promise<ToolBinding | null> {
    try {
      const res = await gatewayClient.get<ToolBinding>(
        `/admin/tools/${encodeURIComponent(toApiToolId(toolId))}/binding`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Set/update the model binding for a tool.
   * @endpoint PUT /admin/tools/{tool_id}/binding
   */
  async setToolBinding(
    toolId: string,
    binding: ToolBinding
  ): Promise<void> {
    console.info(LOG_TAG, `Setting binding for tool "${toolId}":`, binding.model);
    await gatewayClient.put(
      `/admin/tools/${encodeURIComponent(toApiToolId(toolId))}/binding`,
      binding
    );
  },

  /**
   * Get server suggestion for best model for a tool.
   * @endpoint GET /admin/tools/{tool_id}/llm-suggestion
   */
  async suggestToolModel(
    toolId: string
  ): Promise<ToolLlmSuggestion | null> {
    try {
      const res = await gatewayClient.get<ToolLlmSuggestion>(
        `/admin/tools/${encodeURIComponent(toApiToolId(toolId))}/llm-suggestion`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * List all tool-to-model bindings at once.
   * @endpoint GET /admin/tools/bindings
   */
  async listAllBindings(): Promise<Record<string, ToolBinding>> {
    try {
      const res = await gatewayClient.get('/admin/tools/bindings');
      if (res.data && typeof res.data === 'object') {
        return res.data as Record<string, ToolBinding>;
      }
      return {};
    } catch {
      return {};
    }
  },

  // ========================================
  // Plugin Bindings
  // ========================================

  /**
   * List all plugin-level bindings.
   * @endpoint GET /admin/plugins/bindings
   */
  async listPluginBindings(): Promise<Record<string, ToolBinding>> {
    try {
      const res = await gatewayClient.get('/admin/plugins/bindings');
      if (res.data && typeof res.data === 'object') {
        return res.data as Record<string, ToolBinding>;
      }
      return {};
    } catch {
      return {};
    }
  },

  /**
   * Get binding for a specific plugin.
   * @endpoint GET /admin/plugins/{plugin_id}/binding
   */
  async getPluginBinding(pluginId: string): Promise<ToolBinding | null> {
    try {
      const res = await gatewayClient.get<ToolBinding>(
        `/admin/plugins/${encodeURIComponent(pluginId)}/binding`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Set binding for a specific plugin.
   * @endpoint PUT /admin/plugins/{plugin_id}/binding
   */
  async setPluginBinding(
    pluginId: string,
    binding: ToolBinding
  ): Promise<void> {
    console.info(LOG_TAG, `Setting plugin binding: ${pluginId} → ${binding.model}`);
    await gatewayClient.put(
      `/admin/plugins/${encodeURIComponent(pluginId)}/binding`,
      binding
    );
  },

  // ========================================
  // Taxonomy
  // ========================================

  /**
   * Get HF-style modality taxonomy.
   * @endpoint GET /admin/llm/taxonomy
   */
  async getTaxonomy(): Promise<LlmTaxonomyEntry[]> {
    try {
      const res = await gatewayClient.get('/admin/llm/taxonomy');
      return normalizeArray<LlmTaxonomyEntry>(res.data);
    } catch {
      return [];
    }
  },

  // ========================================
  // Service Bindings
  // ========================================

  /**
   * List all service-level bindings (orchestrator, tool-runner, etc.).
   * @endpoint GET /admin/services/bindings
   */
  async listServiceBindings(): Promise<ServiceBinding[]> {
    try {
      const res = await gatewayClient.get('/admin/services/bindings');
      return normalizeArray<ServiceBinding>(res.data);
    } catch {
      return [];
    }
  },

  /**
   * Get/set binding for a specific service+purpose pair.
   * @endpoint GET /admin/services/{service}/{purpose}/binding
   */
  async getServiceBinding(
    service: string,
    purpose: string
  ): Promise<ServiceBinding | null> {
    try {
      const res = await gatewayClient.get<ServiceBinding>(
        `/admin/services/${encodeURIComponent(service)}/${encodeURIComponent(purpose)}/binding`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Update binding for a specific service+purpose pair.
   * @endpoint PUT /admin/services/{service}/{purpose}/binding
   */
  async setServiceBinding(
    service: string,
    purpose: string,
    binding: {
      model: string;
      fallback_model?: string | null;
      constraints?: Record<string, unknown>;
    }
  ): Promise<void> {
    console.info(LOG_TAG, `Setting service binding: ${service}/${purpose} → ${binding.model}`);
    await gatewayClient.put(
      `/admin/services/${encodeURIComponent(service)}/${encodeURIComponent(purpose)}/binding`,
      binding
    );
  },

  /**
   * Flat list of tool bindings for connection table UI.
   */
  async listToolBindings(): Promise<
    Array<{
      tool_id: string;
      model?: string;
      fallback_model?: string | null;
      api?: string | null;
    }>
  > {
    const map = await this.listAllBindings();
    return Object.entries(map).map(([tool_id, b]) => ({
      tool_id,
      model: b.model,
      fallback_model: b.fallback_model ?? null,
      api: b.api ?? null,
    }));
  },

  parseRouteConstraints(route: LlmRoute): Record<string, unknown> | null {
    return parseJsonField<Record<string, unknown>>(route.constraints ?? null);
  },

  /**
   * Logical model pools with node replicas.
   * @endpoint GET /admin/llm/pools
   */
  async listPools(): Promise<LlmPool[]> {
    const res = await gatewayClient.get<unknown>('/admin/llm/pools');
    return normalizeArray<LlmPool>(res.data);
  },

  /**
   * Pool routing policies (read-only in UI until editor ships).
   * @endpoint GET /admin/llm/pool-policies
   */
  async listPoolPolicies(): Promise<LlmPoolPolicy[]> {
    try {
      const res = await gatewayClient.get<unknown>('/admin/llm/pool-policies');
      return normalizeArray<LlmPoolPolicy>(res.data);
    } catch {
      return [];
    }
  },

  async createPoolPolicy(payload: LlmPoolPolicy): Promise<LlmPoolPolicy | null> {
    try {
      const res = await gatewayClient.post<LlmPoolPolicy>('/admin/llm/pool-policies', payload);
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  async deletePoolPolicy(logicalId: string): Promise<boolean> {
    try {
      await gatewayClient.delete(
        `/admin/llm/pool-policies/${encodeURIComponent(logicalId)}`
      );
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Unified binding catalog (service/tool/plugin slots).
   * @endpoint GET /admin/llm/bindings/catalog
   */
  async listBindingsCatalog(): Promise<BindingsCatalogEntry[]> {
    const res = await gatewayClient.get<unknown>('/admin/llm/bindings/catalog');
    return normalizeArray<BindingsCatalogEntry>(res.data);
  },

  /** Whether a model is referenced by routes, bindings, or catalog slots. */
  modelHasReferences(
    modelName: string,
    ctx: {
      routes: LlmRoute[];
      bindings: Record<string, ToolBinding>;
      bindingsCatalog?: BindingsCatalogEntry[];
    }
  ): boolean {
    const inRoutes = ctx.routes.some(
      (r) =>
        r.model_name === modelName || r.fallback_model_name === modelName
    );
    if (inRoutes) return true;
    const inBindings = Object.values(ctx.bindings).some(
      (b) => b.model === modelName || b.fallback_model === modelName
    );
    if (inBindings) return true;
    if (ctx.bindingsCatalog) {
      return ctx.bindingsCatalog.some(
        (e) =>
          e.bound_model === modelName || e.fallback_model === modelName
      );
    }
    return false;
  },

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Fetch all pipeline config in a single parallel call.
   * Used by PipelineAdminView to load initial state.
   */
  async loadAll(): Promise<{
    models: LlmModel[];
    endpoints: LlmEndpoint[];
    routes: LlmRoute[];
    roles: LlmRole[];
    tools: ToolRegistryEntry[];
    bindings: Record<string, ToolBinding>;
    pools: LlmPool[];
    bindingsCatalog: BindingsCatalogEntry[];
  }> {
    console.info(LOG_TAG, 'Loading all pipeline config...');
    const [models, endpoints, routes, roles, tools, bindings, pools, bindingsCatalog] =
      await Promise.all([
        this.listModels().catch(() => [] as LlmModel[]),
        this.listEndpoints().catch(() => [] as LlmEndpoint[]),
        this.listRoutes().catch(() => [] as LlmRoute[]),
        this.listRoles().catch(() => [] as LlmRole[]),
        this.listToolRegistry().catch(() => [] as ToolRegistryEntry[]),
        this.listAllBindings().catch(
          () => ({}) as Record<string, ToolBinding>
        ),
        this.listPools().catch(() => [] as LlmPool[]),
        this.listBindingsCatalog().catch(() => [] as BindingsCatalogEntry[]),
      ]);
    console.info(LOG_TAG, 'All config loaded:', {
      models: models.length,
      endpoints: endpoints.length,
      routes: routes.length,
      roles: roles.length,
      tools: tools.length,
      bindings: Object.keys(bindings).length,
      pools: pools.length,
      bindingsCatalog: bindingsCatalog.length,
    });
    return { models, endpoints, routes, roles, tools, bindings, pools, bindingsCatalog };
  },

  /** loadAll + health enrichment for board hydrate v2. */
  async loadAllV2(): Promise<{
    models: LlmModel[];
    endpoints: LlmEndpoint[];
    routes: LlmRoute[];
    roles: LlmRole[];
    tools: ToolRegistryEntry[];
    bindings: Record<string, ToolBinding>;
    pools: LlmPool[];
    bindingsCatalog: BindingsCatalogEntry[];
    health: {
      gateway_status?: string;
      models: Record<string, LlmModel['health']>;
      endpoints?: Record<string, unknown>;
    } | null;
  }> {
    const [base, health] = await Promise.all([
      this.loadAll(),
      this.fetchLlmHealth().catch(() => null),
    ]);
    const healthMap = health?.models ?? {};
    const models = base.models.map((m) => {
      const h = healthMap[m.name];
      return h ? { ...m, health: { ...m.health, ...h } } : m;
    });
    return { ...base, models, health };
  },
};
