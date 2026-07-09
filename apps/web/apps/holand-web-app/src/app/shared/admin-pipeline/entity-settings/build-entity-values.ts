import type { TopologyEdge, TopologyNode, TopologyEntityKind, TopologyPipelineData } from '../topology-board/helpers/topology-board-types';
import type { LlmModel, LlmPool, LlmModelMeta } from '@/types/pipeline-admin.types';
import { modelHealthKind } from '@/utils/model-health';
import { buildModelRunsOnMap } from '../helpers/model-pools';
import { resolveLogicalId } from '../helpers/logical-model-options';
import { resolveEdgeSemantics } from '../topology-board/helpers/edge-semantics';

export type EntityValues = Record<string, unknown>;

function formatModalities(binding?: { input_modalities?: string[]; output_modalities?: string[] }): string {
  if (!binding) return '';
  const parts: string[] = [];
  if (binding.input_modalities?.length) parts.push(`in: ${binding.input_modalities.join(', ')}`);
  if (binding.output_modalities?.length) parts.push(`out: ${binding.output_modalities.join(', ')}`);
  return parts.join(' · ');
}

function parseModelMeta(model: LlmModel | Partial<LlmModel> | undefined): LlmModelMeta {
  if (!model?.metadata) return {};
  if (typeof model.metadata === 'object') return model.metadata as LlmModelMeta;
  try {
    return JSON.parse(String(model.metadata)) as LlmModelMeta;
  } catch {
    return {};
  }
}

function poolReplicaStatus(modelName: string, pools: LlmPool[]): string {
  const pool = pools.find((p) => {
    const name =
      p.model_name ?? p.replicas?.[0]?.name ?? p.logical_id?.split(':').pop() ?? p.logical_id;
    return name === modelName;
  });
  if (!pool) return 'none';
  const active = (pool.replicas ?? []).some((r) => r.is_active !== false && !!r.inference_url);
  return active ? 'active' : 'inactive replica';
}

/** Prefill settings form when adding from catalog. */
export function buildCatalogEntityValues(
  kind: TopologyEntityKind,
  entityId: string,
  data: TopologyPipelineData
): EntityValues {
  switch (kind) {
    case 'tool': {
      const b = data.bindings[entityId];
      return {
        model: b?.model ?? '',
        fallback_model: b?.fallback_model ?? '',
        api: b?.api ?? 'chat',
        purpose: b?.purpose ?? '',
        pipeline_tag: b?.pipeline_tag ?? '',
        modalities: formatModalities(b),
        route_key: entityId,
      };
    }
    case 'route': {
      const r = data.routes.find((x) => x.route_key === entityId);
      return {
        model_name: r?.model_name ?? '',
        fallback_model_name: r?.fallback_model_name ?? '',
        is_active: r?.is_active ?? true,
        constraints: r?.constraints ?? {},
      };
    }
    case 'role': {
      const role = data.roles.find((x) => x.route_key === entityId);
      return {
        current_model: role?.current_model ?? '',
        task: role?.task ?? '',
        modality: role?.modality ?? '',
      };
    }
    case 'model': {
      const m = data.models.find((x) => x.name === entityId);
      const pools = data.pools ?? [];
      return {
        name: entityId,
        task: m?.task ?? '',
        is_active: m?.is_active ?? true,
        pool_replica: poolReplicaStatus(entityId, pools),
      };
    }
    default:
      return { entityId };
  }
}

