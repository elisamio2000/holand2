import type { EntityType, GraphData, GraphLink, GraphNode, RelationType } from '@/types/graph-explorer.types';
import type {
  BoardConnectorKind,
  BoardConnectorObject,
  BoardNodeObject,
  BoardNodeRole,
  BoardSnapshot,
} from '../board-types';
import { extractGraphTopology } from './graph-sync';

const BOARD_CASE_ID = 'board';

const NODE_ROLE_TO_ENTITY: Record<BoardNodeRole, EntityType> = {
  person: 'person',
  organization: 'organization',
  evidence: 'document',
  topic: 'project',
  question: 'unknown',
  custom: 'unknown',
};

const CONNECTOR_KIND_TO_RELATION: Record<BoardConnectorKind, RelationType> = {
  link: 'RELATED_TO',
  flow: 'LEADS',
  reference: 'RELATED_TO',
};

function countAttachmentsForNode(snapshot: BoardSnapshot, nodeId: string): number {
  return (snapshot.comments ?? []).filter((c) => c.objectId === nodeId).length;
}

function countStickiesNearNode(snapshot: BoardSnapshot, nodeId: string): number {
  const node = snapshot.objects.find((o) => o.id === nodeId && o.type === 'node') as BoardNodeObject | undefined;
  if (!node) return 0;
  const pad = 40;
  return snapshot.objects.filter((o) => {
    if (o.type !== 'sticky') return false;
    const sx = o.x + o.width / 2;
    const sy = o.y + o.height / 2;
    return (
      sx >= node.x - pad &&
      sx <= node.x + node.width + pad &&
      sy >= node.y - pad &&
      sy <= node.y + node.height + pad
    );
  }).length;
}

function boardNodeToGraphNode(
  node: BoardNodeObject,
  snapshot: BoardSnapshot,
  layout?: { x: number; y: number }
): GraphNode {
  const pos = layout ?? { x: node.x, y: node.y };
  const attachmentCount = countAttachmentsForNode(snapshot, node.id);
  const noteCount = countStickiesNearNode(snapshot, node.id);

  return {
    id: node.id,
    label: node.label || node.id,
    type: NODE_ROLE_TO_ENTITY[node.nodeRole] ?? 'unknown',
    description: node.description ?? '',
    community_id: null,
    case_id: BOARD_CASE_ID,
    artifact_id: '',
    origin: 'board',
    properties: {
      boardNodeRole: node.nodeRole,
      attachmentCount,
      noteCount,
      color: node.color,
    },
    x: pos.x,
    y: pos.y,
    fx: layout ? pos.x : undefined,
    fy: layout ? pos.y : undefined,
    pinned: Boolean(layout),
    locked: Boolean(node.locked),
    hidden: false,
    connectionCount: 0,
  };
}

function boardConnectorToGraphLink(conn: BoardConnectorObject): GraphLink {
  const kind = conn.kind ?? 'flow';
  return {
    id: conn.id,
    source: conn.sourceId,
    target: conn.targetId,
    relation: CONNECTOR_KIND_TO_RELATION[kind],
    description: conn.label ?? conn.note ?? '',
    strength: 1,
    case_id: BOARD_CASE_ID,
    artifact_id: '',
    origin: 'board',
    properties: {
      boardConnectorKind: kind,
      routeStyle: conn.routeStyle,
    },
  };
}

/** Convert board snapshot topology into Graph Explorer GraphData. */
export function boardSnapshotToGraphData(snapshot: BoardSnapshot): GraphData {
  const topology = extractGraphTopology(snapshot);
  const nodeObjects = snapshot.objects.filter((o): o is BoardNodeObject => o.type === 'node');
  const nodeIds = new Set(nodeObjects.map((n) => n.id));

  const nodes: GraphNode[] = nodeObjects.map((node) => {
    const layout = snapshot.graphLayout?.[node.id];
    return boardNodeToGraphNode(node, snapshot, layout);
  });

  const links: GraphLink[] = topology.connectors
    .filter((c) => nodeIds.has(c.sourceId) && nodeIds.has(c.targetId))
    .map(boardConnectorToGraphLink);

  const connectionCounts = new Map<string, number>();
  for (const link of links) {
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    connectionCounts.set(src, (connectionCounts.get(src) ?? 0) + 1);
    connectionCounts.set(tgt, (connectionCounts.get(tgt) ?? 0) + 1);
  }
  for (const node of nodes) {
    node.connectionCount = connectionCounts.get(node.id) ?? 0;
  }

  return {
    nodes,
    links,
    communities: [],
    community_reports: [],
    stats: {
      entity_count: nodes.length,
      relationship_count: links.length,
      community_count: 0,
      report_count: 0,
    },
  };
}

export { NODE_ROLE_TO_ENTITY, CONNECTOR_KIND_TO_RELATION };
