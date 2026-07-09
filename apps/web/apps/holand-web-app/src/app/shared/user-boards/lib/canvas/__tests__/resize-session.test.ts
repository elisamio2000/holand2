import { describe, expect, it } from 'vitest';
import { computeResizePreview, createResizeSession } from '../resize-session';

const snap = (v: number) => v;

describe('resize-session 4-corner', () => {
  const base = createResizeSession('id', 100, 80, 200, 120, 0, 0, 'se');

  it('SE grows width and height', () => {
    const p = computeResizePreview(base, 50, 30, snap);
    expect(p).toEqual({ x: 100, y: 80, width: 250, height: 150 });
  });

  it('NW moves origin and shrinks', () => {
    const nw = createResizeSession('id', 100, 80, 200, 120, 100, 80, 'nw');
    const p = computeResizePreview(nw, 150, 90, snap);
    expect(p.x).toBe(150);
    expect(p.y).toBe(90);
    expect(p.width).toBe(150);
    expect(p.height).toBe(110);
  });

  it('SW adjusts x and height', () => {
    const sw = createResizeSession('id', 100, 80, 200, 120, 0, 0, 'sw');
    const p = computeResizePreview(sw, -40, 20, snap);
    expect(p.x).toBe(60);
    expect(p.width).toBe(240);
    expect(p.height).toBe(140);
  });
});
