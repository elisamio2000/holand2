import { describe, expect, it } from 'vitest';
import { createEmptySnapshot } from '../../board-snapshot';
import { combineShapes } from '../boolean-combine';
import { ringToAabb, objectToWorldRing } from '../shape-world-geometry';

describe('boolean-combine', () => {
  it('unions two rectangles', () => {
    const snap = {
      ...createEmptySnapshot(),
      objects: [
        {
          type: 'vector' as const,
          id: 'a',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
          fill: '#f00',
          z: 0,
        },
        {
          type: 'vector' as const,
          id: 'b',
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
          fill: '#00f',
          z: 1,
        },
      ],
    };
    const result = combineShapes(snap, ['a', 'b'], 'union');
    expect(result).not.toBeNull();
    expect(result!.snapshot.objects).toHaveLength(1);
    expect(result!.snapshot.objects[0].type).toBe('vector');
  });

  it('union bbox is larger when one shape is rotated 45°', () => {
    const base = {
      type: 'vector' as const,
      width: 100,
      height: 100,
      geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
      fill: '#f00',
      z: 0,
    };
    const snapFlat = {
      ...createEmptySnapshot(),
      objects: [
        { ...base, id: 'a', x: 0, y: 0 },
        { ...base, id: 'b', x: 100, y: 0, z: 1 },
      ],
    };
    const snapRotated = {
      ...createEmptySnapshot(),
      objects: [
        { ...base, id: 'a', x: 0, y: 0, rotation: 45 },
        { ...base, id: 'b', x: 100, y: 0, z: 1 },
      ],
    };
    const flat = combineShapes(snapFlat, ['a', 'b'], 'union')!;
    const rotated = combineShapes(snapRotated, ['a', 'b'], 'union')!;
    const flatVec = flat.snapshot.objects[0] as { width: number; height: number };
    const rotVec = rotated.snapshot.objects[0] as { width: number; height: number };
    expect(rotVec.width * rotVec.height).toBeGreaterThan(flatVec.width * flatVec.height);
  });

  it('rounded preset differs from sharp rectangle union', () => {
    const snapSharp = {
      ...createEmptySnapshot(),
      objects: [
        {
          type: 'vector' as const,
          id: 'a',
          x: 0,
          y: 0,
          width: 80,
          height: 80,
          geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
          fill: '#f00',
          z: 0,
        },
        {
          type: 'vector' as const,
          id: 'b',
          x: 40,
          y: 40,
          width: 80,
          height: 80,
          geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
          fill: '#00f',
          z: 1,
        },
      ],
    };
    const snapRounded = {
      ...createEmptySnapshot(),
      objects: [
        {
          ...snapSharp.objects[0],
          geometry: { kind: 'preset' as const, preset: 'rounded' as const },
        },
        snapSharp.objects[1],
      ],
    };
    const sharp = combineShapes(snapSharp, ['a', 'b'], 'union')!;
    const rounded = combineShapes(snapRounded, ['a', 'b'], 'union')!;
    const sharpPath = (sharp.snapshot.objects[0] as { geometry: { pathD?: string } }).geometry.pathD;
    const roundedPath = (rounded.snapshot.objects[0] as { geometry: { pathD?: string } }).geometry.pathD;
    expect(roundedPath).not.toEqual(sharpPath);
  });

  it('subtract with rotated shape yields reasonable bbox', () => {
    const snap = {
      ...createEmptySnapshot(),
      objects: [
        {
          type: 'vector' as const,
          id: 'a',
          x: 0,
          y: 0,
          width: 120,
          height: 120,
          geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
          fill: '#f00',
          z: 0,
        },
        {
          type: 'vector' as const,
          id: 'b',
          x: 30,
          y: 30,
          width: 60,
          height: 60,
          rotation: 45,
          geometry: { kind: 'preset' as const, preset: 'rectangle' as const },
          fill: '#00f',
          z: 1,
        },
      ],
    };
    const result = combineShapes(snap, ['a', 'b'], 'subtract');
    expect(result).not.toBeNull();
    const vec = result!.snapshot.objects[0] as BoardVectorLike;
    expect(vec.width).toBeGreaterThan(0);
    expect(vec.height).toBeGreaterThan(0);
    const ringAabb = ringToAabb(objectToWorldRing(snap.objects[0] as Parameters<typeof objectToWorldRing>[0]));
    expect(vec.x).toBeGreaterThanOrEqual(ringAabb.minX - 1);
    expect(vec.y).toBeGreaterThanOrEqual(ringAabb.minY - 1);
  });
});

type BoardVectorLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};
