import type { TopologyEntityKind, TopologyEdge, TopologyNode } from './topology-board-types';
import type { EntityCatalogEntry } from './topology-catalog';
import type { TopologyPipelineData } from './topology-board-types';
import {
  resolveCatalogSemanticGroup,
  resolveNodeSemanticGroup,
  type SemanticGroupId,
} from './semantic-groups';
import { modelHealthKind } from '@/utils/model-health';

export type PalettePlacementFilter = 'all' | 'onCanvas' | 'catalogOnly';
export type PaletteStatusFilter = 'all' | 'needsBinding';

export interface TopologyDisplayFilterState {
  hiddenKinds: TopologyEntityKind[];
  placement: PalettePlacementFilter;
  status: PaletteStatusFilter;
  semanticGroups: SemanticGroupId[];
  toolCategories: string[];
  roleUnassignedOnly: boolean;
  roleRequiredOnly: boolean;
  unhealthyRoutesOnly: boolean;
  modality: string | null;
}

export const DEFAULT_DISPLAY_FILTER: TopologyDisplayFilterState = {
  hiddenKinds: [],
  placement: 'all',
  status: 'all',
  semanticGroups: [],
  toolCategories: [],
  roleUnassignedOnly: false,
  roleRequiredOnly: false,
  unhealthyRoutesOnly: false,
  modality: null,
};

export function activeFilterCount(filter: TopologyDisplayFilterState): number {
  let n = filter.hiddenKinds.length;
  if (filter.placement !== 'all') n += 1;
  if (filter.status !== 'all') n += 1;
  if (filter.roleUnassignedOnly) n += 1;
  if (filter.roleRequiredOnly) n += 1;
  if (filter.unhealthyRoutesOnly) n += 1;
  if (filter.modality) n += 1;
  n += filter.semanticGroups.length;
  n += filter.toolCategories.length;
  return n;
}

export function catalogNeedsBinding(
  item: EntityCatalogEntry,
  pipelineData: TopologyPipelineData | null
): boolean {
  if (!pipelineData) return false;
  if (item.kind === 'tool') return !pipelineData.bindings[item.entityId]?.model;
  if (item.kind === 'plugin') return !pipelineData.pluginBindings[item.entityId]?.model;
  if (item.kind === 'service') {
    const sb = pipelineData.serviceBindings.find(
      (s) => `${s.service}/${s.purpose}` === item.entityId
    );
    return !sb?.model_name;
  }
  return false;
}

function matchesSemanticFilter(
  item: EntityCatalogEntry,
  filter: TopologyDisplayFilterState
): boolean {
  if (filter.semanticGroups.length === 0 && filter.toolCategories.length === 0) return true;

  if (filter.toolCategories.length > 0) {
    if (item.kind === 'tool' && item.category && filter.toolCategories.includes(item.category)) {
      return true;
    }
  }

  if (filter.semanticGroups.length > 0) {
    const g = resolveCatalogSemanticGroup(item);
    if (g && filter.semanticGroups.includes(g)) return true;
  }

  if (filter.semanticGroups.length > 0 && filter.toolCategories.length > 0) return false;
  if (filter.semanticGroups.length > 0) return false;
  if (filter.toolCategories.length > 0) return false;
  return true;
}

export function matchesCatalogFilter(
  item: EntityCatalogEntry,
  filter: TopologyDisplayFilterState,
  placedNodeIds: Set<string>,
  pipelineData: TopologyPipelineData | null
): boolean {
  if (filter.hiddenKinds.includes(item.kind)) return false;
  const isOnCanvas = placedNodeIds.has(item.nodeId);
  if (filter.placement === 'onCanvas' && !isOnCanvas) return false;
  if (filter.placement === 'catalogOnly' && isOnCanvas) return false;
  if (filter.status === 'needsBinding' && !catalogNeedsBinding(item, pipelineData)) return false;
  if (!matchesSemanticFilter(item, filter)) return false;
  return true;
}

function nodeNeedsBinding(node: TopologyNode): boolean {
  if (node.data.kind === 'tool' || node.data.kind === 'plugin') {
    return !node.data.binding?.model;
  }
  if (node.data.kind === 'service') return !node.data.serviceBinding?.model_name;
  return false;
}

function roleMatchesUrlFilters(node: TopologyNode, filter: TopologyDisplayFilterState): boolean {
  if (!filter.roleUnassignedOnly && !filter.roleRequiredOnly) return true;
  if (node.data.kind !== 'role') return false;
  const role = node.data.role;
  if (!role) return false;
  const isAssigned = role.is_assigned || !!role.current_model;
  if (filter.roleUnassignedOnly && isAssigned) return false;
  if (filter.roleRequiredOnly && !role.required) return false;
  return true;
}

function routeMatchesUrlFilters(
  node: TopologyNode,
  filter: TopologyDisplayFilterState,
  pipelineData?: TopologyPipelineData | null
): boolean {
  if (!filter.unhealthyRoutesOnly) return true;
  if (node.data.kind !== 'route') return false;
  const route = node.data.route;
  if (!route?.model_name || !pipelineData) return true;
  const model = pipelineData.models.find((m) => m.name === route.model_name);
  if (!model) return true;
  return modelHealthKind(model) === 'unhealthy';
}

