import { candidateModelName } from '@/app/shared/admin-llm/utils/format-model-label';
import { modelHealthKind } from '@/utils/model-health';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { resolveLogicalId, findModelByEntityId, indexPoolsByLogicalId } from '../../helpers/logical-model-options';
import { buildEdgeStyle } from './edge-styles';
import { ENTITY_REGISTRY } from './entity-registry';
import { loadTopologyLayout } from './layout-storage';
import { DEFAULT_TOPOLOGY_BOARD_SETTINGS } from './topology-board-settings';
import {
  entityNodeId,
  type TopologyEdge,
  type TopologyNode,
  type TopologyPipelineData,
} from './topology-board-types';
import {
  buildEntityCatalog,
  type EntityCatalogEntry,
} from './topology-catalog';

const ROW_GAP = 72;
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 64;

function withDefaultNodeSize(node: TopologyNode): TopologyNode {
  return {
    ...node,
    width: node.width ?? DEFAULT_NODE_WIDTH,
    height: node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/** Backend may return model fields as string or `{ name: string }`. */
function resolveModelName(value: unknown): string | null {
  const name = candidateModelName(value).trim();
  return name && name !== '—' ? name : null;
}

function nextY(counts: Record<string, number>, kind: string): number {
  const idx = counts[kind] ?? 0;
  counts[kind] = idx + 1;
  return 40 + idx * ROW_GAP;
}

function addEdge(
  edges: TopologyEdge[],
  sourceId: string,
  targetId: string,
  edgeKind: 'primary' | 'loop',
  models: TopologyPipelineData['models'],
  uiSemantic?: 'register' | 'deploy'
): void {
  const targetParsed = targetId.split(':');
  const modelName = targetParsed[0] === 'model' ? targetParsed.slice(1).join(':') : '';
  const visual = buildEdgeStyle(edgeKind, modelName, models);
  edges.push({
    id: `e:${sourceId}:${targetId}:${edgeKind}`,
    source: sourceId,
    target: targetId,
    data: { edgeKind, active: true, ...(uiSemantic ? { uiSemantic } : {}) },
    ...visual,
  });
}

function resolveDeployedModelNodeId(
  data: TopologyPipelineData,
  nodeId: string,
  deployedName: string
): string {
  const physical = `${nodeId}:${deployedName}`;
  const byPhysical = data.models.find((m) => m.name === physical || m.name === deployedName);
  if (byPhysical) return byPhysical.name;
  const byNode = data.models.find(
    (m) =>
      m.node_id === nodeId &&
      (m.name.includes(deployedName) || resolveLogicalId(m) === deployedName)
  );
  if (byNode) return byNode.name;
  return physical;
}

function buildEdges(data: TopologyPipelineData): TopologyEdge[] {
  const edges: TopologyEdge[] = [];

  data.tools.forEach((tool) => {
    const b = data.bindings[tool.tool_id];
    if (!b) return;
    const src = entityNodeId('tool', tool.tool_id);
    const model = resolveModelName(b.model);
    const fallback = resolveModelName(b.fallback_model);
    if (model) addEdge(edges, src, entityNodeId('model', model), 'primary', data.models);
    if (fallback) addEdge(edges, src, entityNodeId('model', fallback), 'loop', data.models);
  });

  data.routes.forEach((route) => {
    const src = entityNodeId('route', route.route_key);
    const model = resolveModelName(route.model_name);
    const fallback = resolveModelName(route.fallback_model_name);
    if (model) addEdge(edges, src, entityNodeId('model', model), 'primary', data.models);
    if (fallback) addEdge(edges, src, entityNodeId('model', fallback), 'loop', data.models);
  });

  data.roles.forEach((role) => {
    const model = resolveModelName(role.current_model);
    if (!model) return;
    addEdge(
      edges,
      entityNodeId('role', role.route_key),
      entityNodeId('model', model),
      'primary',
      data.models
    );
  });

  Object.entries(data.pluginBindings).forEach(([pluginId, b]) => {
    const src = entityNodeId('plugin', pluginId);
    const model = resolveModelName(b.model);
    const fallback = resolveModelName(b.fallback_model);
    if (model) addEdge(edges, src, entityNodeId('model', model), 'primary', data.models);
    if (fallback) addEdge(edges, src, entityNodeId('model', fallback), 'loop', data.models);
  });

  data.serviceBindings.forEach((sb) => {
    const src = entityNodeId('service', `${sb.service}/${sb.purpose}`);
    const model = resolveModelName(sb.model_name);
    const fallback = resolveModelName(sb.fallback_model_name);
    if (model) addEdge(edges, src, entityNodeId('model', model), 'primary', data.models);
    if (fallback) addEdge(edges, src, entityNodeId('model', fallback), 'loop', data.models);
  });

  data.remoteNodes.forEach((node) => {
    const deployed = node.metadata?.models_deployed;
    if (!Array.isArray(deployed)) return;
    deployed.forEach((dm) => {
      const name = String(
        (dm as { served_name?: string; name?: string }).served_name ??
          (dm as { name?: string }).name ??
          ''
      );
      if (!name) return;
      const modelNodeId = resolveDeployedModelNodeId(data, node.id, name);
      addEdge(
        edges,
        entityNodeId('model', modelNodeId),
        entityNodeId('remoteNode', node.id),
        'primary',
        data.models,
        'deploy'
      );
    });
  });

  data.models.forEach((model) => {
    if (model.backend_kind !== 'external') return;
    const meta = pipelineAdminService.parseModelMeta(model);
    const epId = String(meta?.endpoint_id ?? '');
    const ep =
      data.endpoints.find((e) => e.id === epId) ??
      data.endpoints.find((e) => e.name === model.endpoint_name) ??
      data.endpoints.find((e) => e.name === String(meta?.endpoint_name ?? ''));
    if (!ep) return;
    addEdge(
      edges,
      entityNodeId('endpoint', ep.id),
      entityNodeId('model', model.name),
      'primary',
      data.models,
      'register'
    );
  });

  return edges;
}

function connectedNodeIds(edges: TopologyEdge[]): Set<string> {
  const ids = new Set<string>();
  edges.forEach((e) => {
    ids.add(e.source);
    ids.add(e.target);
  });
  return ids;
}

function buildNodeForId(
  nodeId: string,
  data: TopologyPipelineData,
  positions: Record<string, { x: number; y: number }>,
  counts: Record<string, number>
): TopologyNode | null {
  const idx = nodeId.indexOf(':');
  if (idx <= 0) return null;
  const kind = nodeId.slice(0, idx);
  const entityId = nodeId.slice(idx + 1);

  const pos = (k: string) =>
    positions[nodeId] ?? {
      x: ENTITY_REGISTRY[k as keyof typeof ENTITY_REGISTRY]?.defaultX ?? 0,
      y: nextY(counts, k),
    };

  switch (kind) {
    case 'tool': {
      const tool = data.tools.find((t) => t.tool_id === entityId);
      if (!tool) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoTool',
        position: pos('tool'),
        data: {
          kind: 'tool',
          label: tool.tool_id,
          entityId: tool.tool_id,
          binding: data.bindings[tool.tool_id],
          muted: tool.enabled === false,
        },
      });
    }
    case 'route': {
      const route = data.routes.find((r) => r.route_key === entityId);
      if (!route) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoRoute',
        position: pos('route'),
        data: {
          kind: 'route',
          label: route.route_key,
          entityId: route.route_key,
          route,
          muted: route.is_active === false,
        },
      });
    }
    case 'role': {
      const role = data.roles.find((r) => r.route_key === entityId);
      if (!role) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoRole',
        position: pos('role'),
        data: {
          kind: 'role',
          label: role.route_key,
          entityId: role.route_key,
          role,
        },
      });
    }
    case 'model': {
      const model = findModelByEntityId(data.models, entityId);
      const logicalLabel = model ? resolveLogicalId(model) : entityId;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoModel',
        position: pos('model'),
        data: {
          kind: 'model',
          label: logicalLabel,
          entityId,
          model,
          healthKind: model ? modelHealthKind(model) : 'unknown',
        },
      });
    }
    case 'endpoint': {
      const ep = data.endpoints.find((e) => e.id === entityId);
      if (!ep) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoEndpoint',
        position: pos('endpoint'),
        data: {
          kind: 'endpoint',
          label: ep.name,
          entityId: ep.id,
          endpoint: ep,
          muted: !ep.is_active,
        },
      });
    }
    case 'remoteNode': {
      const node = data.remoteNodes.find((n) => n.id === entityId);
      if (!node) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoRemoteNode',
        position: pos('remoteNode'),
        data: {
          kind: 'remoteNode',
          label: node.display_name ?? node.id,
          entityId: node.id,
          remoteNode: node,
          muted: node.online === false || node.is_active === false,
        },
      });
    }
    case 'plugin': {
      const binding = data.pluginBindings[entityId];
      if (!binding) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoPlugin',
        position: pos('plugin'),
        data: {
          kind: 'plugin',
          label: entityId,
          entityId,
          pluginId: entityId,
          binding,
        },
      });
    }
    case 'service': {
      const sb = data.serviceBindings.find(
        (s) => `${s.service}/${s.purpose}` === entityId
      );
      if (!sb) return null;
      return withDefaultNodeSize({
        id: nodeId,
        type: 'topoService',
        position: pos('service'),
        data: {
          kind: 'service',
          label: entityId,
          entityId,
          serviceBinding: sb,
        },
      });
    }
    default:
      return null;
  }
}

