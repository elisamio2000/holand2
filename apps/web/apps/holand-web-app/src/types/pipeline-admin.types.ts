// ============================================
// Pipeline Admin Types — Model, Endpoint, Route, Role, Tool Binding
// Used by: pipeline-admin.service.ts, admin-pipeline/* components
// API: /admin/llm/*, /admin/tools/*
// ============================================

// ==========================================
// LLM Models
// ==========================================

/** Registered model from GET /admin/llm/models */
export interface LlmModelHealth {
  healthy: boolean | null;
  enabled?: boolean;
  last_error?: string | null;
  latency_ms?: number | null;
  checked_at?: string | null;
  checked_ago_sec?: number | null;
  source?: 'live' | 'probe' | 'last_probe' | 'registry' | 'unknown' | string;
}

/** Registered model from GET /admin/llm/models */
export interface LlmModel {
  id: string;
  name: string;
  task: string;
  backend_kind: 'kserve' | 'external' | string;
  is_active: boolean;
  metadata?: string | Record<string, unknown> | null;
  health?: LlmModelHealth | null;
  node_id?: string | null;
  logical_id?: string | null;
  upstream_model?: string | null;
  endpoint_name?: string | null;
  origin?: 'external-import' | 'node-auto' | 'kserve' | string | null;
  kind?: 'external_link' | 'managed_node' | string | null;
  control_plane?: 'full' | 'readonly' | string | null;
}

/** Parsed model metadata (after JSON parse from string field) */
export interface LlmModelMeta {
  api?: string;
  modalities?: string[];
  pipeline_tag?: string;
  endpoint_id?: string;
  endpoint_name?: string;
  host?: string;
  port?: number;
  [key: string]: unknown;
}

// ==========================================
// External Endpoints
// ==========================================

/** External LLM endpoint from GET /admin/llm/endpoints */
export interface LlmEndpoint {
  id: string;
  name: string;
  host: string;
  port: number;
  api_type?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  models_count?: number;
  [key: string]: unknown;
}

/** Payload for POST /admin/llm/endpoints/discover */
export interface LlmEndpointDiscoverRequest {
  name: string;
  host: string;
  port: number;
  scheme?: string;
  base_path?: string;
  bearer_token?: string | null;
  timeout_s?: number;
}

/** Payload for POST /admin/llm/endpoints */
export interface LlmEndpointCreatePayload {
  name: string;
  host: string;
  port: number;
  scheme?: string;
  base_path?: string;
  api_type?: string;
  auth?: { type?: string; token?: string | null };
  capabilities?: { openai_compat?: boolean; [key: string]: unknown };
  last_probe?: {
    healthy?: boolean;
    latency_ms?: number;
    models_count?: number;
    [key: string]: unknown;
  };
  is_active?: boolean;
}

/** PATCH /admin/llm/endpoints/{id} */
export interface LlmEndpointPatchPayload {
  name?: string;
  host?: string;
  port?: number;
  scheme?: string;
  base_path?: string;
  auth?: { type?: string; token?: string | null };
  is_active?: boolean;
}

/** Result of POST /admin/llm/endpoints/discover */
export interface LlmEndpointDiscoverResult {
  healthy: boolean;
  latency_ms?: number | null;
  error?: string | null;
  status_code?: number;
  openai_compat?: boolean;
  v2_protocol?: boolean;
  base_url?: string;
  models: DiscoveredModel[];
  probes?: Record<string, unknown>;
  endpoint_id?: string;
  [key: string]: unknown;
}

/** A model found during endpoint discovery */
export interface DiscoveredModel {
  id: string;
  name?: string;
  source?: string;
  max_model_len?: number;
  owned_by?: string;
  task?: string;
  ready?: boolean;
  [key: string]: unknown;
}

/** Per-model import spec for POST .../import */
export interface ModelImportSpec {
  upstream_model_id: string;
  logical_id: string;
  display_name?: string;
  description?: string;
  tags?: string[];
  pipeline_tag?: string;
  task?: string;
  conversational?: boolean;
  input_modalities?: string[];
  output_modalities?: string[];
  supports_tools?: boolean;
  supports_streaming?: boolean;
  supports_vision?: boolean;
  priority?: number;
}

/** Result row from POST .../import */
export interface ModelImportResultRow {
  logical_id: string;
  physical_name?: string;
  ok: boolean;
  error?: string | null;
  row?: Record<string, unknown>;
}

/** Result of POST /admin/llm/endpoints/{id}/import */
export interface ModelImportResult {
  imported: number;
  total: number;
  results: ModelImportResultRow[];
}

/** Entry from GET /admin/llm/catalog?suggest=1 */
export interface LogicalCatalogEntry {
  logical_id: string;
  display_name?: string;
  task?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  supports_tools?: boolean;
  [key: string]: unknown;
}

/** Result of POST /admin/llm/endpoints/{id}/probe */
export interface LlmEndpointProbeResult {
  healthy: boolean;
  latency_ms?: number;
  error?: string;
  models_available?: number;
  [key: string]: unknown;
}

