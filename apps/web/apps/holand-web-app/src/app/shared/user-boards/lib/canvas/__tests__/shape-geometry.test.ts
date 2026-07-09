import { describe, expect, it } from 'vitest';
import { getShapeElement } from '../shape-geometry';
import { nodeShapeBounds } from '../node-shape';

describe('shape-geometry', () => {
  it('renders rounded rect with custom corner radii as path', () => {
    const bounds = nodeShapeBounds(0, 0, 100, 80);
    const el = getShapeElement(
      { kind: 'preset', preset: 'rounded', cornerRadii: [10, 20, 5, 15] },
      bounds,
      '#f00',
      '#000',
      1
    );
    expect(el.type).toBe('path');
    expect(String(el.attrs.d)).toContain('A');
  });

  it('renders uniform rounded rect as rect with rx', () => {
    const bounds = nodeShapeBounds(0, 0, 100, 80);
    const el = getShapeElement(
      { kind: 'preset', preset: 'rounded', cornerRadii: 8 },
      bounds,
      '#f00',
      '#000',
      1
    );
    expect(el.type).toBe('rect');
    expect(el.attrs.rx).toBe(8);
  });
});
