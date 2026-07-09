import { describe, expect, it } from 'vitest';
import { createEmptySnapshot, getSnapshotBounds } from '../board-snapshot';

describe('getSnapshotBounds', () => {
  it('uses viewBox when empty', () => {
    const snap = createEmptySnapshot();
    const b = getSnapshotBounds(snap);
    expect(b.minX).toBe(snap.viewBox.x - 48);
    expect(b.maxX).toBe(snap.viewBox.x + snap.viewBox.width + 48);
  });

  it('includes object extents', () => {
    const snap = createEmptySnapshot();
    snap.objects = [
      {
        id: '1',
        type: 'sticky',
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        text: '',
        color: '#fff',
      },
    ];
    const b = getSnapshotBounds(snap);
    expect(b.minX).toBeLessThanOrEqual(100);
    expect(b.maxX).toBeGreaterThanOrEqual(150);
  });

  it('expands bounds for rotated vector', () => {
    const snap = createEmptySnapshot();
    snap.objects = [
      {
        type: 'vector',
        id: 'v1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 45,
        geometry: { kind: 'preset', preset: 'rectangle' },
        fill: '#000',
        z: 0,
      },
    ];
    const b = getSnapshotBounds(snap);
    expect(b.maxX - b.minX).toBeGreaterThan(100);
    expect(b.maxY - b.minY).toBeGreaterThan(100);
  });
});
