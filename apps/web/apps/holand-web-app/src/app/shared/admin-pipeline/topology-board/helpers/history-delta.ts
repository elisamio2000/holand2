import type { TopologyEdge, TopologyNode } from './topology-board-types';

export type Snap = { nodes: TopologyNode[]; edges: TopologyEdge[] };

export type GraphDelta = {
  nodesAdded?: TopologyNode[];
  nodesRemoved?: string[];
  nodesMoved?: Array<{ id: string; position: { x: number; y: number } }>;
  nodesReplaced?: TopologyNode[];
  edgesAdded?: TopologyEdge[];
  edgesRemoved?: string[];
  edgesReplaced?: TopologyEdge[];
};

export type HistoryEntry =
  | { kind: 'full'; snap: Snap; ts: number }
  | { kind: 'delta'; delta: GraphDelta; ts: number };

export function cloneSnap(s: Snap): Snap {
  return {
    nodes: s.nodes.map((n) => ({ ...n, data: { ...n.data } })),
    edges: s.edges.map((e) => ({ ...e, data: { ...e.data } })) as TopologyEdge[],
  };
}

function nodeSignature(n: TopologyNode): string {
  return `${n.id}:${n.position.x},${n.position.y}:${JSON.stringify(n.data)}`;
}

function edgeSignature(e: TopologyEdge): string {
  return `${e.id}:${e.source}->${e.target}:${JSON.stringify(e.data)}`;
}

export function diffSnaps(prev: Snap, next: Snap): GraphDelta | null {
  const prevNodeIds = new Set(prev.nodes.map((n) => n.id));
  const nextNodeIds = new Set(next.nodes.map((n) => n.id));
  const prevEdgeIds = new Set(prev.edges.map((e) => e.id));
  const nextEdgeIds = new Set(next.edges.map((e) => e.id));

  const nodesAdded = next.nodes.filter((n) => !prevNodeIds.has(n.id));
  const nodesRemoved = prev.nodes.filter((n) => !nextNodeIds.has(n.id)).map((n) => n.id);
  const nodesMoved: GraphDelta['nodesMoved'] = [];
  const nodesReplaced: TopologyNode[] = [];

  next.nodes.forEach((n) => {
    if (!prevNodeIds.has(n.id)) return;
    const p = prev.nodes.find((x) => x.id === n.id)!;
    const moved =
      p.position.x !== n.position.x || p.position.y !== n.position.y;
    const changed = nodeSignature(p) !== nodeSignature(n);
    if (moved && !changed) {
      nodesMoved.push({ id: n.id, position: { ...n.position } });
    } else if (changed) {
      nodesReplaced.push(n);
    }
  });

  const edgesAdded = next.edges.filter((e) => !prevEdgeIds.has(e.id));
  const edgesRemoved = prev.edges.filter((e) => !nextEdgeIds.has(e.id)).map((e) => e.id);
  const edgesReplaced: TopologyEdge[] = [];

  next.edges.forEach((e) => {
    if (!prevEdgeIds.has(e.id)) return;
    const p = prev.edges.find((x) => x.id === e.id)!;
    if (edgeSignature(p) !== edgeSignature(e)) {
      edgesReplaced.push(e);
    }
  });

  const delta: GraphDelta = {};
  if (nodesAdded.length) delta.nodesAdded = nodesAdded;
  if (nodesRemoved.length) delta.nodesRemoved = nodesRemoved;
  if (nodesMoved.length) delta.nodesMoved = nodesMoved;
  if (nodesReplaced.length) delta.nodesReplaced = nodesReplaced;
  if (edgesAdded.length) delta.edgesAdded = edgesAdded;
  if (edgesRemoved.length) delta.edgesRemoved = edgesRemoved;
  if (edgesReplaced.length) delta.edgesReplaced = edgesReplaced;

  return Object.keys(delta).length ? delta : null;
}

export function deltaChangeCount(delta: GraphDelta): number {
  return (
    (delta.nodesAdded?.length ?? 0) +
    (delta.nodesRemoved?.length ?? 0) +
    (delta.nodesMoved?.length ?? 0) +
    (delta.nodesReplaced?.length ?? 0) +
    (delta.edgesAdded?.length ?? 0) +
    (delta.edgesRemoved?.length ?? 0) +
    (delta.edgesReplaced?.length ?? 0)
  );
}

