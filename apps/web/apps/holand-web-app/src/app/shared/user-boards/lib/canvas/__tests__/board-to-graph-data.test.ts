import { describe, expect, it } from 'vitest';
import { boardSnapshotToGraphData, NODE_ROLE_TO_ENTITY, CONNECTOR_KIND_TO_RELATION } from '../board-to-graph-data';
import type { BoardNodeObject, BoardConnectorObject, BoardSnapshot } from '../../board-types';

const baseSnapshot = (): BoardSnapshot => ({
  version: 1,
  viewBox: { x: 0, y: 0, width: 1000, height: 800 },
  objects: [],
  inkStrokes: [],
  comments: [],
  attachments: [],
  reportTitle: '',
  reportContent: '',
  legalHold: false,
});

const node = (id: string, role: BoardNodeObject['nodeRole'] = 'person'): BoardNodeObject => ({
  type: 'node',
  id,
  x: 100,
  y: 200,
  width: 120,
  height: 48,
  label: `Node ${id}`,
  nodeRole: role,
  color: '#3b82f6',
});

const connector = (
  id: string,
  sourceId: string,
  targetId: string,
  kind: BoardConnectorObject['kind'] = 'flow'
): BoardConnectorObject => ({
  type: 'connector',
  id,
  sourceId,
  targetId,
  kind,
});

describe('boardSnapshotToGraphData', () => {
  it('maps nodes and connectors to GraphData', () => {
    const snap = baseSnapshot();
    snap.objects = [node('a', 'person'), node('b', 'organization'), connector('e1', 'a', 'b', 'flow')];
    snap.graphLayout = { a: { x: 10, y: 20 } };

    const data = boardSnapshotToGraphData(snap);

    expect(data.nodes).toHaveLength(2);
    expect(data.links).toHaveLength(1);
    expect(data.nodes[0].type).toBe(NODE_ROLE_TO_ENTITY.person);
    expect(data.links[0].relation).toBe(CONNECTOR_KIND_TO_RELATION.flow);
    expect(data.nodes.find((n) => n.id === 'a')?.fx).toBe(10);
    expect(data.stats.entity_count).toBe(2);
    expect(data.stats.relationship_count).toBe(1);
  });

  it('sets connection counts on nodes', () => {
    const snap = baseSnapshot();
    snap.objects = [
      node('a'),
      node('b'),
      connector('e1', 'a', 'b'),
      connector('e2', 'a', 'b', 'link'),
    ];

    const data = boardSnapshotToGraphData(snap);
    const nodeA = data.nodes.find((n) => n.id === 'a');
    expect(nodeA?.connectionCount).toBe(2);
  });

  it('returns empty graph for no nodes', () => {
    const data = boardSnapshotToGraphData(baseSnapshot());
    expect(data.nodes).toHaveLength(0);
    expect(data.links).toHaveLength(0);
  });
});
