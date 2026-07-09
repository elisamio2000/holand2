import { createId } from '@paralleldrive/cuid2';
import type {
  BoardObject,
  BoardRecord,
  BoardSnapshot,
  BoardViewBox,
  BoardPurpose,
} from './board-types';
import {
  createMinimalLinkConnector,
  seedGraphLayout,
  syncGraphFromLinks,
} from './canvas/graph-sync';
import { objectToWorldAabb } from './canvas/shape-world-geometry';
import {
  resolveCanvasHiddenNodeRoles,
} from './board-view-settings';
import { normalizeAttachmentList } from './board-attachment-utils';

export type BoardDocumentState = Omit<BoardSnapshot, 'viewBox'>;

export const DEFAULT_VIEW_BOX: BoardViewBox = {
  x: -700,
  y: -450,
  width: 1400,
  height: 900,
};

export function createEmptySnapshot(): BoardSnapshot {
  return {
    version: 1,
    viewBox: { ...DEFAULT_VIEW_BOX },
    objects: [],
    inkStrokes: [],
    comments: [],
    attachments: [],
    reportTitle: '',
    reportContent: '',
    legalHold: false,
  };
}

export function createBoardRecord(title: string, purpose?: BoardPurpose): BoardRecord {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title,
    purpose: purpose ?? 'free',
    createdAt: now,
    updatedAt: now,
    snapshot: createEmptySnapshot(),
  };
}

export function normalizeBoardSnapshot(snapshot: Partial<BoardSnapshot> | null | undefined): BoardSnapshot {
  if (!snapshot || snapshot.version !== 1) {
    return createEmptySnapshot();
  }
  const objects = (Array.isArray(snapshot.objects) ? snapshot.objects : []).map((o) => {
    if (o.type === 'node' && !o.geometry && o.nodeShape) {
      return {
        ...o,
        geometry: {
          kind: 'preset' as const,
          preset: o.nodeShape,
          ...(o.nodeShape === 'rounded' ? { cornerRadii: 8 } : {}),
        },
      };
    }
    return o;
  });
  let doc: BoardDocumentState = {
    version: 1 as const,
    objects,
    inkStrokes: Array.isArray(snapshot.inkStrokes) ? snapshot.inkStrokes : [],
    comments: Array.isArray(snapshot.comments) ? snapshot.comments : [],
    attachments: normalizeAttachmentList(
      Array.isArray(snapshot.attachments) ? snapshot.attachments : undefined
    ),
    reportTitle: snapshot.reportTitle ?? '',
    reportContent: snapshot.reportContent ?? '',
    legalHold: Boolean(snapshot.legalHold),
    styleDefaults: snapshot.styleDefaults,
    canvasHiddenNodeRoles: resolveCanvasHiddenNodeRoles(snapshot as BoardSnapshot),
    hiddenNodeRoles: resolveCanvasHiddenNodeRoles(snapshot as BoardSnapshot),
    graphViewSettings: snapshot.graphViewSettings,
    graphViewFilter: snapshot.graphViewFilter,
    graphLayout: snapshot.graphLayout,
    graphTopologyFingerprint: snapshot.graphTopologyFingerprint,
    backgroundLayers: Array.isArray(snapshot.backgroundLayers) ? snapshot.backgroundLayers : [],
  };
  doc = syncGraphFromLinks(doc, createMinimalLinkConnector);
  doc = seedGraphLayout(doc);
  return {
    ...doc,
    viewBox: snapshot.viewBox ?? { ...DEFAULT_VIEW_BOX },
  };
}

export function normalizeBoardRecord(record: Partial<BoardRecord> | null | undefined): BoardRecord | null {
  if (!record?.id) return null;
  return {
    id: record.id,
    title: record.title ?? 'Untitled board',
    purpose: record.purpose,
    ownerId: record.ownerId,
    caseId: record.caseId,
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    snapshot: normalizeBoardSnapshot(record.snapshot),
    snapshotVersion: record.snapshotVersion,
  };
}

export function boardObjectCount(snapshot: BoardSnapshot): number {
  return snapshot.objects.filter((o) => o.type !== 'connector').length;
}

export function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as BoardSnapshot;
}

export function extractDocument(snapshot: BoardSnapshot): BoardDocumentState {
  const { viewBox: _vb, ...doc } = snapshot;
  return JSON.parse(JSON.stringify(doc)) as BoardDocumentState;
}

export function cloneDocument(doc: BoardDocumentState): BoardDocumentState {
  return JSON.parse(JSON.stringify(doc)) as BoardDocumentState;
}

export function withViewBox(doc: BoardDocumentState, viewBox: BoardViewBox): BoardSnapshot {
  return { ...doc, viewBox };
}

export interface SnapshotBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getSnapshotBounds(snapshot: BoardSnapshot): SnapshotBounds {
  const pad = 48;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let has = false;

  const expand = (x: number, y: number, w = 0, h = 0) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
    has = true;
  };

  for (const obj of snapshot.objects) {
    if (obj.type === 'connector') continue;
    if (obj.type === 'vector' || obj.type === 'node') {
      const aabb = objectToWorldAabb(obj);
      expand(aabb.minX, aabb.minY, aabb.maxX - aabb.minX, aabb.maxY - aabb.minY);
      continue;
    }
    if ('x' in obj) expand(obj.x, obj.y, obj.width, obj.height);
  }

  for (const stroke of snapshot.inkStrokes ?? []) {
    for (const p of stroke.points) expand(p.x, p.y);
  }

  for (const c of snapshot.comments ?? []) expand(c.x, c.y);

  if (!has) {
    const vb = snapshot.viewBox;
    return {
      minX: vb.x - pad,
      minY: vb.y - pad,
      maxX: vb.x + vb.width + pad,
      maxY: vb.y + vb.height + pad,
    };
  }

  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

export function fitViewBoxToBounds(
  bounds: SnapshotBounds,
  aspect: number,
  padding = 1.15
): BoardViewBox {
  const bw = Math.max(bounds.maxX - bounds.minX, 100);
  const bh = Math.max(bounds.maxY - bounds.minY, 100);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  let width = bw * padding;
  let height = width / aspect;
  if (height < bh * padding) {
    height = bh * padding;
    width = height * aspect;
  }
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

export function snapCoord(value: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function updateObjectInSnapshot(
  snapshot: BoardSnapshot,
  objectId: string,
  patch: Partial<BoardObject>
): BoardSnapshot {
  return {
    ...snapshot,
    objects: snapshot.objects.map((obj) => {
      if ('id' in obj && obj.id === objectId) {
        return { ...obj, ...patch } as BoardObject;
      }
      return obj;
    }),
  };
}

export function removeObjectFromSnapshot(snapshot: BoardSnapshot, objectId: string): BoardSnapshot {
  return {
    ...snapshot,
    objects: snapshot.objects.filter((obj) => {
      if (obj.type === 'connector') {
        return obj.sourceId !== objectId && obj.targetId !== objectId && obj.id !== objectId;
      }
      return obj.id !== objectId;
    }),
  };
}

export function nextZIndex(snapshot: BoardSnapshot): number {
  const zs = snapshot.objects
    .filter((o): o is BoardObject & { z?: number } => 'z' in o)
    .map((o) => o.z ?? 0);
  return (zs.length ? Math.max(...zs) : 0) + 1;
}
