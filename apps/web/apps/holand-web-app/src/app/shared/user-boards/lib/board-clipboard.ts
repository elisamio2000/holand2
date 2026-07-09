import { createId } from '@paralleldrive/cuid2';
import type { BoardConnectorObject, BoardObject, BoardSnapshot } from './board-types';

export interface BoardClipboardPayload {
  version: 1;
  objects: BoardObject[];
  offset: { x: number; y: number };
}

let memoryClipboard: BoardClipboardPayload | null = null;

export function copyBoardSelection(
  objects: BoardObject[],
  selectedIds: string[]
): BoardClipboardPayload | null {
  const idSet = new Set(selectedIds);
  const spatial = objects.filter(
    (o) => o.type !== 'connector' && 'id' in o && idSet.has(o.id)
  ) as BoardObject[];
  if (!spatial.length) return null;

  const connectors = objects.filter(
    (o): o is BoardConnectorObject =>
      o.type === 'connector' && idSet.has(o.sourceId) && idSet.has(o.targetId)
  );

  let minX = Infinity;
  let minY = Infinity;
  for (const o of spatial) {
    if ('x' in o) {
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
    }
  }

  const payload: BoardClipboardPayload = {
    version: 1,
    objects: [...spatial, ...connectors],
    offset: { x: minX, y: minY },
  };
  memoryClipboard = payload;
  return payload;
}

export function getBoardClipboard(): BoardClipboardPayload | null {
  return memoryClipboard;
}

export function pasteBoardClipboard(
  snapshot: BoardSnapshot,
  pasteAt?: { x: number; y: number }
): BoardObject[] {
  const clip = memoryClipboard;
  if (!clip?.objects.length) return [];

  const idMap = new Map<string, string>();
  for (const o of clip.objects) {
    if ('id' in o) idMap.set(o.id, createId());
  }

  const dx = (pasteAt?.x ?? clip.offset.x + 24) - clip.offset.x;
  const dy = (pasteAt?.y ?? clip.offset.y + 24) - clip.offset.y;

  return clip.objects.map((o) => {
    const clone = JSON.parse(JSON.stringify(o)) as BoardObject;
    if ('id' in clone) clone.id = idMap.get(clone.id) ?? createId();
    if (clone.type === 'connector') {
      const c = clone as BoardConnectorObject;
      c.sourceId = idMap.get(c.sourceId) ?? c.sourceId;
      c.targetId = idMap.get(c.targetId) ?? c.targetId;
      return c;
    }
    if ('x' in clone && 'y' in clone) {
      clone.x += dx;
      clone.y += dy;
    }
    return clone;
  });
}

export function hasBoardClipboard(): boolean {
  return Boolean(memoryClipboard?.objects.length);
}
