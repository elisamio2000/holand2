// ============================================
// Deploy schema types — inspect / deploy payload contract
// Backend: GET /admin/nodes/{id}/inspect
// ============================================

export interface DeploySchemaField {
  key: string;
  label?: string;
  type?: string;
  default?: unknown;
  required?: boolean;
  description?: string;
  options?: unknown[];
  [key: string]: unknown;
}

export interface DeploySchema {
  fields?: DeploySchemaField[];
  defaults?: Record<string, unknown>;
  process_options?: Record<string, DeploySchemaField | Record<string, unknown>>;
  deploy_options?: Record<string, DeploySchemaField | Record<string, unknown>>;
  [key: string]: unknown;
}

export interface DeployInspectResult {
  deploy_schema?: DeploySchema;
  detected?: Record<string, unknown>;
  routing?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  served_name?: string;
  logical_id?: string;
  name?: string;
  runtime?: string;
  suggested_runtime?: string;
  task?: string;
  [key: string]: unknown;
}

export interface SplitDeployPayload {
  topLevel: Record<string, unknown>;
  deploy_options?: Record<string, unknown>;
  process_options?: Record<string, unknown>;
}

/** Keys sent at the top level of POST /admin/nodes/{id}/deploy */
export const DEPLOY_TOP_LEVEL_KEYS = new Set<string>([
  'storage_path',
  'served_name',
  'logical_id',
  'runtime',
  'task',
  'gpu_memory_fraction',
  'is_active',
  'set_as_default',
  'bind_route',
  'priority',
  'upstream_model',
  'name',
  'container_name',
  'replica_count',
  'max_model_len',
  'tensor_parallel_size',
  'dtype',
  'quantization',
]);

/** Known deploy progress stages (maps to adminNodes.deployStage.* locale keys). */
export type DeployStreamStage =
  | 'accepted'
  | 'resolved'
  | 'preflight'
  | 'container_start'
  | 'container_log'
  | 'probe'
  | 'agent_ready'
  | 'mother_verify'
  | 'registry'
  | 'ready'
  | 'failed';

export interface DeployStreamEvent {
  type: 'stage' | 'log' | 'error' | 'done' | 'progress';
  stage?: DeployStreamStage | string;
  message?: string;
  logLine?: string;
  ok?: boolean;
  jobId?: string;
  servedName?: string;
  raw?: Record<string, unknown>;
}
