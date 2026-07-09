// ============================================
// Build ChatRequest.context slice for graph UI
// ============================================

import {
  GRAPH_AI_CHAT_CONTEXT_KEY,
  GRAPH_AI_CHAT_SCHEMA_VERSION,
  type GraphAiChatContextV1,
  type GraphAiChatHeavyV1,
} from './graph-ai-chat-contract';
import type {
  GraphData,
  GraphNode,
  InspectorTarget,
} from '@/types/graph-explorer.types';
import type { PathfindingMode } from './graph-pathfinding';
import type { PathfindingLayerState } from './pathfinding-layer-state';

const VISIBLE_NODE_SAMPLE_CAP = 80;

function focusFromInspector(target: InspectorTarget): GraphAiChatContextV1['focus'] {
  if (!target) return null;
  if (target.kind === 'node') {
    const n = target.item;
    return {
      kind: 'node',
      id: n.id,
      label: n.label,
      entity_type: n.type,
      case_id: n.case_id,
      artifact_id: n.artifact_id,
      community_id: n.community_id,
    };
  }
  if (target.kind === 'link') {
    const l = target.item;
    return {
      kind: 'link',
      id: l.id,
      label: l.description || l.relation,
      relation: l.relation,
      case_id: l.case_id,
      artifact_id: l.artifact_id,
    };
  }
  return {
    kind: 'community',
    id: String(target.item.community_id ?? 'community'),
    label: target.item.title,
    community_id: target.item.community_id,
  };
}

function buildHeavy(
  graphData: GraphData,
  target: InspectorTarget,
  includeHeavy: boolean
): GraphAiChatHeavyV1 | null {
  if (!includeHeavy) return null;

  let focus_record: Record<string, unknown> | null = null;
  if (target?.kind === 'node') {
    focus_record = { ...target.item } as Record<string, unknown>;
  } else if (target?.kind === 'link') {
    focus_record = { ...target.item } as Record<string, unknown>;
  }

  const visible_node_id_sample = graphData.nodes
    .filter((n) => !n.hidden)
    .slice(0, VISIBLE_NODE_SAMPLE_CAP)
    .map((n) => n.id);

  return {
    stats: graphData.stats ?? null,
    extraction_meta: graphData.extraction_meta ?? null,
    focus_record,
    visible_node_id_sample,
  };
}

export interface BuildGraphAiChatContextParams {
  pathname: string;
  href: string;
  dataSource: 'route' | 'session';
  routeCaseIds: string[];
  graphData: GraphData;
  visibleNodes: number;
  visibleLinks: number;
  inspectorTarget: InspectorTarget;
  queryFilterActive: boolean;
  pathfindingOpen: boolean;
  pathMode: PathfindingMode | null;
  pathSourceNode: GraphNode | null;
  pathTargetNode: GraphNode | null;
  /** Stacked path results on the graph (optional). */
  pathLayers?: PathfindingLayerState[];
  userNoteTrimmed: string | null;
  includeHeavy: boolean;
}

/**
 * Returns the object to assign to `ChatRequest.context` (may be merged with
 * other feature keys later — keep graph under `GRAPH_AI_CHAT_CONTEXT_KEY` only).
 */
export function buildGraphAiChatRequestContext(
  params: BuildGraphAiChatContextParams
): Record<string, unknown> {
  const body: GraphAiChatContextV1 = {
    schema_version: GRAPH_AI_CHAT_SCHEMA_VERSION,
    captured_at: new Date().toISOString(),
    client: {
      pathname: params.pathname,
      href: params.href,
    },
    surface: 'standalone_visual_explorer',
    data_source: params.dataSource,
    route_case_ids: params.routeCaseIds,
    graph: {
      total_nodes: params.graphData.nodes.length,
      total_links: params.graphData.links.length,
      visible_nodes: params.visibleNodes,
      visible_links: params.visibleLinks,
    },
    filter: {
      query_builder_narrowed: params.queryFilterActive,
    },
    focus: focusFromInspector(params.inspectorTarget),
    pathfinding: {
      active: params.pathfindingOpen,
      mode: params.pathMode,
      source_node_id: params.pathSourceNode?.id ?? null,
      target_node_id: params.pathTargetNode?.id ?? null,
      ...(params.pathLayers?.length
        ? {
            result_layers: params.pathLayers.map((l) => ({
              source_node_id: l.sourceNode.id,
              target_node_id: l.targetNode.id,
              mode: l.mode,
              highlight: l.highlightEnabled,
            })),
          }
        : {}),
    },
    user_note: params.userNoteTrimmed,
    heavy: buildHeavy(params.graphData, params.inspectorTarget, params.includeHeavy),
  };

  return {
    [GRAPH_AI_CHAT_CONTEXT_KEY]: body,
  };
}
