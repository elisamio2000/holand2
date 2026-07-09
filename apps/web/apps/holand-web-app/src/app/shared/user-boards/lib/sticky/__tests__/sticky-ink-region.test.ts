import { describe, expect, it } from 'vitest';
import {
  computeStickyInkPreviewLayout,
  normalizeStickyInkRegion,
  pointerToBodyNormalized,
  resolveStickyBodyRects,
} from '../sticky-ink-region';

describe('sticky-ink-region', () => {
  it('defaults to full overlay body', () => {
    const r = normalizeStickyInkRegion(undefined);
    expect(r.layout).toBe('overlay');
    expect(r.w).toBe(1);
    expect(r.h).toBe(1);
  });

  it('wrap-start splits text and ink columns', () => {
    const layout = resolveStickyBodyRects(200, 100, {
      x: 0,
      y: 0,
      w: 0.4,
      h: 1,
      layout: 'wrap-start',
    });
    expect(layout.ink.w).toBe(80);
    expect(layout.text.x).toBe(80);
    expect(layout.text.w).toBe(120);
    expect(layout.textBehindInk).toBe(false);
  });

  it('maps pointer inside ink rect to body-normalized coords', () => {
    const body = { left: 0, top: 0, width: 200, height: 100 };
    const ink = { x: 0, y: 0, w: 100, h: 100 };
    const pt = pointerToBodyNormalized(50, 50, body, ink);
    expect(pt).toEqual({ x: 0.25, y: 0.5 });
  });

  it('rejects pointer outside ink rect', () => {
    const body = { left: 0, top: 0, width: 200, height: 100 };
    const ink = { x: 0, y: 0, w: 80, h: 100 };
    expect(pointerToBodyNormalized(150, 50, body, ink)).toBeNull();
  });

  it('caps preview canvas and fits large ink regions', () => {
    const ink = { x: 0, y: 0, w: 2000, h: 1500 };
    const strokes = [
      {
        normalized: true,
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.8 },
        ],
      },
    ];
    const preview = computeStickyInkPreviewLayout(2000, 1500, ink, strokes);
    expect(preview.canvasW).toBeLessThanOrEqual(240);
    expect(preview.canvasH).toBeLessThanOrEqual(140);
    expect(preview.scale).toBeLessThan(1);
  });
});
