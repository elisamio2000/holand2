import { describe, expect, it } from 'vitest';
import { parseBoardImportFile, parseBoardImportReplace } from '../board-import';

const fixture = {
  snapshot: {
    version: 1,
    viewBox: { x: 0, y: 0, width: 1400, height: 900 },
    objects: [
      {
        id: 'n1',
        type: 'node',
        x: 10,
        y: 20,
        width: 120,
        height: 80,
        label: 'A',
        nodeRole: 'person',
        color: '#22c55e',
      },
      {
        id: 'c1',
        type: 'connector',
        sourceId: 'n1',
        targetId: 'n1',
      },
    ],
    inkStrokes: [],
  },
};

describe('board-import', () => {
  it('parseBoardImportReplace normalizes snapshot', () => {
    const snap = parseBoardImportReplace(JSON.stringify(fixture));
    expect(snap?.objects).toHaveLength(2);
    expect(snap?.viewBox.width).toBe(1400);
  });

  it('parseBoardImportFile remaps ids', () => {
    const result = parseBoardImportFile(JSON.stringify(fixture));
    expect(result?.snapshot.objects[0].id).not.toBe('n1');
    const conn = result?.snapshot.objects.find((o) => o.type === 'connector');
    expect(conn?.sourceId).not.toBe('n1');
  });

  it('returns null for invalid json', () => {
    expect(parseBoardImportReplace('not json')).toBeNull();
  });
});
