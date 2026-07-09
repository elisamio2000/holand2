import { describe, expect, it } from 'vitest';
import {
  arrowDirectionToFlags,
  resolveArrowDirection,
  resolveConnectorStyle,
  strokeDasharray,
} from '../board-style';
import type { BoardConnectorObject } from '../board-types';

const baseConnector = (): BoardConnectorObject => ({
  type: 'connector',
  id: 'c1',
  sourceId: 'a',
  targetId: 'b',
});

describe('board-style', () => {
  it('maps stroke styles to dash arrays', () => {
    expect(strokeDasharray('solid')).toBeUndefined();
    expect(strokeDasharray('dashed')).toBe('6 4');
    expect(strokeDasharray('dotted')).toBe('2 4');
  });

  it('resolves arrow directions', () => {
    expect(resolveArrowDirection({ ...baseConnector(), arrowDirection: 'both' })).toBe('both');
    expect(resolveArrowDirection({ ...baseConnector(), arrowEnd: false })).toBe('none');
    expect(arrowDirectionToFlags('backward')).toEqual({ start: true, end: false });
  });

  it('merges connector style with board defaults', () => {
    const visual = resolveConnectorStyle(baseConnector(), {
      connectorColor: '#ff0000',
      connectorStrokeWidth: 4,
      connectorStrokeStyle: 'dotted',
      connectorOpacity: 0.5,
      connectorArrowDirection: 'both',
    });
    expect(visual.color).toBe('#ff0000');
    expect(visual.strokeWidth).toBe(4);
    expect(visual.strokeStyle).toBe('dotted');
    expect(visual.opacity).toBe(0.5);
    expect(visual.arrowStart).toBe(true);
    expect(visual.arrowEnd).toBe(true);
  });

  it('per-connector overrides beat defaults', () => {
    const visual = resolveConnectorStyle(
      { ...baseConnector(), color: '#00ff00', strokeWidth: 1, arrowDirection: 'none' },
      { connectorColor: '#ff0000', connectorStrokeWidth: 4 }
    );
    expect(visual.color).toBe('#00ff00');
    expect(visual.strokeWidth).toBe(1);
    expect(visual.arrowStart).toBe(false);
    expect(visual.arrowEnd).toBe(false);
  });
});
