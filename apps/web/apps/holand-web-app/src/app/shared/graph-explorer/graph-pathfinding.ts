/**
 * Graph pathfinding: Dijkstra (shortest), widest path (strongest), Yen's K-shortest.
 * Graph shapes match @/types/graph-explorer.types (undirected traversal).
 */

import type {
  GraphData,
  GraphLink,
  GraphNode,
  PathConstraints,
  PathfindingComputation,
  PathfindingEdgeStep,
} from '@/types/graph-explorer.types';

function linkEndpointId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id;
}

class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min.item;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].priority >= this.heap[parentIndex].priority) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }
      if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

interface GraphAdjacency {
  adjacency: Map<string, Array<{ neighbor: string; link: GraphLink }>>;
  nodeMap: Map<string, GraphNode>;
}

function buildAdjacencyList(graphData: GraphData): GraphAdjacency {
  const adjacency = new Map<string, Array<{ neighbor: string; link: GraphLink }>>();
  const nodeMap = new Map<string, GraphNode>();

  graphData.nodes.forEach((node) => {
    adjacency.set(node.id, []);
    nodeMap.set(node.id, node);
  });

  graphData.links.forEach((link) => {
    const sourceId = linkEndpointId(link.source);
    const targetId = linkEndpointId(link.target);
    adjacency.get(sourceId)?.push({ neighbor: targetId, link });
    adjacency.get(targetId)?.push({ neighbor: sourceId, link });
  });

  return { adjacency, nodeMap };
}

function isNodeAllowed(
  nodeId: string,
  nodeMap: Map<string, GraphNode>,
  constraints: PathConstraints | undefined,
  isEndpoint: boolean
): boolean {
  if (!constraints) return true;
  if (isEndpoint) return true;

  const node = nodeMap.get(nodeId);
  if (!node) return false;

  if (constraints.blockedNodes?.includes(nodeId)) return false;
  if (constraints.blockedNodeTypes?.includes(node.type)) return false;

  if (
    constraints.allowedNodeTypes &&
    constraints.allowedNodeTypes.length > 0 &&
    !constraints.allowedNodeTypes.includes(node.type)
  ) {
    return false;
  }

  if (constraints.requireAllProperty && constraints.requireAllProperty.length > 0) {
    for (const req of constraints.requireAllProperty) {
      const val = node.properties?.[req.key];
      if (val === undefined) return false;
      if (req.value !== undefined && String(val) !== req.value) return false;
    }
  }

  return true;
}

function isEdgeAllowed(link: GraphLink, constraints: PathConstraints | undefined): boolean {
  if (!constraints) return true;
  if (
    constraints.allowedRelations &&
    constraints.allowedRelations.length > 0 &&
    !constraints.allowedRelations.includes(String(link.relation))
  ) {
    return false;
  }
  return true;
}

function pathSatisfiesAnyProperty(
  path: string[],
  nodeMap: Map<string, GraphNode>,
  constraints: PathConstraints | undefined
): boolean {
  if (!constraints?.requireAnyProperty || constraints.requireAnyProperty.length === 0) {
    return true;
  }
  return path.some((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return false;
    return constraints.requireAnyProperty!.every((req) => {
      const val = node.properties?.[req.key];
      if (val === undefined) return false;
      if (req.value !== undefined && String(val) !== req.value) return false;
      return true;
    });
  });
}