/** Sparse hydrate: only connected subgraph on canvas; full catalog for palette. */
export function hydrateConnectedSubgraph(data: TopologyPipelineData): {
  catalog: EntityCatalogEntry[];
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  placedNodeIds: string[];
} {
  const layout = loadTopologyLayout();
  const positions = layout?.positions ?? {};
  const catalog = buildEntityCatalog(data);
  const edges = buildEdges(data);
  const connected = connectedNodeIds(edges);
  const showOrphanNodes =
    layout?.displaySettings?.showOrphanNodes ??
    DEFAULT_TOPOLOGY_BOARD_SETTINGS.showOrphanNodes;

  (layout?.manualPlacements ?? []).forEach((id) => {
    if (!id.startsWith('group:')) connected.add(id);
  });

  if (showOrphanNodes) {
    Object.keys(positions).forEach((id) => {
      if (!id.startsWith('group:')) connected.add(id);
    });
  }

  const counts: Record<string, number> = {};
  const nodes: TopologyNode[] = [];
  connected.forEach((nodeId) => {
    const node = buildNodeForId(nodeId, data, positions, counts);
    if (node) nodes.push(node);
  });

  const poolIndex = indexPoolsByLogicalId(data.pools ?? []);
  poolIndex.forEach((pool, logicalId) => {
    const replicaCount = pool.replicas?.length ?? 0;
    if (replicaCount < 2) return;
    const childIds = (pool.replicas ?? [])
      .map((r) => {
        const name = r.name ?? '';
        const model = findModelByEntityId(data.models, name);
        return model ? entityNodeId('model', model.name) : null;
      })
      .filter(Boolean) as string[];
    const placedChildren = childIds.filter((id) => nodes.some((n) => n.id === id));
    if (placedChildren.length < 2) return;
    const groupId = `group:pool:${logicalId}`;
    const xs = placedChildren
      .map((id) => nodes.find((n) => n.id === id)?.position.x ?? 0);
    const ys = placedChildren
      .map((id) => nodes.find((n) => n.id === id)?.position.y ?? 0);
    const minX = Math.min(...xs) - 24;
    const minY = Math.min(...ys) - 40;
    nodes.push(
      withDefaultNodeSize({
        id: groupId,
        type: 'topoGroup',
        position: positions[groupId] ?? { x: minX, y: minY },
        data: {
          kind: 'group',
          label: logicalId,
          entityId: logicalId,
          childIds: placedChildren,
        },
        style: { width: 280, height: 120 },
      })
    );
    placedChildren.forEach((childId) => {
      const idx = nodes.findIndex((n) => n.id === childId);
      if (idx >= 0) {
        nodes[idx] = {
          ...nodes[idx],
          parentId: groupId,
          extent: 'parent' as const,
        };
      }
    });
  });

  return {
    catalog,
    nodes,
    edges,
    placedNodeIds: nodes.map((n) => n.id),
  };
}

/** @deprecated Use hydrateConnectedSubgraph — kept for imports that only need nodes/edges */
export function hydrateFromPipeline(data: TopologyPipelineData): {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
} {
  const { nodes, edges } = hydrateConnectedSubgraph(data);
  return { nodes, edges };
}
