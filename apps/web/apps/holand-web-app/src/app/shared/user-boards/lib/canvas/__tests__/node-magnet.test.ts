import { describe, expect, it } from 'vitest';
import {
  applyMagnetOnConnect,
  expandDragIds,
  getAnchorLinksAmong,
  getNodeAnchorPeers,
  hasAnchorLinkBetween,
  listMagnetChildren,
  magnetAttachPatch,
  unlinkAllAmongNodes,
} from '../node-magnet';
import type { BoardNodeObject, BoardStickyObject } from '../../board-types';

const node = (id: string, x = 0, y = 0): BoardNodeObject => ({
  type: 'node',
  id,
  x,
  y,
  width: 80,
  height: 80,
  label: id,
  nodeRole: 'topic',
  color: '#3b82f6',
  magnetEnabled: true,
});

const sticky = (id: string, x: number, y: number): BoardStickyObject => ({
  type: 'sticky',
  id,
  x,
  y,
  width: 160,
  height: 120,
  text: '',
  color: '#fef08a',
});

describe('node-magnet', () => {
  it('expands drag ids with magnet children when node magnet is on', () => {
    const n = node('n1', 100, 100);
    const s = { ...sticky('s1', 200, 120), attachedNodeId: 'n1' };
    const ids = expandDragIds('n1', [], [n, s]);
    expect(ids).toContain('n1');
    expect(ids).toContain('s1');
  });

  it('skips magnet children when node magnet is off', () => {
    const n = { ...node('n1'), magnetEnabled: false };
    const s = { ...sticky('s1', 200, 120), attachedNodeId: 'n1' };
    const ids = expandDragIds('n1', [], [n, s]);
    expect(ids).toEqual(['n1']);
  });

  it('includes anchor-linked nodes', () => {
    const n1 = { ...node('n1'), linkedNodeIds: ['n2'] };
    const n2 = node('n2');
    const ids = expandDragIds('n1', [], [n1, n2]);
    expect(ids).toContain('n2');
  });

  it('includes reverse anchor links when dragging the linked node', () => {
    const n1 = { ...node('n1'), linkedNodeIds: ['n2'] };
    const n2 = node('n2');
    const ids = expandDragIds('n2', [], [n1, n2]);
    expect(ids).toContain('n1');
  });

  it('attaches sticky to node on connect', () => {
    const n = node('n1', 50, 50);
    const s = sticky('s1', 200, 80);
    const next = applyMagnetOnConnect([n, s], 's1', 'n1');
    const attached = next.find((o) => o.id === 's1') as BoardStickyObject;
    expect(attached.attachedNodeId).toBe('n1');
    expect(attached.attachOffsetX).toBe(150);
    expect(attached.attachOffsetY).toBe(30);
  });

  it('computes magnet offset patch', () => {
    const patch = magnetAttachPatch(sticky('s1', 120, 40), node('n1', 100, 20));
    expect(patch).toEqual({ attachedNodeId: 'n1', attachOffsetX: 20, attachOffsetY: 20 });
  });

  it('getNodeAnchorPeers returns forward and reverse links', () => {
    const n1 = node('n1');
    const n2 = { ...node('n2'), linkedNodeIds: ['n1'] };
    const n3 = { ...node('n3'), linkedNodeIds: ['n1'] };
    expect(getNodeAnchorPeers([n1, n2, n3], 'n1').sort()).toEqual(['n2', 'n3']);
  });

  it('hasAnchorLinkBetween detects bidirectional links', () => {
    const n1 = { ...node('n1'), linkedNodeIds: ['n2'] };
    const n2 = node('n2');
    expect(hasAnchorLinkBetween([n1, n2], 'n1', 'n2')).toBe(true);
    expect(hasAnchorLinkBetween([n1, n2], 'n2', 'n1')).toBe(true);
  });

  it('getAnchorLinksAmong returns unique pairs in selection', () => {
    const n1 = { ...node('n1'), linkedNodeIds: ['n2', 'n3'] };
    const n2 = { ...node('n2'), linkedNodeIds: ['n1'] };
    const n3 = node('n3');
    const pairs = getAnchorLinksAmong([n1, n2, n3], ['n1', 'n2', 'n3']);
    expect(pairs).toHaveLength(2);
    expect(pairs).toContainEqual(['n1', 'n2']);
    expect(pairs).toContainEqual(['n1', 'n3']);
  });

  it('listMagnetChildren returns attached stickies', () => {
    const n = node('n1');
    const s = { ...sticky('s1', 0, 0), attachedNodeId: 'n1' };
    expect(listMagnetChildren([n, s], 'n1').map((o) => o.id)).toEqual(['s1']);
  });

  it('unlinkAllAmongNodes removes all links in selection', () => {
    const n1 = { ...node('n1'), linkedNodeIds: ['n2'] };
    const n2 = { ...node('n2'), linkedNodeIds: ['n1'] };
    const next = unlinkAllAmongNodes([n1, n2], ['n1', 'n2']);
    expect((next.find((o) => o.id === 'n1') as BoardNodeObject).linkedNodeIds ?? []).toEqual([]);
    expect((next.find((o) => o.id === 'n2') as BoardNodeObject).linkedNodeIds ?? []).toEqual([]);
  });
});
