import { describe, expect, it } from 'vitest';
import {
  flattenPathDToRing,
  objectToWorldAabb,
  objectToWorldRing,
  rotatePoint,
  rotateRing,
  ringToAabb,
} from '../shape-world-geometry';
import { roundedRectPathD } from '../shape-geometry';

describe('shape-world-geometry', () => {
  it('rotatePoint rotates 90° around center', () => {
    const [x, y] = rotatePoint(110, 50, 100, 100, 90);
    expect(x).toBeCloseTo(150, 5);
    expect(y).toBeCloseTo(110, 5);
  });

  it('rotateRing preserves point count', () => {
    const ring: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    const rotated = rotateRing(ring, 50, 50, 45);
    expect(rotated).toHaveLength(5);
  });

  it('flattenPathDToRing samples arc commands', () => {
    const d = roundedRectPathD(0, 0, 100, 80, [12, 12, 12, 12]);
    const ring = flattenPathDToRing(d);
    expect(ring.length).toBeGreaterThan(8);
    const aabb = ringToAabb(ring);
    expect(aabb.minX).toBeCloseTo(0, 0);
    expect(aabb.maxX).toBeCloseTo(100, 0);
    expect(aabb.minY).toBeCloseTo(0, 0);
    expect(aabb.maxY).toBeCloseTo(80, 0);
  });

  it('objectToWorldRing expands bbox when rotated 45°', () => {
    const obj = {
      type: 'vector' as const,
      id: 'v1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 45,
      geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
      fill: '#000',
      z: 0,
    };
    const unrotated = ringToAabb(objectToWorldRing({ ...obj, rotation: 0 }));
    const rotated = ringToAabb(objectToWorldRing(obj));
    expect(rotated.maxX - rotated.minX).toBeGreaterThan(unrotated.maxX - unrotated.minX);
    expect(rotated.maxY - rotated.minY).toBeGreaterThan(unrotated.maxY - unrotated.minY);
  });

  it('objectToWorldAabb matches ring AABB for rotated vector', () => {
    const obj = {
      type: 'vector' as const,
      id: 'v1',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 30,
      geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
      fill: '#000',
      z: 0,
    };
    const fromRing = ringToAabb(objectToWorldRing(obj));
    const fromHelper = objectToWorldAabb(obj);
    expect(fromHelper.minX).toBeCloseTo(fromRing.minX, 4);
    expect(fromHelper.maxX).toBeCloseTo(fromRing.maxX, 4);
    expect(fromHelper.minY).toBeCloseTo(fromRing.minY, 4);
    expect(fromHelper.maxY).toBeCloseTo(fromRing.maxY, 4);
  });
});