export function findShortestPath(
  graphData: GraphData,
  sourceId: string,
  targetId: string,
  weighted: boolean = false,
  constraints?: PathConstraints
): PathfindingComputation {
  const { adjacency, nodeMap } = buildAdjacencyList(graphData);

  if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
    return { path: [], totalWeight: Infinity, hops: 0, edges: [], found: false };
  }

  if (sourceId === targetId) {
    return { path: [sourceId], totalWeight: 0, hops: 0, edges: [], found: true };
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; link: GraphLink } | null>();
  const pq = new PriorityQueue<string>();

  nodeMap.forEach((_, nodeId) => {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  });

  distances.set(sourceId, 0);
  pq.enqueue(sourceId, 0);

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    const currentDist = distances.get(current)!;

    if (current === targetId) break;
    if (currentDist === Infinity) continue;

    const neighbors = adjacency.get(current) || [];
    for (const { neighbor, link } of neighbors) {
      if (!isEdgeAllowed(link, constraints)) continue;
      const isEndpoint = neighbor === sourceId || neighbor === targetId;
      if (!isNodeAllowed(neighbor, nodeMap, constraints, isEndpoint)) continue;

      const edgeWeight = weighted ? 11 - (link.strength ?? 5) : 1;
      const newDist = currentDist + edgeWeight;

      if (newDist < distances.get(neighbor)!) {
        distances.set(neighbor, newDist);
        previous.set(neighbor, { nodeId: current, link });
        pq.enqueue(neighbor, newDist);
      }
    }
  }

  const path: string[] = [];
  const edges: PathfindingEdgeStep[] = [];
  let current: string | null = targetId;

  while (current !== null) {
    path.unshift(current);
    const prev = previous.get(current);
    if (prev) {
      edges.unshift({
        source: prev.nodeId,
        target: current,
        relation: String(prev.link.relation),
        strength: prev.link.strength ?? 5,
      });
      current = prev.nodeId;
    } else {
      current = null;
    }
  }

  const found =
    path.length > 0 && path[0] === sourceId && pathSatisfiesAnyProperty(path, nodeMap, constraints);
  const totalWeight = found ? distances.get(targetId)! : Infinity;

  return {
    path: found ? path : [],
    totalWeight,
    hops: found ? path.length - 1 : 0,
    edges: found ? edges : [],
    found,
  };
}

export function findStrongestPath(
  graphData: GraphData,
  sourceId: string,
  targetId: string,
  constraints?: PathConstraints
): PathfindingComputation {
  const { adjacency, nodeMap } = buildAdjacencyList(graphData);

  if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
    return { path: [], totalWeight: 0, hops: 0, edges: [], found: false };
  }

  if (sourceId === targetId) {
    return { path: [sourceId], totalWeight: 0, hops: 0, edges: [], found: true };
  }

  const maxBottleneck = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; link: GraphLink } | null>();
  const pq = new PriorityQueue<string>();
  const visited = new Set<string>();

  nodeMap.forEach((_, nodeId) => {
    maxBottleneck.set(nodeId, -Infinity);
    previous.set(nodeId, null);
  });

  maxBottleneck.set(sourceId, Infinity);
  pq.enqueue(sourceId, 0);

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === targetId) break;

    const currentBottleneck = maxBottleneck.get(current)!;
    if (currentBottleneck === -Infinity) continue;

    const neighbors = adjacency.get(current) || [];
    for (const { neighbor, link } of neighbors) {
      if (visited.has(neighbor)) continue;
      if (!isEdgeAllowed(link, constraints)) continue;
      const isEndpoint = neighbor === sourceId || neighbor === targetId;
      if (!isNodeAllowed(neighbor, nodeMap, constraints, isEndpoint)) continue;

      const edgeStrength = link.strength ?? 5;
      const newBottleneck = Math.min(currentBottleneck, edgeStrength);

      if (newBottleneck > (maxBottleneck.get(neighbor) ?? -Infinity)) {
        maxBottleneck.set(neighbor, newBottleneck);
        previous.set(neighbor, { nodeId: current, link });
        pq.enqueue(neighbor, -newBottleneck);
      }
    }
  }

  const path: string[] = [];
  const edges: PathfindingEdgeStep[] = [];
  let cur: string | null = targetId;

  while (cur !== null) {
    path.unshift(cur);
    const prev = previous.get(cur);
    if (prev) {
      edges.unshift({
        source: prev.nodeId,
        target: cur,
        relation: String(prev.link.relation),
        strength: prev.link.strength ?? 5,
      });
      cur = prev.nodeId;
    } else {
      cur = null;
    }
  }

  const found =
    path.length > 0 && path[0] === sourceId && pathSatisfiesAnyProperty(path, nodeMap, constraints);
  const totalWeight = found ? edges.reduce((sum, e) => sum + e.strength, 0) : 0;

  return {
    path: found ? path : [],
    totalWeight,
    hops: found ? path.length - 1 : 0,
    edges: found ? edges : [],
    found,
  };
}

