import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type { ToolBinding } from '@/types/pipeline-admin.types';
import { parseEntityNodeId, type TopologyEdge, type TopologyNode } from './topology-board-types';

function bindingFromEdges(
  entityId: string,
  kind: 'tool' | 'plugin',
  edges: TopologyEdge[],
  existing?: ToolBinding
): ToolBinding {
  const src = `${kind}:${entityId}`;
  const outgoing = edges.filter((e) => e.source === src);
  let primary: string | undefined;
  let fallback: string | undefined;
  for (const edge of outgoing) {
    const parsed = parseEntityNodeId(edge.target);
    if (!parsed || parsed.kind !== 'model') continue;
    const ek = edge.data?.edgeKind ?? 'primary';
    if (ek === 'loop') fallback = parsed.entityId;
    else primary = parsed.entityId;
  }
  return {
    model: primary ?? existing?.model ?? '',
    fallback_model: fallback ?? existing?.fallback_model ?? null,
    api: existing?.api ?? 'chat',
    input_modalities: existing?.input_modalities,
    output_modalities: existing?.output_modalities,
    purpose: existing?.purpose ?? null,
    pipeline_tag: existing?.pipeline_tag ?? null,
  };
}

function routePatchFromEdges(routeKey: string, edges: TopologyEdge[]) {
  const src = `route:${routeKey}`;
  let primary: string | undefined;
  let fallback: string | undefined;
  edges.filter((e) => e.source === src).forEach((edge) => {
    const parsed = parseEntityNodeId(edge.target);
    if (!parsed || parsed.kind !== 'model') return;
    const ek = edge.data?.edgeKind ?? 'primary';
    if (ek === 'loop') fallback = parsed.entityId;
    else primary = parsed.entityId;
  });
  return { model_name: primary, fallback_model_name: fallback ?? null };
}

export interface EntitySaveResult {
  id: string;
  kind: string;
  ok: boolean;
}