/** Flat key→value map for FieldRenderer from node or edge data. */
export function buildNodeFieldValues(
  node: TopologyNode,
  models: LlmModel[],
  pools: LlmPool[] = [],
  deployHosts: string[] = []
): Record<string, unknown> {
  const d = node.data;
  const modelRecord =
    d.kind === 'model'
      ? (models.find((m) => m.name === d.entityId) ?? d.model)
      : d.model;

  const healthKind = modelRecord ? modelHealthKind(modelRecord as LlmModel) : 'unknown';
  const runsOn = buildModelRunsOnMap(pools);
  const hostNodes = d.kind === 'model' ? runsOn.get(d.entityId) ?? deployHosts : deployHosts;

  const modelMeta = d.kind === 'model' ? parseModelMeta(modelRecord as LlmModel) : {};

  return {
    model: d.binding?.model ?? '',
    fallback_model: d.binding?.fallback_model ?? '',
    api: d.binding?.api ?? 'chat',
    purpose: d.binding?.purpose ?? '',
    pipeline_tag:
      d.kind === 'model'
        ? modelMeta.pipeline_tag ?? ''
        : d.binding?.pipeline_tag ?? '',
    binding_modalities: formatModalities(d.binding),
    modalities: d.kind === 'model' ? modelMeta.modalities ?? [] : [],
    route_key: d.route?.route_key ?? d.role?.route_key ?? d.entityId,
    model_name: d.route?.model_name ?? d.serviceBinding?.model_name ?? '',
    fallback_model_name:
      d.route?.fallback_model_name ??
      d.role?.fallback_model_name ??
      d.serviceBinding?.fallback_model_name ??
      '',
    prefer_external: Boolean(
      (d.serviceBinding as Record<string, unknown> | undefined)?.prefer_external
    ),
    load_balance: Boolean(
      (d.serviceBinding as Record<string, unknown> | undefined)?.load_balance
    ),
    is_active:
      d.kind === 'endpoint'
        ? d.endpoint?.is_active !== false
        : d.route?.is_active ?? d.model?.is_active ?? true,
    constraints: d.route?.constraints ?? {},
    current_model: d.role?.current_model ?? '',
    task: d.role?.task ?? d.model?.task ?? '',
    modality: d.role?.modality ?? '',
    metadata: d.kind === 'model' ? modelMeta : undefined,
    name: d.entityId,
    logical_id:
      d.kind === 'model' && modelRecord
        ? resolveLogicalId(modelRecord as LlmModel)
        : '',
    origin: d.kind === 'model' ? (modelRecord as LlmModel)?.origin ?? '' : '',
    upstream_model: d.kind === 'model' ? (modelRecord as LlmModel)?.upstream_model ?? '' : '',
    health_status: healthKind,
    last_error: (modelRecord as LlmModel)?.health?.last_error ?? '',
    pool_replica: d.kind === 'model' ? poolReplicaStatus(d.entityId, pools) : '',
    deploy_host: hostNodes.length ? hostNodes.join(', ') : '',
    host: d.endpoint?.host ?? '',
    port: d.endpoint?.port ?? '',
    scheme: d.endpoint?.scheme ?? 'http',
    base_path: d.endpoint?.base_path ?? '',
    node_id: d.remoteNode?.id ?? d.entityId,
    agent_url: d.remoteNode?.agent_url ?? '',
    online: d.remoteNode?.online ? 'online' : 'offline',
    models_deployed_count: Array.isArray(d.remoteNode?.metadata?.models_deployed)
      ? (d.remoteNode!.metadata!.models_deployed as unknown[]).length
      : 0,
    entityId: d.entityId,
    groupLabel: d.groupLabel ?? d.label,
    muted: d.muted ?? false,
  };
}

export function buildEdgeFieldValues(
  edge: TopologyEdge,
  sourceNode?: TopologyNode,
  targetNode?: TopologyNode,
  models: LlmModel[] = [],
  allEdges: TopologyEdge[] = [],
  allNodes: TopologyNode[] = []
): Record<string, unknown> {
  const sem = resolveEdgeSemantics(edge, sourceNode, targetNode, models, allEdges, allNodes);
  return {
    semantic_label: sem.label,
    source: edge.source,
    target: edge.target,
    edgeKind: edge.data?.edgeKind ?? 'primary',
    active: edge.data?.active !== false,
  };
}
