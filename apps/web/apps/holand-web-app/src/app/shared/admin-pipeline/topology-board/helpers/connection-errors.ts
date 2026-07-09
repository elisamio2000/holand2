import type { LlmModel, ToolBinding } from '@/types/pipeline-admin.types';
import { ENTITY_REGISTRY } from './entity-registry';
import { parseEntityNodeId } from './topology-board-types';
import { bindingMatchesModel, validateConnection } from './validate-connection';

const REASON_MESSAGES: Record<string, string> = {
  invalid_node: 'One or both nodes are not recognized. Reload the board and try again.',
  target_must_be_model_or_endpoint:
    'Connections must end at a Model or Endpoint node. Drag from a source to a model/endpoint target handle.',
  invalid_source:
    'This node cannot initiate connections. Use Tools, Routes, Roles, Plugins, Services, Endpoints, or Remote Nodes as sources.',
  connection_not_allowed:
    'This source→target pair is not allowed by the pipeline registry. Check entity types in the palette legend.',
  api_task_mismatch:
    'The tool API does not match the target model task. Change the tool API (chat/embed/image) or pick a compatible model.',
};

export function formatConnectionError(
  sourceId: string,
  targetId: string,
  models: LlmModel[] = [],
  binding?: ToolBinding
): string {
  const target = parseEntityNodeId(targetId);
  const model =
    target?.kind === 'model' ? models.find((m) => m.name === target.entityId) : undefined;
  const validation = validateConnection(sourceId, targetId, binding, model);
  const reason = validation.reason ?? 'connection_not_allowed';
  return formatConnectionErrorReason(sourceId, targetId, reason, models, binding);
}

function formatConnectionErrorReason(
  sourceId: string,
  targetId: string,
  reason: string,
  models: LlmModel[] = [],
  binding?: ToolBinding
): string {
  const source = parseEntityNodeId(sourceId);
  const target = parseEntityNodeId(targetId);

  if (reason === 'api_task_mismatch' && source?.kind === 'tool' && target?.kind === 'model') {
    const model = models.find((m) => m.name === target.entityId);
    const sourceLabel = ENTITY_REGISTRY.tool.label;
    const targetLabel = model?.name ?? target.entityId;
    const task = model?.task ?? 'unknown';
    return (
      `Cannot connect ${sourceLabel} "${source.entityId}" to model "${targetLabel}". ` +
      `The tool API must match model task "${task}". ` +
      'Open the tool inspector and set API to chat, embed, or image to match the model.'
    );
  }

  if (reason === 'connection_not_allowed' && source && target) {
    const srcMeta = ENTITY_REGISTRY[source.kind];
    const tgtMeta = ENTITY_REGISTRY[target.kind];
    return (
      `Cannot wire ${srcMeta.label} → ${tgtMeta.label}. ` +
      `${srcMeta.label} ${srcMeta.canSource ? 'can' : 'cannot'} source; ` +
      `${tgtMeta.label} ${tgtMeta.canTarget ? 'can' : 'cannot'} receive connections. ` +
      'See palette categories: Actions/Triggers source, Models/Endpoints target.'
    );
  }

  if (reason === 'target_must_be_model_or_endpoint' && target) {
    const tgtMeta = ENTITY_REGISTRY[target.kind];
    return (
      `Cannot connect to ${tgtMeta.label} "${target.entityId}". ` +
      'Drop the connection on a Model or Endpoint node instead.'
    );
  }

  const base = REASON_MESSAGES[reason];
  if (base) {
    const srcLabel = source ? `${ENTITY_REGISTRY[source.kind].label} "${source.entityId}"` : sourceId;
    const tgtLabel = target ? `${ENTITY_REGISTRY[target.kind].label} "${target.entityId}"` : targetId;
    return `${base} (${srcLabel} → ${tgtLabel})`;
  }

  return `Connection denied: ${sourceId} → ${targetId}. Validate the graph or check entity settings.`;
}

/** Convenience: derive reason from binding/model when validating tool→model. */
export function connectionErrorFromValidation(
  sourceId: string,
  targetId: string,
  validation: { ok: boolean; reason?: string },
  models: LlmModel[] = [],
  binding?: ToolBinding
): string | null {
  if (validation.ok) return null;
  const reason = validation.reason ?? 'connection_not_allowed';
  let msg = formatConnectionErrorReason(sourceId, targetId, reason, models, binding);
  if (reason === 'api_task_mismatch' && binding?.api) {
    msg += ` Current tool API: "${binding.api}".`;
  }
  return msg;
}

export function suggestCompatibleModels(
  binding: { api?: string },
  models: LlmModel[]
): LlmModel[] {
  return models.filter((m) => m.is_active && bindingMatchesModel(binding as Parameters<typeof bindingMatchesModel>[0], m));
}
