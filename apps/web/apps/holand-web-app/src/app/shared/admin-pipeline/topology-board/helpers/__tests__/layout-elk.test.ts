import { describe, expect, it } from 'vitest';
import { collapseEdgesToRoots } from '../layout-elk';
import type { TopologyEdge, TopologyNode } from '../topology-board-types';

function node(id: string, parentId?: string): TopologyNode {
  return {
    id,
    type: 'topoNode',
    position: { x: 0, y: 0 },
    parentId,
    data: { kind: 'tool', label: id, entityId: id },
  };
}

describe('collapseEdgesToRoots', () => {
  it('maps child edges to parent group ids', () => {
    const nodes = [node('g1'), node('c1', 'g1'), node('c2', 'g1'), node('m1')];
    const edges: TopologyEdge[] = [
      { id: 'e1', source: 'c1', target: 'm1' },
      { id: 'e2', source: 'c2', target: 'm1' },
    ];
    const collapsed = collapseEdgesToRoots(nodes, edges);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].source).toBe('g1');
    expect(collapsed[0].target).toBe('m1');
  });
});
