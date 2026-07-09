import { describe, expect, it } from 'vitest';
import { rotateGroupMembers, scaleGroupMembers, unionSpatialBounds } from '../group-transform';

describe('group-transform', () => {
  const members = [
    { id: 'a', x: 0, y: 0, width: 100, height: 50, rotation: 0 },
    { id: 'b', x: 120, y: 10, width: 80, height: 40, rotation: 10 },
  ];

  it('unionSpatialBounds wraps all members', () => {
    const b = unionSpatialBounds(members);
    expect(b).toEqual({ x: 0, y: 0, width: 200, height: 50 });
  });

  it('scaleGroupMembers scales from group bounds', () => {
    const initial = unionSpatialBounds(members)!;
    const scaled = scaleGroupMembers(members, initial, { x: 0, y: 0, width: 400, height: 100 });
    expect(scaled.get('a')?.width).toBe(200);
    expect(scaled.get('b')?.x).toBeGreaterThan(200);
  });

  it('rotateGroupMembers rotates around pivot', () => {
    const rotated = rotateGroupMembers(members, 100, 25, 90);
    const a = rotated.get('a')!;
    expect(a.rotation).toBe(90);
    expect(a.x).not.toBe(0);
  });
});
