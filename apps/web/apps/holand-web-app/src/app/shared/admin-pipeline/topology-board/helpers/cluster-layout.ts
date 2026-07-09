import { entityNodeId, type TopologyEdge, type TopologyNode } from './topology-board-types';

const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 64;

function withSize(node: TopologyNode): TopologyNode {
  return {
    ...node,
    width: node.width ?? DEFAULT_NODE_WIDTH,
    height: node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

export type TopologyClusterMode = 'none' | 'byModel' | 'byRemoteNode';

const AUTO_GROUP_PREFIX = 'group:auto:';
const GROUP_PAD = 28;
const ROW_GAP = 72;
const GROUP_GAP = 320;

function isAutoGroup(id: string): boolean {
  return id.startsWith(AUTO_GROUP_PREFIX);
}

export function stripAutoGroups(nodes: TopologyNode[]): TopologyNode[] {
  const autoIds = new Set(
    nodes.filter((n) => n.data.kind === 'group' && isAutoGroup(n.id)).map((n) => n.id)
  );
  return nodes
    .filter((n) => !autoIds.has(n.id))
    .map((n) =>
      n.parentId && autoIds.has(n.parentId)
        ? { ...n, parentId: undefined, extent: undefined, position: { ...n.position } }
        : n
    );
}

function createAutoGroup(
  key: string,
  label: string,
  childCount: number
): TopologyNode {
  const id = `${AUTO_GROUP_PREFIX}${key}`;
  const height = Math.max(120, 56 + childCount * ROW_GAP + GROUP_PAD);
  return withSize({
    id,
    type: 'topoGroup',
    position: { x: 0, y: 0 },
    width: 220,
    height,
    data: {
      kind: 'group',
      label,
      entityId: key,
      groupLabel: label,
      groupColor: '#6366f1',
      autoCluster: true,
    },
  });
}

function layoutMembersInGroup(
  members: TopologyNode[],
  groupId: string
): TopologyNode[] {
  return members.map((n, i) => ({
    ...n,
    parentId: groupId,
    extent: 'parent' as const,
    position: { x: GROUP_PAD, y: 40 + i * ROW_GAP },
  }));
}

function positionRootGroups(nodes: TopologyNode[]): TopologyNode[] {
  const groups = nodes.filter((n) => n.data.kind === 'group' && isAutoGroup(n.id));
  if (groups.length === 0) return nodes;
  const posMap = new Map<string, { x: number; y: number }>();
  groups.forEach((g, i) => {
    posMap.set(g.id, { x: 80 + i * GROUP_GAP, y: 80 });
  });
  return nodes.map((n) =>
    posMap.has(n.id) ? { ...n, position: posMap.get(n.id)! } : n
  );
}

export function applyClusterMode(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  mode: TopologyClusterMode
): TopologyNode[] {
  const base = stripAutoGroups(nodes);
  if (mode === 'none') return base;

  const nodeMap = new Map(base.map((n) => [n.id, n]));
  const claimed = new Set<string>();
  const newGroups: TopologyNode[] = [];
  let updated = [...base];

  const claimCluster = (anchorId: string, memberIds: string[], label: string, key: string) => {
    const members = memberIds
      .filter((id) => nodeMap.has(id))
      .filter((id) => !claimed.has(id) || id === anchorId);
    if (members.length < 2) return;
    members.forEach((id) => claimed.add(id));
    const group = createAutoGroup(key, label, members.length);
    newGroups.push(group);
    const laid = layoutMembersInGroup(
      members.map((id) => nodeMap.get(id)!),
      group.id
    );
    updated = updated.map((n) => laid.find((m) => m.id === n.id) ?? n);
  };

  if (mode === 'byModel') {
    base
      .filter((n) => n.data.kind === 'model')
      .forEach((model) => {
        const cluster = new Set<string>([model.id]);
        edges.forEach((e) => {
          if (e.source === model.id) cluster.add(e.target);
          if (e.target === model.id) cluster.add(e.source);
        });
        claimCluster(
          model.id,
          [...cluster],
          model.data.label,
          `model:${model.data.entityId}`
        );
      });
  } else {
    base
      .filter((n) => n.data.kind === 'remoteNode')
      .forEach((rn) => {
        const cluster = new Set<string>([rn.id]);
        edges.forEach((e) => {
          if (e.source === rn.id || e.target === rn.id) {
            cluster.add(e.source);
            cluster.add(e.target);
          }
        });
        claimCluster(
          rn.id,
          [...cluster],
          rn.data.label,
          `node:${rn.data.entityId}`
        );
      });
  }

  const unclaimed = updated.filter((n) => !claimed.has(n.id) && n.data.kind !== 'group');
  return positionRootGroups([...updated, ...newGroups]);
}

export function rebuildClusters(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  mode: TopologyClusterMode
): TopologyNode[] {
  return applyClusterMode(nodes, edges, mode);
}
