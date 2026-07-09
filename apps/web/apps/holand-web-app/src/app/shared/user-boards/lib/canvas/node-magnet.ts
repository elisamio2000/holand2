import type { BoardNodeObject, BoardObject, BoardObjectBase } from '../board-types';
import { expandObjectGroupIds } from './object-groups';

const MAGNET_TYPES = new Set(['sticky', 'media', 'frame']);

export function isMagnetAttachableType(type: string): boolean {
  return MAGNET_TYPES.has(type);
}

export function isNodeMagnetEnabled(node: BoardNodeObject): boolean {
  return node.magnetEnabled !== false;
}

/** IDs that move together when dragging `primaryId` (selection + magnet children + anchor-linked nodes). */
export function expandDragIds(
  primaryId: string,
  selectedIds: string[],
  objects: BoardObject[]
): string[] {
  const ids = new Set(selectedIds.includes(primaryId) ? selectedIds : [primaryId]);
  const primary = objects.find((o) => o.id === primaryId);

  if (primary?.type === 'node') {
    const node = primary as BoardNodeObject;
    if (isNodeMagnetEnabled(node)) {
      for (const o of objects) {
        if (o.type === 'connector' || !('x' in o)) continue;
        const spatial = o as BoardObject & BoardObjectBase;
        if (spatial.attachedNodeId === primaryId) ids.add(spatial.id);
      }
    }
    for (const linkedId of node.linkedNodeIds ?? []) {
      ids.add(linkedId);
    }
    // Bidirectional: nodes that link back to the primary also move together
    for (const o of objects) {
      if (o.type !== 'node' || o.id === primaryId) continue;
      if ((o.linkedNodeIds ?? []).includes(primaryId)) ids.add(o.id);
    }
  }

  return expandObjectGroupIds([...ids], objects);
}

export function magnetAttachPatch(
  child: BoardObject & BoardObjectBase,
  node: BoardNodeObject
): Partial<BoardObject & BoardObjectBase> {
  return {
    attachedNodeId: node.id,
    attachOffsetX: child.x - node.x,
    attachOffsetY: child.y - node.y,
  };
}

export function magnetDetachPatch(): Partial<BoardObject & BoardObjectBase> {
  return {
    attachedNodeId: undefined,
    attachOffsetX: undefined,
    attachOffsetY: undefined,
  };
}

/** When a connector is created, magnet-attach non-node spatial items to a node endpoint. */
export function applyMagnetOnConnect(
  objects: BoardObject[],
  sourceId: string,
  targetId: string
): BoardObject[] {
  const source = objects.find((o) => o.id === sourceId);
  const target = objects.find((o) => o.id === targetId);
  if (!source || !target) return objects;

  let next = objects;

  const attach = (childId: string, nodeId: string) => {
    const child = next.find((o) => o.id === childId);
    const node = next.find((o) => o.id === nodeId);
    if (!child || node?.type !== 'node' || !isMagnetAttachableType(child.type)) return;
    if (!('x' in child)) return;
    const spatial = child as BoardObject & BoardObjectBase;
    next = next.map((o) =>
      o.id === childId
        ? ({ ...spatial, ...magnetAttachPatch(spatial, node as BoardNodeObject) } as BoardObject)
        : o
    );
  };

  if (target.type === 'node' && isMagnetAttachableType(source.type)) {
    attach(sourceId, targetId);
  } else if (source.type === 'node' && isMagnetAttachableType(target.type)) {
    attach(targetId, sourceId);
  }

  return next;
}

export function countMagnetAttachments(objects: BoardObject[], nodeId: string): number {
  return objects.filter(
    (o) => o.type !== 'connector' && 'attachedNodeId' in o && (o as BoardObjectBase).attachedNodeId === nodeId
  ).length;
}

export function addNodeAnchorLink(node: BoardNodeObject, linkedId: string): string[] {
  const existing = node.linkedNodeIds ?? [];
  if (linkedId === node.id || existing.includes(linkedId)) return existing;
  return [...existing, linkedId];
}

/** Bidirectional anchor link between two nodes (synchronized drag). */
export function linkNodesBidirectional(
  objects: BoardObject[],
  nodeIdA: string,
  nodeIdB: string
): BoardObject[] {
  if (nodeIdA === nodeIdB) return objects;
  const a = objects.find((o) => o.id === nodeIdA);
  const b = objects.find((o) => o.id === nodeIdB);
  if (a?.type !== 'node' || b?.type !== 'node') return objects;
  return objects.map((o) => {
    if (o.id === nodeIdA) {
      return { ...o, linkedNodeIds: addNodeAnchorLink(o as BoardNodeObject, nodeIdB) };
    }
    if (o.id === nodeIdB) {
      return { ...o, linkedNodeIds: addNodeAnchorLink(o as BoardNodeObject, nodeIdA) };
    }
    return o;
  });
}