export function findKShortestPaths(
  graphData: GraphData,
  sourceId: string,
  targetId: string,
  K: number = 3,
  constraints?: PathConstraints
): PathfindingComputation[] {
  function dijkstraConstrained(
    adjacency: Map<string, Array<{ neighbor: string; link: GraphLink }>>,
    nodeMap: Map<string, GraphNode>,
    src: string,
    tgt: string,
    removedEdges: Set<string>,
    removedNodes: Set<string>
  ): PathfindingComputation | null {
    if (!nodeMap.has(src) || !nodeMap.has(tgt)) return null;
    if (removedNodes.has(src) || removedNodes.has(tgt)) return null;

    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; link: GraphLink } | null>();
    const pq = new PriorityQueue<string>();

    nodeMap.forEach((_, id) => {
      distances.set(id, Infinity);
      previous.set(id, null);
    });
    distances.set(src, 0);
    pq.enqueue(src, 0);

    while (!pq.isEmpty()) {
      const current = pq.dequeue()!;
      if (current === tgt) break;
      const currentDist = distances.get(current)!;
      if (currentDist === Infinity) continue;

      const neighbors = adjacency.get(current) || [];
      for (const { neighbor, link } of neighbors) {
        if (removedNodes.has(neighbor)) continue;
        const edgeKey1 = `${current}|${neighbor}`;
        const edgeKey2 = `${neighbor}|${current}`;
        if (removedEdges.has(edgeKey1) || removedEdges.has(edgeKey2)) continue;
        if (!isEdgeAllowed(link, constraints)) continue;
        const isEndpoint = neighbor === src || neighbor === tgt;
        if (!isNodeAllowed(neighbor, nodeMap, constraints, isEndpoint)) continue;

        const edgeWeight = 11 - (link.strength ?? 5);
        const newDist = currentDist + edgeWeight;
        if (newDist < distances.get(neighbor)!) {
          distances.set(neighbor, newDist);
          previous.set(neighbor, { nodeId: current, link });
          pq.enqueue(neighbor, newDist);
        }
      }
    }

    const path: string[] = [];
    const edges: PathfindingEdgeStep[] = [];
    let c: string | null = tgt;
    while (c !== null) {
      path.unshift(c);
      const prev = previous.get(c);
      if (prev) {
        edges.unshift({
          source: prev.nodeId,
          target: c,
          relation: String(prev.link.relation),
          strength: prev.link.strength ?? 5,
        });
        c = prev.nodeId;
      } else {
        c = null;
      }
    }
    const found =
      path.length > 0 && path[0] === src && pathSatisfiesAnyProperty(path, nodeMap, constraints);
    if (!found) return null;
    return {
      path,
      totalWeight: edges.reduce((s, e) => s + e.strength, 0),
      hops: path.length - 1,
      edges,
      found: true,
    };
  }

  const { adjacency, nodeMap } = buildAdjacencyList(graphData);

  const A: PathfindingComputation[] = [];
  const B: PathfindingComputation[] = [];

  const first = findShortestPath(graphData, sourceId, targetId, true, constraints);
  if (!first.found) return [];
  A.push(first);

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1];

    for (let i = 0; i < prevPath.path.length - 1; i++) {
      const spurNode = prevPath.path[i];
      const rootPath = prevPath.path.slice(0, i + 1);

      const removedEdges = new Set<string>();
      const removedNodes = new Set<string>();

      for (const accepted of A) {
        if (
          accepted.path.length > i &&
          accepted.path.slice(0, i + 1).join('|') === rootPath.join('|')
        ) {
          const edgeSrc = accepted.path[i];
          const edgeTgt = accepted.path[i + 1];
          removedEdges.add(`${edgeSrc}|${edgeTgt}`);
          removedEdges.add(`${edgeTgt}|${edgeSrc}`);
        }
      }

      for (const nodeId of rootPath.slice(0, -1)) {
        removedNodes.add(nodeId);
      }

      const spurResult = dijkstraConstrained(adjacency, nodeMap, spurNode, targetId, removedEdges, removedNodes);
      if (!spurResult) continue;

      const totalPath = [...rootPath, ...spurResult.path.slice(1)];
      const totalEdges = [...prevPath.edges.slice(0, i), ...spurResult.edges];
      const totalWeight = totalEdges.reduce((s, e) => s + e.strength, 0);
      const candidate: PathfindingComputation = {
        path: totalPath,
        totalWeight,
        hops: totalPath.length - 1,
        edges: totalEdges,
        found: true,
      };

      const candidateKey = totalPath.join('|');
      const isDuplicate = [...A, ...B].some((p) => p.path.join('|') === candidateKey);
      if (!isDuplicate) {
        B.push(candidate);
      }
    }

    if (B.length === 0) break;

    B.sort((a, b) => (a.hops !== b.hops ? a.hops - b.hops : b.totalWeight - a.totalWeight));
    A.push(B.shift()!);
  }

  return A;
}

