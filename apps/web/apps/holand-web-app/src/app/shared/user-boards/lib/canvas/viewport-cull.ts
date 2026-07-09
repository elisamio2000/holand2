import type { BoardInkStroke, BoardObject, BoardObjectBase, BoardViewBox } from '../board-types';
import { objectToWorldAabb } from './shape-world-geometry';

const CULL_MARGIN = 120;

export function expandViewBox(viewBox: BoardViewBox, margin = CULL_MARGIN): BoardViewBox {
  return {
    x: viewBox.x - margin,
    y: viewBox.y - margin,
    width: viewBox.width + margin * 2,
    height: viewBox.height + margin * 2,
  };
}

function aabbIntersectsView(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  vb: BoardViewBox
): boolean {
  const vbMaxX = vb.x + vb.width;
  const vbMaxY = vb.y + vb.height;
  return !(maxX < vb.x || minX > vbMaxX || maxY < vb.y || minY > vbMaxY);
}

export function isSpatialInView(
  obj: BoardObject & BoardObjectBase,
  viewBox: BoardViewBox,
  margin = CULL_MARGIN
): boolean {
  const vb = expandViewBox(viewBox, margin);
  const aabb = objectToWorldAabb(obj);
  return aabbIntersectsView(aabb.minX, aabb.minY, aabb.maxX, aabb.maxY, vb);
}

export function filterSpatialObjectsInView(
  objects: BoardObject[],
  viewBox: BoardViewBox,
  margin = CULL_MARGIN
): BoardObject[] {
  const vb = expandViewBox(viewBox, margin);
  return objects.filter((o) => {
    if (o.type === 'connector') return true;
    if (!('x' in o)) return false;
    const aabb = objectToWorldAabb(o as BoardObject & BoardObjectBase);
    return aabbIntersectsView(aabb.minX, aabb.minY, aabb.maxX, aabb.maxY, vb);
  });
}

export function filterInkStrokesInView(
  strokes: BoardInkStroke[],
  viewBox: BoardViewBox,
  margin = CULL_MARGIN
): BoardInkStroke[] {
  const vb = expandViewBox(viewBox, margin);
  return strokes.filter((s) => {
    if (!s.points.length) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of s.points) {
      const x = p.x;
      const y = p.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return aabbIntersectsView(minX, minY, maxX, maxY, vb);
  });
}