export function shouldUseFullSnapshot(delta: GraphDelta, nodeCount: number): boolean {
  if (nodeCount === 0) return true;
  const ratio = deltaChangeCount(delta) / Math.max(nodeCount, 1);
  return ratio > 0.35 || deltaChangeCount(delta) > 24;
}

export function applyDelta(snap: Snap, delta: GraphDelta): Snap {
  let nodes = [...snap.nodes];
  let edges = [...snap.edges];

  if (delta.nodesRemoved?.length) {
    const removed = new Set(delta.nodesRemoved);
    nodes = nodes.filter((n) => !removed.has(n.id));
  }
  if (delta.nodesReplaced?.length) {
    const map = new Map(delta.nodesReplaced.map((n) => [n.id, n]));
    nodes = nodes.map((n) => map.get(n.id) ?? n);
  }
  if (delta.nodesMoved?.length) {
    const map = new Map(delta.nodesMoved.map((m) => [m.id, m.position]));
    nodes = nodes.map((n) =>
      map.has(n.id) ? { ...n, position: map.get(n.id)! } : n
    );
  }
  if (delta.nodesAdded?.length) {
    nodes = [...nodes, ...delta.nodesAdded];
  }

  if (delta.edgesRemoved?.length) {
    const removed = new Set(delta.edgesRemoved);
    edges = edges.filter((e) => !removed.has(e.id));
  }
  if (delta.edgesReplaced?.length) {
    const map = new Map(delta.edgesReplaced.map((e) => [e.id, e]));
    edges = edges.map((e) => map.get(e.id) ?? e) as TopologyEdge[];
  }
  if (delta.edgesAdded?.length) {
    edges = [...edges, ...delta.edgesAdded];
  }

  return { nodes, edges };
}

export function revertDelta(snap: Snap, delta: GraphDelta): Snap {
  let nodes = [...snap.nodes];
  let edges = [...snap.edges];

  if (delta.nodesAdded?.length) {
    const added = new Set(delta.nodesAdded.map((n) => n.id));
    nodes = nodes.filter((n) => !added.has(n.id));
  }
  if (delta.nodesRemoved?.length) {
    const prevRemoved = delta.nodesRemoved
      .map((id) => snap.nodes.find((n) => n.id === id))
      .filter(Boolean) as TopologyNode[];
    nodes = [...nodes, ...prevRemoved];
  }
  if (delta.nodesMoved?.length) {
    // revert moves requires prior positions — use nodesReplaced if present
  }
  if (delta.nodesReplaced?.length) {
    // Cannot revert without prior; caller should use full snapshots for complex undo
  }

  if (delta.edgesAdded?.length) {
    const added = new Set(delta.edgesAdded.map((e) => e.id));
    edges = edges.filter((e) => !added.has(e.id));
  }
  if (delta.edgesRemoved?.length) {
    const prevRemoved = delta.edgesRemoved
      .map((id) => snap.edges.find((e) => e.id === id))
      .filter(Boolean) as TopologyEdge[];
    edges = [...edges, ...prevRemoved];
  }

  return { nodes, edges };
}

export function stateAtIndex(history: HistoryEntry[], index: number): Snap {
  let anchor = index;
  while (anchor >= 0 && history[anchor].kind !== 'full') anchor -= 1;
  if (anchor < 0) {
    const first = history[0];
    return first?.kind === 'full' ? cloneSnap(first.snap) : { nodes: [], edges: [] };
  }
  let snap = cloneSnap((history[anchor] as Extract<HistoryEntry, { kind: 'full' }>).snap);
  for (let i = anchor + 1; i <= index; i++) {
    const entry = history[i];
    if (entry.kind === 'delta') {
      snap = applyDelta(snap, entry.delta);
    } else {
      snap = cloneSnap(entry.snap);
    }
  }
  return snap;
}

export function ensureLeadingFull(entries: HistoryEntry[]): HistoryEntry[] {
  if (entries.length === 0) return [{ kind: 'full', snap: { nodes: [], edges: [] }, ts: Date.now() }];
  if (entries[0].kind === 'full') return entries;
  return [{ kind: 'full', snap: { nodes: [], edges: [] }, ts: Date.now() }, ...entries];
}
