import { describe, expect, it } from 'vitest';
import { distanceToStroke, eraseStrokesAtPoint } from '../ink-hit-test';
import type { BoardInkStroke } from '../../board-types';

const stroke: BoardInkStroke = {
  id: 's1',
  color: '#000',
  width: 4,
  tool: 'pen',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

describe('ink-hit-test', () => {
  it('finds distance to horizontal stroke', () => {
    expect(distanceToStroke(stroke, 50, 0)).toBeLessThan(3);
    expect(distanceToStroke(stroke, 50, 50)).toBeGreaterThan(40);
  });

  it('erases stroke near point', () => {
    const next = eraseStrokesAtPoint([stroke], 50, 0, 8);
    expect(next).toHaveLength(0);
  });

  it('keeps stroke when eraser is far', () => {
    const next = eraseStrokesAtPoint([stroke], 50, 100, 8);
    expect(next).toHaveLength(1);
  });
});
