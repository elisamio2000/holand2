import type { TopologyEdge, TopologyNode } from './topology-board-types';
import { ENTITY_REGISTRY } from './entity-registry';
import { getCachedElkLayout, hashGraphLayout, setCachedElkLayout } from './layout-storage';
import type { TopologyClusterMode } from './topology-board-settings';
import { rebuildClusters } from './cluster-layout';

const ROW_GAP = 72;

export function applyColumnLayout(nodes: TopologyNode[]): TopologyNode[] {
  const counts: Record<string, number> = {};
  return nodes.map((n) => {
    const kind = n.data.kind;
    const meta = ENTITY_REGISTRY[kind];
    const idx = counts[kind] ?? 0;
    counts[kind] = idx + 1;
    return {
      ...n,
      position: {
        x: meta.defaultX,
        y: 40 + idx * ROW_GAP,
      },
    };
  });
}

export function applyRadialLayout(nodes: TopologyNode[], edges: TopologyEdge[]): TopologyNode[] {
  const layers = [0, 1, 2, 3];
  const byLayer = layers.map((layer) =>
    nodes.filter((n) => {
      switch (n.data.kind) {
        case 'tool':
        case 'plugin':
        case 'service':
          return layer === 0;
        case 'route':
        case 'role':
          return layer === 1;
        case 'model':
          return layer === 2;
        case 'endpoint':
        case 'remoteNode':
          return layer === 3;
        default:
          return layer === 0;
      }
    })
  );
  const cx = 400;
  const cy = 320;
  const result = new Map<string, { x: number; y: number }>();
  byLayer.forEach((layerNodes, layerIdx) => {
    const radius = 120 + layerIdx * 100;
    layerNodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(layerNodes.length, 1);
      result.set(n.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  });
  return nodes.map((n) => ({
    ...n,
    position: result.get(n.id) ?? n.position,
  }));
}

export async function applyElkLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[] = []
): Promise<TopologyNode[]> {
  const graphHash = hashGraphLayout(
    nodes.map((n) => n.id),
    edges.map((e) => ({ source: e.source, target: e.target }))
  );
  const cached = getCachedElkLayout(graphHash);
  if (cached) {
    return nodes.map((n) => ({
      ...n,
      position: cached[n.id] ?? n.position,
    }));
  }

  try {
    const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
    const elk = new ELK();
    const children = nodes.map((n) => ({
      id: n.id,
      width: n.width ?? 180,
      height: n.height ?? 56,
      layoutOptions: {
        'elk.layered.layering.layerConstraint': String(layerZForKind(n.data.kind)),
      },
    }));
    const elkEdges = edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    }));
    const layout = await elk.layout({
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '48',
        'elk.layered.spacing.nodeNodeBetweenLayers': '64',
      },
      children,
      edges: elkEdges,
    });
    const posMap = new Map<string, { x: number; y: number }>();
    layout.children?.forEach((c) => {
      if (c.id && c.x != null && c.y != null) posMap.set(c.id, { x: c.x, y: c.y });
    });
    const positions: Record<string, { x: number; y: number }> = {};
    posMap.forEach((pos, id) => {
      positions[id] = pos;
    });
    setCachedElkLayout(graphHash, positions);
    return nodes.map((n) => ({
      ...n,
      position: posMap.get(n.id) ?? n.position,
    }));
  } catch {
    return applyColumnLayout(nodes);
  }
}

export async function applyTopologyLayout(
  algorithm: 'elk' | 'column' | 'radial',
  nodes: TopologyNode[],
  edges: TopologyEdge[]
): Promise<TopologyNode[]> {
  switch (algorithm) {
    case 'radial':
      return applyRadialLayout(nodes, edges);
    case 'column':
      return applyColumnLayout(nodes);
    default:
      return applyElkLayout(nodes, edges);
  }
}

function resolveRootId(nodes: TopologyNode[], nodeId: string): string {
  const parentMap = new Map(nodes.map((n) => [n.id, n.parentId]));
  let cur = nodeId;
  while (parentMap.get(cur)) {
    cur = parentMap.get(cur)!;
  }
  return cur;
}

/** Collapse edges to root-level nodes (cluster groups) for layout. */
export function collapseEdgesToRoots(
  nodes: TopologyNode[],
  edges: TopologyEdge[]
): TopologyEdge[] {
  const seen = new Set<string>();
  const out: TopologyEdge[] = [];
  for (const e of edges) {
    const source = resolveRootId(nodes, e.source);
    const target = resolveRootId(nodes, e.target);
    if (source === target) continue;
    const id = `layout:${source}->${target}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...e, id, source, target });
  }
  return out;
}

/**
 * Rebuild clusters (when enabled) then apply the selected layout to root nodes only.
 * Children inside auto-groups keep their in-group positions.
 */
export async function layoutTopologyGraph(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  clusterMode: TopologyClusterMode,
  algorithm: 'elk' | 'column' | 'radial'
): Promise<TopologyNode[]> {
  const clustered = rebuildClusters(nodes, edges, clusterMode);
  const roots = clustered.filter((n) => !n.parentId);
  if (roots.length === 0) return clustered;

  const rootEdges = collapseEdgesToRoots(clustered, edges);
  const laidRoots = await applyTopologyLayout(algorithm, roots, rootEdges);
  const posById = new Map(laidRoots.map((n) => [n.id, n.position]));

  if (clusterMode !== 'none' && algorithm === 'column') {
    let groupIdx = 0;
    for (const n of laidRoots) {
      if (n.data.kind === 'group') {
        posById.set(n.id, { x: 80 + groupIdx * 320, y: 80 });
        groupIdx += 1;
      }
    }
  }

  return clustered.map((n) =>
    n.parentId ? n : { ...n, position: posById.get(n.id) ?? n.position }
  );
}

export function layerZForKind(kind: string): number {
  switch (kind) {
    case 'tool':
    case 'plugin':
    case 'service':
      return 0;
    case 'route':
    case 'role':
      return 1;
    case 'model':
      return 2;
    case 'endpoint':
    case 'remoteNode':
      return 3;
    default:
      return 0;
  }
}

export const FLOOR_LABEL_KEYS = [
  'pipeline.topology.board.floors.tools',
  'pipeline.topology.board.floors.routes',
  'pipeline.topology.board.floors.models',
  'pipeline.topology.board.floors.infra',
] as const;