/** Link all node pairs connected by connectors in the snapshot. */
export function linkConnectedNodes(objects: BoardObject[]): BoardObject[] {
  let next = objects;
  for (const o of objects) {
    if (o.type !== 'connector') continue;
    const { sourceId, targetId } = o;
    const src = next.find((x) => x.id === sourceId);
    const tgt = next.find((x) => x.id === targetId);
    if (src?.type === 'node' && tgt?.type === 'node') {
      next = linkNodesBidirectional(next, sourceId, targetId);
    }
  }
  return next;
}

export function unlinkNodesBidirectional(
  objects: BoardObject[],
  nodeIdA: string,
  nodeIdB: string
): BoardObject[] {
  return objects.map((o) => {
    if (o.type !== 'node') return o;
    if (o.id === nodeIdA || o.id === nodeIdB) {
      const other = o.id === nodeIdA ? nodeIdB : nodeIdA;
      return { ...o, linkedNodeIds: removeNodeAnchorLink(o, other) };
    }
    return o;
  });
}

export function removeNodeAnchorLink(node: BoardNodeObject, linkedId: string): string[] {
  return (node.linkedNodeIds ?? []).filter((id) => id !== linkedId);
}

/** Forward + reverse anchor-linked node IDs for a node. */
export function getNodeAnchorPeers(objects: BoardObject[], nodeId: string): string[] {
  const peers = new Set<string>();
  const self = objects.find((o) => o.id === nodeId);
  if (self?.type === 'node') {
    for (const id of (self as BoardNodeObject).linkedNodeIds ?? []) {
      if (id !== nodeId) peers.add(id);
    }
  }
  for (const o of objects) {
    if (o.type !== 'node' || o.id === nodeId) continue;
    if ((o as BoardNodeObject).linkedNodeIds?.includes(nodeId)) {
      peers.add(o.id);
    }
  }
  return [...peers];
}

export function hasAnchorLinkBetween(objects: BoardObject[], nodeIdA: string, nodeIdB: string): boolean {
  if (nodeIdA === nodeIdB) return false;
  const a = objects.find((o) => o.id === nodeIdA);
  const b = objects.find((o) => o.id === nodeIdB);
  if (a?.type !== 'node' || b?.type !== 'node') return false;
  const aLinks = (a as BoardNodeObject).linkedNodeIds ?? [];
  const bLinks = (b as BoardNodeObject).linkedNodeIds ?? [];
  return aLinks.includes(nodeIdB) || bLinks.includes(nodeIdA);
}

/** Unique linked pairs among the given node IDs (each pair once, sorted ids). */
export function getAnchorLinksAmong(objects: BoardObject[], nodeIds: string[]): [string, string][] {
  const idSet = new Set(nodeIds);
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const id of nodeIds) {
    for (const peer of getNodeAnchorPeers(objects, id)) {
      if (!idSet.has(peer)) continue;
      const key = [id, peer].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const [a, b] = key.split('|');
      if (hasAnchorLinkBetween(objects, a, b)) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

/** Sticky / media / frame objects magnet-attached to a node. */
export function listMagnetChildren(objects: BoardObject[], nodeId: string): BoardObject[] {
  return objects.filter(
    (o) =>
      o.type !== 'connector' &&
      'attachedNodeId' in o &&
      (o as BoardObjectBase).attachedNodeId === nodeId &&
      isMagnetAttachableType(o.type)
  );
}

/** Unlink all anchor pairs among the given node IDs. */
export function unlinkAllAmongNodes(objects: BoardObject[], nodeIds: string[]): BoardObject[] {
  let next = objects;
  for (const [a, b] of getAnchorLinksAmong(objects, nodeIds)) {
    next = unlinkNodesBidirectional(next, a, b);
  }
  return next;
}

/** When exactly one node is selected, return it for auto-magnet placement. */
export function resolveSingleSelectedNode(
  objects: BoardObject[],
  selectedIds: string[]
): BoardNodeObject | null {
  if (selectedIds.length !== 1) return null;
  const obj = objects.find((o) => o.id === selectedIds[0]);
  if (!obj || obj.type !== 'node') return null;
  return obj as BoardNodeObject;
}

/** Spawn position below a node centre with magnet offsets (graph-builder parity). */
export function magnetSpawnBelowNode(
  node: BoardNodeObject,
  childWidth: number,
  childHeight: number,
  gap = 24
): { x: number; y: number; patch: Partial<BoardObject & BoardObjectBase> } {
  const x = node.x + node.width / 2 - childWidth / 2;
  const y = node.y + node.height + gap;
  const child = { x, y, width: childWidth, height: childHeight } as BoardObject & BoardObjectBase;
  return { x, y, patch: magnetAttachPatch(child, node) };
}
