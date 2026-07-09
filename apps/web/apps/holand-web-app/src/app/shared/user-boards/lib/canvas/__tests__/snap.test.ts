import { describe, expect, it } from 'vitest';
import { BOARD_GRID_SIZE, snapCoord, snapPoint } from '../snap';

describe('snapCoord', () => {
  it('returns value unchanged when snap disabled', () => {
    expect(snapCoord(37, false)).toBe(37);
  });

  it('snaps to default grid when enabled', () => {
    expect(snapCoord(37, true)).toBe(48);
    expect(snapCoord(12, true)).toBe(24);
    expect(snapCoord(0, true)).toBe(0);
  });

  it('respects custom grid size', () => {
    expect(snapCoord(17, true, 10)).toBe(20);
  });
});

describe('snapPoint', () => {
  it('snaps both axes', () => {
    expect(snapPoint(37, 55, true, BOARD_GRID_SIZE)).toEqual({ x: 48, y: 48 });
  });
});
