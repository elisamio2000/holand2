import { ToolBinding, LlmModel } from '@/types/pipeline-admin.types';
import { parseEntityNodeId, type TopologyEntityKind } from './topology-board-types';
import { ENTITY_REGISTRY } from './entity-registry';


export function bindingMatchesModel(binding: ToolBinding, model: LlmModel): boolean {
  const api = binding.api ?? 'chat';
  const taskForApi =
    api === 'embed' ? 'embed' : api === 'image' ? 'image' : 'chat';
  return model.task === taskForApi || model.task === 'chat';
}

const SOURCE_KINDS: TopologyEntityKind[] = [
  'tool',
  'route',
  'role',
  'plugin',
  'service',
  'endpoint',
  'remoteNode',
];

export function validateConnection(
  sourceId: string,
  targetId: string,
  binding?: ToolBinding,
  model?: LlmModel
): { ok: boolean; reason?: string } {
  const source = parseEntityNodeId(sourceId);
  const target = parseEntityNodeId(targetId);
  if (!source || !target) return { ok: false, reason: 'invalid_node' };
  if (target.kind !== 'model' && target.kind !== 'endpoint') {
    return { ok: false, reason: 'target_must_be_model_or_endpoint' };
  }
  if (!SOURCE_KINDS.includes(source.kind)) {
    return { ok: false, reason: 'invalid_source' };
  }
  const sourceMeta = ENTITY_REGISTRY[source.kind];
  const targetMeta = ENTITY_REGISTRY[target.kind];
  if (!sourceMeta.canSource || !targetMeta.canTarget) {
    return { ok: false, reason: 'connection_not_allowed' };
  }
  if (source.kind === 'tool' && target.kind === 'model' && binding && model) {
    if (!bindingMatchesModel(binding, model)) {
      return { ok: false, reason: 'api_task_mismatch' };
    }
  }
  return { ok: true };
}

/** Human-readable message for connect validation failures. */
export function formatConnectionError(
  reason?: string,
  t?: (key: string, fallback?: string) => string
): string {
  const tr = t ?? ((_k, fb) => fb ?? 'Connection not allowed');
  switch (reason) {
    case 'api_task_mismatch':
      return tr('pipeline.tools.connectValidation', 'Model task does not match binding API');
    case 'target_must_be_model_or_endpoint':
      return tr(
        'pipeline.topology.board.connectTargetModel',
        'Connections must target a model or endpoint'
      );
    case 'invalid_node':
      return tr('pipeline.topology.board.connectInvalidNode', 'Invalid node');
    case 'invalid_source':
      return tr('pipeline.topology.board.connectInvalidSource', 'This node cannot be a connection source');
    case 'connection_not_allowed':
    default:
      return tr('pipeline.topology.board.connectDenied', 'Connection not allowed');
  }
}
