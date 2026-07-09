import { describe, expect, it } from 'vitest';
import {
  expandObjectGroupIds,
  groupSpatialObjects,
  ungroupSpatialObjects,
} from '../object-groups';
import type { BoardNodeObject, BoardStickyObject } from '../../board-types';

const node = (id: string, x = 0, y = 0, groupId?: string): BoardNodeObject => ({
  type: 'node',
  id,
  x,
  y,
  width: 80,
  height: 80,
  label: id,
  nodeRole: 'topic',
  color: '#3b82f6',
  objectGroupId: groupId,
});

const sticky = (id: string, x: number, y: number, groupId?: string): BoardStickyObject => ({
  type: 'sticky',
  id,
  x,
  y,
  width: 160,
  height: 120,
  text: '',
  color: '#fef08a',
  objectGroupId: groupId,
});

describe('object-groups', () => {
  it('expands drag ids to all group members', () => {
    const g = 'grp-1';
    const objects = [node('n1', 0, 0, g), sticky('s1', 10, 10, g), node('n2', 200, 0)];
    const ids = expandObjectGroupIds(['n1'], objects);
    expect(ids).toContain('n1');
    expect(ids).toContain('s1');
    expect(ids).not.toContain('n2');
  });

  it('groups spatial selection with shared objectGroupId', () => {
    const objects = [node('n1'), sticky('s1', 0, 100)];
    const next = groupSpatialObjects(objects, ['n1', 's1']);
    const g1 = (next.find((o) => o.id === 'n1') as BoardNodeObject).objectGroupId;
    expect(g1).toBeTruthy();
    expect((next.find((o) => o.id === 's1') as BoardStickyObject).objectGroupId).toBe(g1);
  });

  it('ungroups selected members', () => {
    const g = 'grp-1';
    const objects = [node('n1', 0, 0, g), sticky('s1', 0, 100, g)];
    const next = ungroupSpatialObjects(objects, ['n1']);
    expect((next.find((o) => o.id === 'n1') as BoardNodeObject).objectGroupId).toBeUndefined();
    expect((next.find((o) => o.id === 's1') as BoardStickyObject).objectGroupId).toBe(g);
  });
});
