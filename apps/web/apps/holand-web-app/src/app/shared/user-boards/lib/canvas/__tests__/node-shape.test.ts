import { describe, expect, it } from 'vitest';
import { graphNodeBorderRadius, normalizeNodeShape } from '../node-shape';

describe('node-shape', () => {
  it('normalizeNodeShape defaults to ellipse', () => {
    expect(normalizeNodeShape()).toBe('ellipse');
  });

  it('graphNodeBorderRadius varies by shape', () => {
    expect(graphNodeBorderRadius('rectangle')).toBe(0);
    expect(graphNodeBorderRadius('rounded')).toBe(8);
    expect(graphNodeBorderRadius('ellipse')).toBe(999);
  });
});
