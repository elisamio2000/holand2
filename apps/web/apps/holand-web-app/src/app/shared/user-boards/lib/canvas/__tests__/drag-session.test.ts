import { describe, expect, it } from 'vitest';
import {
  computeDragPreview,
  createDragSession,
  dragPreviewToUpdates,
} from '../drag-session';

const snap = (v: number) => Math.round(v / 24) * 24;

describe('createDragSession', () => {
  it('includes all selected ids in start positions', () => {
    const session = createDragSession(
      'a',
      100,
      100,
      50,
      50,
      ['a', 'b'],
      [
        { id: 'a', x: 50, y: 50 },
        { id: 'b', x: 200, y: 200 },
        { id: 'c', x: 0, y: 0 },
      ]
    );
    expect(session.startPositions.size).toBe(2);
    expect(session.startPositions.get('b')).toEqual({ x: 200, y: 200 });
  });

  it('uses only primary when not in selection', () => {
    const session = createDragSession('a', 10, 10, 0, 0, ['b'], [{ id: 'a', x: 0, y: 0 }]);
    expect([...session.startPositions.keys()]).toEqual(['a']);
  });
});

describe('computeDragPreview', () => {
  it('moves group by same delta', () => {
    const session = createDragSession(
      'a',
      100,
      100,
      48,
      48,
      ['a', 'b'],
      [
        { id: 'a', x: 48, y: 48 },
        { id: 'b', x: 120, y: 120 },
      ]
    );
    const preview = computeDragPreview(session, 100, 100, snap);
    expect(preview.get('a')).toEqual({ x: 48, y: 48 });
    expect(preview.get('b')).toEqual({ x: 120, y: 120 });
  });

  it('applies delta when pointer moves', () => {
    const session = createDragSession(
      'a',
      50,
      50,
      0,
      0,
      ['a'],
      [{ id: 'a', x: 0, y: 0 }]
    );
    const preview = computeDragPreview(session, 74, 50, snap);
    expect(preview.get('a')).toEqual({ x: 24, y: 0 });
  });
});

describe('dragPreviewToUpdates', () => {
  it('converts map to array', () => {
    const map = new Map([
      ['a', { x: 1, y: 2 }],
      ['b', { x: 3, y: 4 }],
    ]);
    expect(dragPreviewToUpdates(map)).toEqual([
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 3, y: 4 },
    ]);
  });
});