export async function saveTopologyToApi(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  bindings: Record<string, ToolBinding>,
  pluginBindings: Record<string, ToolBinding>
): Promise<{
  toolsSaved: number;
  routesSaved: number;
  rolesSaved: number;
  pluginsSaved: number;
  servicesSaved: number;
  errors: string[];
  entityResults: EntitySaveResult[];
}> {
  const errors: string[] = [];
  const entityResults: EntitySaveResult[] = [];
  let toolsSaved = 0;
  let routesSaved = 0;
  let rolesSaved = 0;
  let pluginsSaved = 0;
  let servicesSaved = 0;

  for (const node of nodes.filter((n) => n.data.kind === 'tool')) {
    const toolId = node.data.entityId;
    const next = bindingFromEdges(toolId, 'tool', edges, bindings[toolId] ?? node.data.binding);
    const prev = bindings[toolId];
    const changed =
      !prev ||
      prev.model !== next.model ||
      (prev.fallback_model ?? null) !== (next.fallback_model ?? null);
    if (changed && next.model?.trim()) {
      try {
        await pipelineAdminService.setToolBinding(toolId, next);
        toolsSaved += 1;
        entityResults.push({ id: toolId, kind: 'tool', ok: true });
      } catch {
        errors.push(`tool:${toolId}`);
        entityResults.push({ id: toolId, kind: 'tool', ok: false });
      }
    }
  }

  for (const node of nodes.filter((n) => n.data.kind === 'plugin')) {
    const pluginId = node.data.entityId;
    const next = bindingFromEdges(pluginId, 'plugin', edges, pluginBindings[pluginId] ?? node.data.binding);
    const prev = pluginBindings[pluginId];
    const changed =
      !prev ||
      prev.model !== next.model ||
      (prev.fallback_model ?? null) !== (next.fallback_model ?? null);
    if (changed && next.model?.trim()) {
      try {
        await pipelineAdminService.setPluginBinding(pluginId, next);
        pluginsSaved += 1;
        entityResults.push({ id: pluginId, kind: 'plugin', ok: true });
      } catch {
        errors.push(`plugin:${pluginId}`);
        entityResults.push({ id: pluginId, kind: 'plugin', ok: false });
      }
    }
  }

  for (const node of nodes.filter((n) => n.data.kind === 'route')) {
    const routeKey = node.data.entityId;
    const patch = routePatchFromEdges(routeKey, edges);
    if (patch.model_name?.trim()) {
      try {
        await pipelineAdminService.updateRoute(routeKey, patch);
        routesSaved += 1;
        entityResults.push({ id: routeKey, kind: 'route', ok: true });
      } catch {
        errors.push(`route:${routeKey}`);
        entityResults.push({ id: routeKey, kind: 'route', ok: false });
      }
    }
  }

  for (const node of nodes.filter((n) => n.data.kind === 'role')) {
    const roleKey = node.data.entityId;
    const outgoing = edges.filter((e) => e.source === `role:${roleKey}`);
    const primary = outgoing.find((e) => (e.data?.edgeKind ?? 'primary') === 'primary');
    const parsed = primary ? parseEntityNodeId(primary.target) : null;
    if (parsed?.kind === 'model' && parsed.entityId) {
      try {
        await pipelineAdminService.assignRoleModel(roleKey, parsed.entityId);
        rolesSaved += 1;
        entityResults.push({ id: roleKey, kind: 'role', ok: true });
      } catch {
        errors.push(`role:${roleKey}`);
        entityResults.push({ id: roleKey, kind: 'role', ok: false });
      }
    }
  }

  for (const node of nodes.filter((n) => n.data.kind === 'service')) {
    const sb = node.data.serviceBinding;
    if (!sb?.service || !sb.purpose) continue;
    const src = `service:${sb.service}/${sb.purpose}`;
    let primary: string | undefined;
    let fallback: string | undefined;
    edges.filter((e) => e.source === src).forEach((edge) => {
      const parsed = parseEntityNodeId(edge.target);
      if (!parsed || parsed.kind !== 'model') return;
      const ek = edge.data?.edgeKind ?? 'primary';
      if (ek === 'loop') fallback = parsed.entityId;
      else primary = parsed.entityId;
    });
    if (!primary?.trim()) continue;
    const serviceId = `${sb.service}/${sb.purpose}`;
    try {
      await pipelineAdminService.setServiceBinding(sb.service, sb.purpose, {
        model: primary,
        fallback_model: fallback ?? null,
      });
      servicesSaved += 1;
      entityResults.push({ id: serviceId, kind: 'service', ok: true });
    } catch {
      errors.push(`service:${serviceId}`);
      entityResults.push({ id: serviceId, kind: 'service', ok: false });
    }
  }

  return {
    toolsSaved,
    routesSaved,
    rolesSaved,
    pluginsSaved,
    servicesSaved,
    errors,
    entityResults,
  };
}

export async function applyEntityPatch(
  kind: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  switch (kind) {
    case 'tool':
      await pipelineAdminService.setToolBinding(entityId, payload as unknown as ToolBinding);
      break;
    case 'route':
      await pipelineAdminService.updateRoute(entityId, payload as Parameters<typeof pipelineAdminService.updateRoute>[1]);
      break;
    case 'role':
      if (payload.model_name) {
        await pipelineAdminService.assignRoleModel(entityId, String(payload.model_name));
      }
      break;
    case 'plugin':
      await pipelineAdminService.setPluginBinding(entityId, payload as unknown as ToolBinding);
      break;
    case 'model':
      await pipelineAdminService.updateModel(entityId, payload as Parameters<typeof pipelineAdminService.updateModel>[1]);
      break;
    case 'endpoint':
      await pipelineAdminService.patchEndpoint(entityId, payload as Parameters<typeof pipelineAdminService.patchEndpoint>[1]);
      break;
    case 'service': {
      const [service, purpose] = entityId.split('/');
      await pipelineAdminService.setServiceBinding(service, purpose, payload as {
        model: string;
        fallback_model?: string | null;
        constraints?: Record<string, unknown>;
      });
      break;
    }
    default:
      break;
  }
}
