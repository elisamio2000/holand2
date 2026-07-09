import { TopologyEntityKind, TopologyPipelineData, entityNodeId } from './topology-board-types';
import { resolveToolSemanticGroup, type SemanticGroupId } from './semantic-groups';

export interface EntityCatalogEntry {
  kind: TopologyEntityKind;
  entityId: string;
  label: string;
  sub?: string;
  nodeId: string;
  category?: string;
  tags?: string[];
  llmApi?: string;
  semanticGroup?: SemanticGroupId;
  task?: string;
  modalities?: string[];
}

/** Full catalog of placeable entities from pipeline data (sidebar source of truth). */
export function buildEntityCatalog(data: TopologyPipelineData): EntityCatalogEntry[] {
  const entries: EntityCatalogEntry[] = [];

  data.tools.forEach((tool) => {
    entries.push({
      kind: 'tool',
      entityId: tool.tool_id,
      label: tool.tool_id,
      sub: tool.category ?? undefined,
      nodeId: entityNodeId('tool', tool.tool_id),
      category: tool.category ?? undefined,
      tags: tool.tags ?? undefined,
      llmApi: tool.llm_api ?? undefined,
      semanticGroup: resolveToolSemanticGroup(tool),
    });
  });

  data.routes.forEach((route) => {
    entries.push({
      kind: 'route',
      entityId: route.route_key,
      label: route.route_key,
      sub: route.model_name ?? undefined,
      nodeId: entityNodeId('route', route.route_key),
    });
  });

  data.roles.forEach((role) => {
    entries.push({
      kind: 'role',
      entityId: role.route_key,
      label: role.route_key,
      sub: role.task ?? undefined,
      task: role.task ?? undefined,
      nodeId: entityNodeId('role', role.route_key),
    });
  });

  data.models
    .filter((m) => m.is_active)
    .forEach((m) => {
      entries.push({
        kind: 'model',
        entityId: m.name,
        label: m.name,
        sub: m.task ?? undefined,
        task: m?.task ?? undefined,
        modalities: undefined,
        nodeId: entityNodeId('model', m.name),
      });
    });

  data.endpoints.forEach((ep) => {
    entries.push({
      kind: 'endpoint',
      entityId: ep.id,
      label: ep.name,
      sub: `${ep.host}:${ep.port}`,
      nodeId: entityNodeId('endpoint', ep.id),
      semanticGroup: 'infra',
    });
  });

  data.remoteNodes.forEach((node) => {
    entries.push({
      kind: 'remoteNode',
      entityId: node.id,
      label: node.display_name ?? node.id,
      sub: node.online === false ? 'offline' : 'online',
      nodeId: entityNodeId('remoteNode', node.id),
      semanticGroup: 'infra',
    });
  });

  Object.keys(data.pluginBindings).forEach((pluginId) => {
    entries.push({
      kind: 'plugin',
      entityId: pluginId,
      label: pluginId,
      nodeId: entityNodeId('plugin', pluginId),
      semanticGroup: 'other',
    });
  });

  data.serviceBindings.forEach((sb) => {
    const key = `${sb.service}/${sb.purpose}`;
    entries.push({
      kind: 'service',
      entityId: key,
      label: key,
      sub: sb.model_name ?? undefined,
      nodeId: entityNodeId('service', key),
    });
  });

  return entries;
}

export function catalogEntryByNodeId(
  catalog: EntityCatalogEntry[],
  nodeId: string
): EntityCatalogEntry | undefined {
  return catalog.find((e) => e.nodeId === nodeId);
}
