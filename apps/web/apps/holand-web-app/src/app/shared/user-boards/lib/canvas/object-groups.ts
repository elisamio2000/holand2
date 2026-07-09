import { createId } from '@paralleldrive/cuid2';
import type { BoardObject, BoardObjectBase } from '../board-types';

function isSpatial(obj: BoardObject): obj is BoardObject & BoardObjectBase {
  return obj.type !== 'connector' && 'x' in obj;
}

/** Expand drag set to all members sharing an objectGroupId with any selected id. */
export function expandObjectGroupIds(seedIds: string[], objects: BoardObject[]): string[] {
  const ids = new Set(seedIds);
  const groupIds = new Set<string>();
  for (const id of ids) {
    const o = objects.find((x) => x.id === id);
    if (o && isSpatial(o) && o.objectGroupId) groupIds.add(o.objectGroupId);
  }
  if (!groupIds.size) return [...ids];
  for (const o of objects) {
    if (!isSpatial(o) || !o.objectGroupId) continue;
    if (groupIds.has(o.objectGroupId)) ids.add(o.id);
  }
  return [...ids];
}

export function groupSpatialObjects(
  objects: BoardObject[],
  objectIds: string[]
): BoardObject[] {
  const spatialIds = objectIds.filter((id) => {
    const o = objects.find((x) => x.id === id);
    return o && isSpatial(o);
  });
  if (spatialIds.length < 2) return objects;
  const groupId = createId();
  const idSet = new Set(spatialIds);
  return objects.map((o) =>
    idSet.has(o.id) && isSpatial(o) ? { ...o, objectGroupId: groupId } : o
  );
}

export function ungroupSpatialObjects(objects: BoardObject[], objectIds: string[]): BoardObject[] {
  const idSet = new Set(objectIds);
  return objects.map((o) => {
    if (!idSet.has(o.id) || !isSpatial(o) || !o.objectGroupId) return o;
    const { objectGroupId: _g, ...rest } = o;
    return rest as BoardObject;
  });
}

export function countGroupMembers(objects: BoardObject[], groupId: string): number {
  return objects.filter((o) => isSpatial(o) && o.objectGroupId === groupId).length;
}
