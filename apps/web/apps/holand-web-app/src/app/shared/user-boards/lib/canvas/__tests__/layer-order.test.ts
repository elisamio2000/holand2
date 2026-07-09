import { describe, expect, it } from 'vitest';
import type { BoardSnapshot } from '../../board-types';
import { createEmptySnapshot } from '../../board-snapshot';
import {
  getSpatialLayerOrder,
  normalizeZIndices,
  reorderSpatialLayers,
} from '../layer-order';

function snap(objects: BoardSnapshot['objects']): BoardSnapshot {
  return { ...createEmptySnapshot(), objects };
}

describe('layer-order', () => {
  it('sorts spatial objects by z ascending', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 5 },
      { type: 'node', id: 'b', x: 0, y: 0, width: 100, height: 56, label: 'N', nodeRole: 'topic', color: '#000', z: 1 },
      { type: 'connector', id: 'c', sourceId: 'b', targetId: 'a' },
    ]);
    const ids = getSpatialLayerOrder(s).map((o) => ('id' in o ? o.id : ''));
    expect(ids).toEqual(['b', 'a']);
  });

  it('bring to front moves selection to top', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 0 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 1 },
      { type: 'sticky', id: 'c', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 2 },
    ]);
    const next = reorderSpatialLayers(s, ['a'], 'front');
    const zs = getSpatialLayerOrder(next).map((o) => ('z' in o ? o.z : 0));
    expect(zs).toEqual([0, 1, 2]);
    expect(getSpatialLayerOrder(next).map((o) => ('id' in o ? o.id : ''))).toEqual(['b', 'c', 'a']);
  });

  it('send to back moves selection to bottom', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 0 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 1 },
    ]);
    const next = reorderSpatialLayers(s, ['b'], 'back');
    expect(getSpatialLayerOrder(next).map((o) => ('id' in o ? o.id : ''))).toEqual(['b', 'a']);
  });

  it('bring forward swaps one step with neighbor above', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 0 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 1 },
      { type: 'sticky', id: 'c', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 2 },
    ]);
    const next = reorderSpatialLayers(s, ['a'], 'forward');
    expect(getSpatialLayerOrder(next).map((o) => ('id' in o ? o.id : ''))).toEqual(['b', 'a', 'c']);
  });

  it('send backward swaps one step with neighbor below', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 0 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 1 },
    ]);
    const next = reorderSpatialLayers(s, ['b'], 'backward');
    expect(getSpatialLayerOrder(next).map((o) => ('id' in o ? o.id : ''))).toEqual(['b', 'a']);
  });

  it('multi-select block moves together to front', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 0 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 1 },
      { type: 'sticky', id: 'c', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 2 },
    ]);
    const next = reorderSpatialLayers(s, ['a', 'b'], 'front');
    expect(getSpatialLayerOrder(next).map((o) => ('id' in o ? o.id : ''))).toEqual(['c', 'a', 'b']);
  });

  it('normalizeZIndices compacts z values', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 10 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 99 },
    ]);
    const next = normalizeZIndices(s);
    const zs = getSpatialLayerOrder(next).map((o) => ('z' in o ? o.z : 0));
    expect(zs).toEqual([0, 1]);
  });

  it('forward at top is no-op', () => {
    const s = snap([
      { type: 'sticky', id: 'a', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 0 },
      { type: 'sticky', id: 'b', x: 0, y: 0, width: 80, height: 80, text: '', color: '#fff', z: 1 },
    ]);
    const next = reorderSpatialLayers(s, ['b'], 'forward');
    expect(next).toBe(s);
  });
});