function nodeMatchesModality(
  node: TopologyNode,
  filter: TopologyDisplayFilterState,
  pipelineData?: TopologyPipelineData | null
): boolean {
  if (!filter.modality) return true;
  const modality = filter.modality.toLowerCase();
  if (node.data.kind === 'model' && node.data.model) {
    const meta = node.data.model.metadata as { modalities?: string[] } | undefined;
    const mods = meta?.modalities ?? [];
    return mods.some((m) => m.toLowerCase() === modality);
  }
  if (node.data.kind === 'tool' && pipelineData) {
    const tool = pipelineData.tools.find((t) => t.tool_id === node.data.entityId);
    const profile = tool?.llm_profile as
      | { input_modalities?: string[]; output_modalities?: string[] }
      | undefined;
    const mods = [
      ...(profile?.input_modalities ?? []),
      ...(profile?.output_modalities ?? []),
    ];
    return mods.some((m) => String(m).toLowerCase() === modality);
  }
  return false;
}

export function matchesCanvasNodeFilter(
  node: TopologyNode,
  filter: TopologyDisplayFilterState,
  placedNodeIds?: Set<string>,
  pipelineData?: TopologyPipelineData | null
): boolean {
  if (node.data.kind === 'group') return false;
  if (filter.hiddenKinds.includes(node.data.kind)) return false;
  if (placedNodeIds) {
    const onCanvas = placedNodeIds.has(node.id);
    if (filter.placement === 'onCanvas' && !onCanvas) return false;
    if (filter.placement === 'catalogOnly' && onCanvas) return false;
  }
  if (!roleMatchesUrlFilters(node, filter)) return false;
  if (!routeMatchesUrlFilters(node, filter, pipelineData)) return false;
  if (filter.modality && !nodeMatchesModality(node, filter, pipelineData)) return false;
  if (filter.status === 'needsBinding') {
    return nodeNeedsBinding(node);
  }
  if (filter.semanticGroups.length > 0 || filter.toolCategories.length > 0) {
    const g = resolveNodeSemanticGroup(node, pipelineData ?? null);
    if (filter.semanticGroups.length > 0 && g && filter.semanticGroups.includes(g)) {
      return true;
    }
    if (filter.toolCategories.length > 0 && node.data.kind === 'tool' && pipelineData) {
      const tool = pipelineData.tools.find((t) => t.tool_id === node.data.entityId);
      if (tool?.category && filter.toolCategories.includes(tool.category)) return true;
    }
    return false;
  }
  return true;
}

export function filterCanvasGraph(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  filter: TopologyDisplayFilterState,
  placedNodeIds?: Set<string>,
  pipelineData?: TopologyPipelineData | null
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const hasFilter =
    filter.hiddenKinds.length > 0 ||
    filter.placement !== 'all' ||
    filter.status !== 'all' ||
    filter.roleUnassignedOnly ||
    filter.roleRequiredOnly ||
    filter.unhealthyRoutesOnly ||
    Boolean(filter.modality) ||
    filter.semanticGroups.length > 0 ||
    filter.toolCategories.length > 0;

  if (!hasFilter) {
    return { nodes, edges };
  }

  const placed = placedNodeIds ?? new Set(nodes.filter((n) => n.data.kind !== 'group').map((n) => n.id));
  const visibleIds = new Set<string>();

  nodes.forEach((n) => {
    if (n.data.kind === 'group') return;
    if (matchesCanvasNodeFilter(n, filter, placed, pipelineData)) visibleIds.add(n.id);
  });

  nodes.forEach((n) => {
    if (!n.parentId || !visibleIds.has(n.id)) return;
    let parentId: string | undefined = n.parentId;
    while (parentId) {
      visibleIds.add(parentId);
      parentId = nodes.find((x) => x.id === parentId)?.parentId;
    }
  });

  nodes
    .filter((n) => n.data.kind === 'group')
    .forEach((g) => {
      const hasVisibleChild = nodes.some((c) => c.parentId === g.id && visibleIds.has(c.id));
      if (!hasVisibleChild) visibleIds.delete(g.id);
    });

  const displayNodes = nodes.map((n) => {
    const visible = visibleIds.has(n.id);
    return {
      ...n,
      hidden: !visible,
      selectable: visible,
      style: visible
        ? n.style
        : {
            ...n.style,
            opacity: 0,
            pointerEvents: 'none' as const,
          },
    };
  });

  const displayEdges = edges.map((e) => {
    const visible = visibleIds.has(e.source) && visibleIds.has(e.target);
    return {
      ...e,
      hidden: !visible,
      selectable: visible,
      style: visible
        ? e.style
        : {
            ...e.style,
            opacity: 0,
            pointerEvents: 'none' as const,
          },
    };
  });

  return { nodes: displayNodes, edges: displayEdges };
}