export function getPathLinkIds(result: PathfindingComputation, graphData: GraphData): Set<string> {
  const linkIds = new Set<string>();
  for (const edge of result.edges) {
    const link = graphData.links.find((l) => {
      const s = linkEndpointId(l.source);
      const t = linkEndpointId(l.target);
      return (s === edge.source && t === edge.target) || (s === edge.target && t === edge.source);
    });
    if (link) linkIds.add(link.id);
  }
  return linkIds;
}

export type PathfindingMode = 'shortest' | 'strongest' | 'k_shortest';

const NEO4J_ELEMENT_ID_RE = /^\d+:[\w-]+:[\w-]+$/;

/** Resolve Neo4j elementId from a canvas node (for subgraph / path_find plugins). */
export function resolveNodeElementId(node: GraphNode): string | null {
  const props = node.properties ?? {};
  for (const key of ['elementId', 'element_id', 'elementKey'] as const) {
    const v = props[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (NEO4J_ELEMENT_ID_RE.test(node.id)) return node.id;
  return null;
}

function mapElementIdToNodeId(graphData: GraphData, elementId: string): string {
  for (const n of graphData.nodes) {
    if (resolveNodeElementId(n) === elementId || n.id === elementId) return n.id;
  }
  return elementId;
}

/** Convert plugin_graph_explorer_path_find paths into canvas PathfindingComputation rows. */
export function serverPathsToComputations(
  paths: Array<{ length?: number; nodes?: unknown[]; relationships?: unknown[] }>,
  graphData: GraphData,
  sourceNodeId: string,
  targetNodeId: string
): PathfindingComputation[] {
  return paths
    .map((p) => {
      const nodeRows = Array.isArray(p.nodes) ? p.nodes : [];
      const pathIds = nodeRows
        .map((n) => {
          if (!n || typeof n !== 'object') return '';
          const id = (n as { id?: unknown }).id;
          return typeof id === 'string' && id.trim() ? mapElementIdToNodeId(graphData, id.trim()) : '';
        })
        .filter(Boolean);
      const relRows = Array.isArray(p.relationships) ? p.relationships : [];
      const edges: PathfindingEdgeStep[] = [];
      for (const r of relRows) {
        if (!r || typeof r !== 'object') continue;
        const rec = r as { source?: unknown; target?: unknown; type?: unknown };
        const source = typeof rec.source === 'string' ? mapElementIdToNodeId(graphData, rec.source) : '';
        const target = typeof rec.target === 'string' ? mapElementIdToNodeId(graphData, rec.target) : '';
        if (!source || !target) continue;
        edges.push({
          source,
          target,
          relation: String(rec.type ?? 'RELATED_TO'),
          strength: 1,
        });
      }
      const hops = typeof p.length === 'number' ? p.length : Math.max(0, pathIds.length - 1);
      const resolvedPath = pathIds.length >= 2 ? pathIds : [sourceNodeId, targetNodeId];
      return {
        path: resolvedPath,
        totalWeight: hops,
        hops,
        edges,
        found: resolvedPath.length >= 2,
      };
    })
    .filter((r) => r.found);
}