// ==========================================
// Routes
// ==========================================

/** LLM route rule from GET /admin/llm/routes */
export interface LlmRoute {
  id: string;
  route_key: string;
  model_name: string;
  fallback_model_name?: string | null;
  constraints?: string | Record<string, unknown> | null;
  is_active: boolean;
}

/** Parsed constraints from a route (after JSON parse from string field) */
export interface LlmRouteConstraints {
  api?: string;
  purpose?: string;
  modalities?: string[];
  [key: string]: unknown;
}

/** Payload for POST /admin/llm/routes (create/update) */
export interface LlmRouteUpsertPayload {
  route_key: string;
  model_name: string;
  fallback_model_name?: string | null;
  constraints?: Record<string, unknown>;
  is_active?: boolean;
}

// ==========================================
// Roles
// ==========================================

/** Semantic chat role from GET /admin/llm/roles */
export interface LlmRole {
  route_key: string;
  task: string;
  modality: string;
  title_fa?: string;
  description_fa?: string;
  required?: boolean;
  current_model?: string | null;
  fallback_model_name?: string | null;
  candidate_models?: LlmRoleCandidateModel[];
  is_assigned?: boolean;
}

/** A candidate model available for a role */
export interface LlmRoleCandidateModel {
  name: string;
  backend_kind: string;
  is_active: boolean;
  endpoint?: {
    id: string;
    name: string;
    host: string;
    port: number;
  } | null;
}

// ==========================================
// Tool Registry & Binding
// ==========================================

/** Tool entry from GET /admin/tools/registry */
export interface ToolRegistryEntry {
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

/** Tool-to-model binding from GET/PUT /admin/tools/{id}/binding */
export interface ToolBinding {
  model: string;
  input_modalities?: string[];
  output_modalities?: string[];
  api?: string | null;
  purpose?: string | null;
  pipeline_tag?: string | null;
  fallback_model?: string | null;
}

/** Server suggestion for tool-model binding from GET /admin/tools/{id}/llm-suggestion */
export interface ToolLlmSuggestion {
  tool_id: string;
  suggested?: ToolBinding;
  route_key?: string;
  model_name?: string;
  [key: string]: unknown;
}

// ==========================================
// Taxonomy
// ==========================================

/** HF-style taxonomy entry from GET /admin/llm/taxonomy */
export interface LlmTaxonomyEntry {
  pipeline_tag?: string;
  modalities?: string[];
  description?: string;
  [key: string]: unknown;
}

// ==========================================
// Pipeline Tabs Enum (for UI navigation)
// ==========================================

export type PipelineTabKey =
  | 'overview'
  | 'models'
  | 'endpoints'
  | 'topology'
  | 'simulator';

/** @deprecated Legacy URL aliases — handled by pipeline-tab-url redirect layer */
export type LegacyPipelineTabKey = 'roles' | 'routes' | 'tools' | 'board';

/** @deprecated Prefer TopologyLens — kept for board store hydration */
export type TopologyViewMode = 'list' | 'board';

/** Canonical topology presentation lens */
export type TopologyLens = 'graph' | 'table';

/** Table filter segment (bindings folded into tools drawer) */
export type TopologyFilter = 'all' | 'routes' | 'tools' | 'roles' | 'bindings';

/** Table row density */
export type TopologyDensity = 'compact' | 'comfortable';

/** @deprecated Prefer TopologyFilter — kept for section components */
export type TopologyListSection = 'routes' | 'tools' | 'bindings' | 'assign';

/** Logical pool from GET /admin/llm/pools */
export interface LlmPoolReplica {
  name?: string;
  node_id: string;
  is_active?: boolean;
  inference_url?: string | null;
  priority?: number | null;
  [key: string]: unknown;
}

export interface LlmPool {
  logical_id: string;
  model_name?: string;
  replicas?: LlmPoolReplica[];
  [key: string]: unknown;
}

/** Pool routing policy from GET /admin/llm/pool-policies (read-only in UI) */
export interface LlmPoolPolicy {
  logical_id?: string;
  strategy?: string;
  prefer_external?: boolean;
  [key: string]: unknown;
}

/** Binding slot from GET /admin/llm/bindings/catalog */
export interface BindingsCatalogEntry {
  slot_id?: string;
  tool_id?: string;
  service?: string;
  consumer_type?: string;
  consumer_id?: string;
  slot?: string;
  route_key?: string;
  bound_model?: string | null;
  fallback_model?: string | null;
  required?: boolean;
  is_bound?: boolean;
  label_fa?: string;
  modalities?: string[];
  api?: string;
  kind?: 'tool' | 'service' | 'plugin' | string;
  [key: string]: unknown;
}

// ==========================================
// Service Bindings
// ==========================================

/** Service-level binding from GET /admin/services/bindings */
export interface ServiceBinding {
  service: string;
  purpose: string;
  model_name: string;
  fallback_model_name?: string | null;
  [key: string]: unknown;
}
