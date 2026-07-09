import polygonClipping from 'polygon-clipping';
import { createId } from '@paralleldrive/cuid2';
import type {
  BoardNodeObject,
  BoardObject,
  BoardSnapshot,
  BoardVectorObject,
} from '../board-types';
import { nextZIndex } from '../board-snapshot';
import { objectToWorldRing, type WorldRing } from './shape-world-geometry';

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

function ringsToNormalizedPathD(rings: WorldRing[], bbox: { x: number; y: number; width: number; height: number }): string {
  const { x, y, width, height } = bbox;
  const w = Math.max(1e-6, width);
  const h = Math.max(1e-6, height);
  const outer = rings[0];
  if (!outer?.length) return 'M 0 0 L 1 0 L 1 1 L 0 1 Z';
  const parts = outer.map((p, i) => {
    const nx = ((p[0] - x) / w).toFixed(4);
    const ny = ((p[1] - y) / h).toFixed(4);
    return `${i === 0 ? 'M' : 'L'} ${nx} ${ny}`;
  });
  parts.push('Z');
  return parts.join(' ');
}

function bboxFromRings(rings: WorldRing[]): { x: number; y: number; width: number; height: number } {
  const all = rings.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function isBooleanCapable(obj: BoardObject): obj is BoardVectorObject | BoardNodeObject {
  return obj.type === 'vector' || obj.type === 'node';
}

export function combineShapes(
  snapshot: BoardSnapshot,
  objectIds: string[],
  op: BooleanOp
): { snapshot: BoardSnapshot; newId: string } | null {
  const objects = objectIds
    .map((id) => snapshot.objects.find((o) => 'id' in o && o.id === id))
    .filter((o): o is BoardVectorObject | BoardNodeObject => !!o && isBooleanCapable(o));

  if (objects.length < 2) return null;

  const polys = objects.map((o) => [objectToWorldRing(o)]);
  let result: WorldRing[][];

  try {
    if (op === 'union') {
      result = polygonClipping.union(polys[0], ...polys.slice(1)) as WorldRing[][];
    } else if (op === 'subtract') {
      result = polygonClipping.difference(polys[0], polys[polys.length - 1]) as WorldRing[][];
    } else if (op === 'intersect') {
      let acc: WorldRing[] = polys[0];
      for (const p of polys.slice(1)) {
        const next = polygonClipping.intersection(acc, p) as WorldRing[][];
        if (!next.length || !next[0]?.length) return null;
        acc = next[0];
      }
      result = [acc];
    } else {
      let acc: WorldRing[] = polys[0];
      for (const p of polys.slice(1)) {
        const next = polygonClipping.xor(acc, p) as WorldRing[][];
        if (!next.length || !next[0]?.length) return null;
        acc = next[0];
      }
      result = [acc];
    }
  } catch {
    return null;
  }

  if (!result?.length || !result[0]?.length) return null;

  const bbox = bboxFromRings(result[0]);
  const pathD = ringsToNormalizedPathD(result[0], bbox);
  const fill =
    objects[0].type === 'vector'
      ? objects[0].fill
      : (objects[0] as BoardNodeObject).color;

  const newObj: BoardVectorObject = {
    type: 'vector',
    id: createId(),
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    geometry: { kind: 'path', pathD },
    fill,
    z: nextZIndex(snapshot),
  };

  const removeIds = new Set(objectIds);
  return {
    snapshot: {
      ...snapshot,
      objects: [...snapshot.objects.filter((o) => !('id' in o) || !removeIds.has(o.id)), newObj],
    },
    newId: newObj.id,
  };
}
