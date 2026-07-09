import { createId } from '@paralleldrive/cuid2';
import type { BoardRecord, BoardSnapshot } from './board-types';
import { normalizeBoardSnapshot } from './board-snapshot';

export interface BoardImportResult {
  snapshot: BoardSnapshot;
  title?: string;
}

function remapSnapshotIds(snapshot: BoardSnapshot): BoardSnapshot {
  const idMap = new Map<string, string>();
  for (const o of snapshot.objects) {
    if ('id' in o) idMap.set(o.id, createId());
  }
  return {
    ...snapshot,
    objects: snapshot.objects.map((o) => {
      const clone = JSON.parse(JSON.stringify(o)) as typeof o;
      if ('id' in clone) clone.id = idMap.get(clone.id) ?? createId();
      if (clone.type === 'connector') {
        clone.sourceId = idMap.get(clone.sourceId) ?? clone.sourceId;
        clone.targetId = idMap.get(clone.targetId) ?? clone.targetId;
      }
      return clone;
    }),
  };
}

export function parseBoardImportFile(text: string): BoardImportResult | null {
  try {
    const raw = JSON.parse(text) as {
      board?: BoardRecord;
      snapshot?: BoardSnapshot;
      title?: string;
    };
    const snap = raw.snapshot ?? raw.board?.snapshot;
    if (!snap) return null;
    const normalized = normalizeBoardSnapshot(snap);
    return {
      snapshot: remapSnapshotIds(normalized),
      title: raw.board?.title ?? raw.title,
    };
  } catch {
    return null;
  }
}

export function parseBoardImportReplace(text: string): BoardSnapshot | null {
  try {
    const raw = JSON.parse(text) as { snapshot?: BoardSnapshot; board?: BoardRecord };
    const snap = raw.snapshot ?? raw.board?.snapshot;
    if (!snap) return null;
    return normalizeBoardSnapshot(snap);
  } catch {
    return null;
  }
}
