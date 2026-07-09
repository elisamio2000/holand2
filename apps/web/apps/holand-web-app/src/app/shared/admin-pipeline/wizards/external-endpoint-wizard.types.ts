import type {
  DiscoveredModel,
  LlmEndpoint,
  LlmEndpointDiscoverResult,
  ModelImportResult,
  ModelImportSpec,
} from '@/types/pipeline-admin.types';
import { EXTERNAL_ENDPOINT_DEFAULT_PORT } from '@/config/backend-defaults';

export type WizardStep = 'connect' | 'discover' | 'import' | 'success';

export interface ConnectFormState {
  name: string;
  host: string;
  port: number;
  scheme: string;
  base_path: string;
  bearer_token: string;
  timeout_s: number;
}

export interface ImportRowState {
  selected: boolean;
  upstream_model_id: string;
  logical_id: string;
  display_name: string;
  pipeline_tag: string;
  input_modalities: string[];
  output_modalities: string[];
  supports_tools: boolean;
  priority: number;
}

export interface EndpointWizardState {
  step: WizardStep;
  connect: ConnectFormState;
  discoverResult: LlmEndpointDiscoverResult | null;
  importRows: ImportRowState[];
  registeredEndpoint: LlmEndpoint | null;
  importResult: ModelImportResult | null;
  existingEndpointId: string | null;
}

export const DEFAULT_CONNECT: ConnectFormState = {
  name: '',
  host: '',
  port: EXTERNAL_ENDPOINT_DEFAULT_PORT,
  scheme: 'http',
  base_path: '',
  bearer_token: '',
  timeout_s: 5,
};

export function buildImportSpec(row: ImportRowState): ModelImportSpec {
  return {
    upstream_model_id: row.upstream_model_id,
    logical_id: row.logical_id.trim(),
    display_name: row.display_name.trim() || undefined,
    pipeline_tag: row.pipeline_tag || 'text-generation',
    input_modalities: row.input_modalities,
    output_modalities: row.output_modalities,
    supports_tools: row.supports_tools,
    priority: row.priority,
  };
}

export function rowsFromDiscovered(models: DiscoveredModel[]): ImportRowState[] {
  return models.map((m) => {
    const upstream = m.id;
    const shortName = upstream.split(/[/\\]/).pop() ?? upstream;
    const logical = shortName
      .replace(/\.(safetensors|bin|gguf)$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const task = typeof m.task === 'string' ? m.task : undefined;
    const isVision =
      task?.includes('vision') ||
      upstream.toLowerCase().includes('vision') ||
      upstream.toLowerCase().includes('vl');
    return {
      selected: true,
      upstream_model_id: upstream,
      logical_id: logical || upstream,
      display_name: m.name || shortName,
      pipeline_tag: task || 'text-generation',
      input_modalities: isVision ? ['text', 'image'] : ['text'],
      output_modalities: ['text'],
      supports_tools: !isVision,
      priority: 1000,
    };
  });
}

export const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '169.254.169.254',
]);

export function isBlockedHost(host: string): boolean {
  return BLOCKED_HOSTS.has(host.trim().toLowerCase());
}
