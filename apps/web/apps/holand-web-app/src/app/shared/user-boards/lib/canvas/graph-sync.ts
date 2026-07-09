import { createId } from '@paralleldrive/cuid2';
import type {
  BoardConnectorObject,
  BoardNodeObject,
  BoardObject,
} from '../board-types';
import type { BoardDocumentState } from '../board-snapshot';

export type ConnectorKind = 'link' | 'flow' | 'reference';

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function collectLinkPairs(objects: BoardObject[]): Set<string> {
  const nodeIds = new Set(
    objects.filter((o): o is BoardNodeObject => o.type === 'node').map((n) => n.id)
  );
  const pairs = new Set<string>();
  for (const o of objects) {
    if (o.type !== 'node') continue;
    for (const linkedId of o.linkedNodeIds ?? []) {
      if (linkedId === o.id || !nodeIds.has(linkedId)) continue;
      pairs.add(pairKey(o.id, linkedId));
    }
  }
  return pairs;
}

export function findConnectorBetween(
  objects: BoardObject[],
  a: string,
  b: string
): BoardConnectorObject | undefined {
  return objects.find(
    (o): o is BoardConnectorObject =>
      o.type === 'connector' &&
      ((o.sourceId === a && o.targetId === b) || (o.sourceId === b && o.targetId === a))
  );
}

export function ensureConnectorsFromLinks(
  doc: BoardDocumentState,
  createConnector: (sourceId: string, targetId: string) => BoardConnectorObject
): BoardDocumentState {
  const pairs = collectLinkPairs(doc.objects);
  let objects = [...doc.objects];

  for (const key of pairs) {
    const [a, b] = key.split('|');
    if (!a || !b) continue;
    if (findConnectorBetween(objects, a, b)) continue;
    objects.push({ ...createConnector(a, b), kind: 'link' });
  }

  return { ...doc, objects };
}

export function removeOrphanLinkConnectors(doc: BoardDocumentState): BoardDocumentState {
  const pairs = collectLinkPairs(doc.objects);
  const objects = doc.objects.filter((o) => {
    if (o.type !== 'connector') return true;
    const conn = o;
    if (conn.kind !== 'link') return true;
    return pairs.has(pairKey(conn.sourceId, conn.targetId));
  });
  return { ...doc, objects };
}

export function syncGraphFromLinks(
  doc: BoardDocumentState,
  createConnector: (sourceId: string, targetId: string) => BoardConnectorObject
): BoardDocumentState {
  return removeOrphanLinkConnectors(ensureConnectorsFromLinks(doc, createConnector));
}

export function seedGraphLayout(doc: BoardDocumentState): BoardDocumentState {
  const layout = { ...(doc.graphLayout ?? {}) };
  for (const o of doc.objects) {
    if (o.type !== 'node') continue;
    if (!layout[o.id]) {
      layout[o.id] = { x: o.x, y: o.y };
    }
  }
  return Object.keys(layout).length ? { ...doc, graphLayout: layout } : doc;
}

export function applyGraphLayoutToCanvas(doc: BoardDocumentState): BoardDocumentState {
  const layout = doc.graphLayout ?? {};
  const objects = doc.objects.map((o) => {
    if (o.type !== 'node') return o;
    const pos = layout[o.id];
    if (!pos) return o;
    return { ...o, x: pos.x, y: pos.y };
  });
  return { ...doc, objects };
}

/** Minimal link connector for migration when style defaults are unavailable. */
export function createMinimalLinkConnector(sourceId: string, targetId: string): BoardConnectorObject {
  return {
    type: 'connector',
    id: createId(),
    sourceId,
    targetId,
    kind: 'link',
    routeStyle: 'curved',
  };
}

export interface GraphTopology {
  nodeIds: string[];
  connectors: BoardConnectorObject[];
  nodeCount: number;
  edgeCount: number;
}

/** Extract nodes and valid connectors for the graph summary view. */
export function extractGraphTopology(doc: BoardDocumentState): GraphTopology {
  const nodeIds = doc.objects
    .filter((o): o is BoardNodeObject => o.type === 'node')
    .map((n) => n.id);
  const nodeIdSet = new Set(nodeIds);
  const connectors = doc.objects.filter(
    (o): o is BoardConnectorObject =>
      o.type === 'connector' &&
      nodeIdSet.has(o.sourceId) &&
      nodeIdSet.has(o.targetId)
  );
  return {
    nodeIds,
    connectors,
    nodeCount: nodeIds.length,
    edgeCount: connectors.length,
  };
}

/** Stable fingerprint of graph topology (node ids + connector pairs). */
export function graphTopologyFingerprint(doc: BoardDocumentState): string {
  const { nodeIds, connectors } = extractGraphTopology(doc);
  const sortedNodes = [...nodeIds].sort();
  const edges = connectors
    .map((c) => pairKey(c.sourceId, c.targetId))
    .sort();
  return `${sortedNodes.join(',')}|${edges.join(',')}`;
}

/** Remove graphLayout entries for deleted nodes. */
export function pruneGraphLayout(doc: BoardDocumentState): BoardDocumentState {
  const nodeIdSet = new Set(
    doc.objects.filter((o): o is BoardNodeObject => o.type === 'node').map((n) => n.id)
  );
  const layout = doc.graphLayout ?? {};
  const pruned: Record<string, { x: number; y: number }> = {};
  let changed = false;
  for (const [id, pos] of Object.entries(layout)) {
    if (nodeIdSet.has(id)) {
      pruned[id] = pos;
    } else {
      changed = true;
    }
  }
  if (!changed && Object.keys(pruned).length === Object.keys(layout).length) {
    return doc;
  }
  return {
    ...doc,
    graphLayout: Object.keys(pruned).length ? pruned : undefined,
  };
}

export interface PrepareGraphResult {
  doc: BoardDocumentState;
  topologyChanged: boolean;
  missingLayoutNodeIds: string[];
  dataChanged: boolean;
}

/**
 * Prepare snapshot for graph view: sync link connectors, prune layout, update fingerprint.
 */
export function prepareGraphForView(
  doc: BoardDocumentState,
  createConnector: (sourceId: string, targetId: string) => BoardConnectorObject
): PrepareGraphResult {
  const beforeFingerprint = doc.graphTopologyFingerprint ?? '';
  const beforeObjectsLen = doc.objects.length;

  let next = syncGraphFromLinks(doc, createConnector);
  next = pruneGraphLayout(next);

  const fingerprint = graphTopologyFingerprint(next);
  const topologyChanged = fingerprint !== beforeFingerprint;

  const layout = next.graphLayout ?? {};
  const missingLayoutNodeIds = extractGraphTopology(next).nodeIds.filter((id) => !layout[id]);

  const dataChanged =
    topologyChanged ||
    next.objects.length !== beforeObjectsLen ||
    JSON.stringify(next.graphLayout) !== JSON.stringify(doc.graphLayout);

  next = {
    ...next,
    graphTopologyFingerprint: fingerprint,
  };

  return {
    doc: next,
    topologyChanged,
    missingLayoutNodeIds,
    dataChanged,
  };
}
