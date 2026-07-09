import type { BoardObject, BoardSnapshot } from '../board-types';

export type LayerMove = 'front' | 'forward' | 'backward' | 'back';

export function isSpatialLayerObject(obj: BoardObject): boolean {
  return obj.type !== 'connector' && 'z' in obj;
}

function objectZ(obj: BoardObject): number {
  return 'z' in obj ? (obj.z ?? 0) : 0;
}

/** Sorted spatial objects (ascending z). */
export function getSpatialLayerOrder(snapshot: BoardSnapshot): BoardObject[] {
  return snapshot.objects
    .filter(isSpatialLayerObject)
    .slice()
    .sort((a, b) => objectZ(a) - objectZ(b));
}

/** Reindex z values to 0..n-1 preserving relative order. */
export function normalizeZIndices(snapshot: BoardSnapshot): BoardSnapshot {
  const ordered = getSpatialLayerOrder(snapshot);
  const zById = new Map<string, number>();
  ordered.forEach((obj, i) => {
    if ('id' in obj) zById.set(obj.id, i);
  });
  return {
    ...snapshot,
    objects: snapshot.objects.map((obj) => {
      if (!isSpatialLayerObject(obj) || !('id' in obj)) return obj;
      const z = zById.get(obj.id);
      return z === undefined ? obj : { ...obj, z };
    }),
  };
}

function applyZMap(snapshot: BoardSnapshot, zById: Map<string, number>): BoardSnapshot {
  return {
    ...snapshot,
    objects: snapshot.objects.map((obj) => {
      if (!('id' in obj)) return obj;
      const z = zById.get(obj.id);
      return z === undefined ? obj : { ...obj, z };
    }),
  };
}

/**
 * Reorder one or more spatial objects. Multi-select moves as a block preserving internal order.
 */
export function reorderSpatialLayers(
  snapshot: BoardSnapshot,
  objectIds: string[],
  move: LayerMove
): BoardSnapshot {
  const ids = [...new Set(objectIds)].filter((id) =>
    snapshot.objects.some((o) => 'id' in o && o.id === id && isSpatialLayerObject(o))
  );
  if (!ids.length) return snapshot;

  let ordered = getSpatialLayerOrder(snapshot);
  const idSet = new Set(ids);
  const selected = ordered.filter((o) => 'id' in o && idSet.has(o.id));
  if (!selected.length) return snapshot;

  const rest = ordered.filter((o) => !('id' in o) || !idSet.has(o.id));

  let nextOrder: BoardObject[];
  switch (move) {
    case 'front':
      nextOrder = [...rest, ...selected];
      break;
    case 'back':
      nextOrder = [...selected, ...rest];
      break;
    case 'forward': {
      const indices = selected
        .map((o) => ('id' in o ? ordered.findIndex((x) => 'id' in x && x.id === o.id) : -1))
        .filter((i) => i >= 0);
      const maxIdx = Math.max(...indices);
      if (maxIdx >= ordered.length - 1) return snapshot;
      nextOrder = ordered.slice();
      const block = nextOrder.splice(indices[0], selected.length);
      nextOrder.splice(indices[0] + 1, 0, ...block);
      break;
    }
    case 'backward': {
      const indices = selected
        .map((o) => ('id' in o ? ordered.findIndex((x) => 'id' in x && x.id === o.id) : -1))
        .filter((i) => i >= 0);
      const minIdx = Math.min(...indices);
      if (minIdx <= 0) return snapshot;
      nextOrder = ordered.slice();
      const block = nextOrder.splice(indices[0], selected.length);
      nextOrder.splice(indices[0] - 1, 0, ...block);
      break;
    }
    default:
      return snapshot;
  }

  const zById = new Map<string, number>();
  nextOrder.forEach((obj, i) => {
    if ('id' in obj) zById.set(obj.id, i);
  });
  return applyZMap(snapshot, zById);
}
