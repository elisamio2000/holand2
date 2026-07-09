import { describe, expect, it } from 'vitest';
import { resolveCanvasContextHit } from '../canvas-hit-resolve';

describe('canvas-hit-resolve', () => {
  it('returns canvas when no target', () => {
    const hit = resolveCanvasContextHit(null, { worldX: 10, worldY: 20 });
    expect(hit).toEqual({ kind: 'canvas', worldX: 10, worldY: 20 });
  });
});
