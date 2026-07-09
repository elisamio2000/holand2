import { describe, expect, it } from 'vitest';
import {
  expandViewBox,
  filterInkStrokesInView,
  filterSpatialObjectsInView,
} from '../viewport-cull';
import type { BoardInkStroke, BoardStickyObject, BoardViewBox } from '../../board-types';

const vb: BoardViewBox = { x: 0, y: 0, width: 100, height: 100 };

describe('viewport-cull', () => {
  it('filters spatial objects outside viewBox', () => {
    const inside: BoardStickyObject = {
      id: 'a',
      type: 'sticky',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      z: 1,
      text: 'in',
      color: '#fef08a',
    };
    const outside: BoardStickyObject = {
      id: 'b',
      type: 'sticky',
      x: 500,
      y: 500,
      width: 40,
      height: 40,
      z: 2,
      text: 'out',
      color: '#fef08a',
    };
    const result = filterSpatialObjectsInView([inside, outside], vb);
    expect(result.map((o) => o.id)).toEqual(['a']);
  });

  it('expands viewBox with margin', () => {
    const expanded = expandViewBox(vb, 10);
    expect(expanded.x).toBe(-10);
    expect(expanded.width).toBe(120);
  });

  it('keeps ink strokes that intersect view', () => {
    const stroke: BoardInkStroke = {
      id: 's1',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.9 },
      ],
      color: '#000',
      width: 2,
      normalized: true,
    };
    const far: BoardInkStroke = {
      id: 's2',
      points: [
        { x: 5000, y: 5000 },
        { x: 5100, y: 5100 },
      ],
      color: '#000',
      width: 2,
      normalized: false,
    };
    const kept = filterInkStrokesInView([stroke, far], vb);
    expect(kept.some((s) => s.id === 's1')).toBe(true);
    expect(kept.some((s) => s.id === 's2')).toBe(false);
  });
});
