import { describe, expect, it } from 'vitest';
import { pointerToStickyNormalized, stickyCanvasDprSize } from '../sticky-coords';

describe('sticky-coords', () => {
  it('maps client coords to normalized sticky space', () => {
    const pt = pointerToStickyNormalized(150, 80, { left: 100, top: 50, width: 200, height: 100 });
    expect(pt.x).toBeCloseTo(0.25);
    expect(pt.y).toBeCloseTo(0.3);
  });

  it('clamps normalized coords to 0–1', () => {
    const pt = pointerToStickyNormalized(50, 40, { left: 100, top: 50, width: 200, height: 100 });
    expect(pt.x).toBe(0);
    expect(pt.y).toBe(0);
  });

  it('computes DPR canvas backing size', () => {
    const { width, height, dpr } = stickyCanvasDprSize(100, 50, 2);
    expect(dpr).toBe(2);
    expect(width).toBe(200);
    expect(height).toBe(100);
  });
});
