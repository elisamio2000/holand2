import type { BoardDocumentState } from './board-snapshot';

export interface BoardRemoteSyncPayload {
  id: string;
  title: string;
  purpose?: string;
  caseId?: string;
  snapshot: BoardDocumentState;
  /** Increment when document fields change */
  revision?: number;
}

let lastSyncedRevision = 0;
let lastPayloadHash = '';

function hashPayload(payload: BoardRemoteSyncPayload): string {
  return JSON.stringify({
    objects: payload.snapshot.objects?.length ?? 0,
    comments: payload.snapshot.comments?.length ?? 0,
    attachments: payload.snapshot.attachments?.length ?? 0,
    reportTitle: payload.snapshot.reportTitle,
    reportContent: payload.snapshot.reportContent?.slice(0, 200),
    title: payload.title,
    caseId: payload.caseId,
  });
}

/** Returns true when remote sync should run (content changed since last sync). */
export function shouldSyncBoardRemote(payload: BoardRemoteSyncPayload): boolean {
  const hash = hashPayload(payload);
  if (hash === lastPayloadHash && (payload.revision ?? 0) === lastSyncedRevision) {
    return false;
  }
  return true;
}

export function markBoardRemoteSynced(payload: BoardRemoteSyncPayload): void {
  lastPayloadHash = hashPayload(payload);
  lastSyncedRevision = payload.revision ?? 0;
}

export function buildRemoteSyncPatch(
  prev: BoardDocumentState | null,
  next: BoardDocumentState
): Partial<BoardDocumentState> {
  if (!prev) return next;
  const patch: Partial<BoardDocumentState> = {};
  if (prev.objects !== next.objects) patch.objects = next.objects;
  if (prev.comments !== next.comments) patch.comments = next.comments;
  if (prev.attachments !== next.attachments) patch.attachments = next.attachments;
  if (prev.reportTitle !== next.reportTitle) patch.reportTitle = next.reportTitle;
  if (prev.reportContent !== next.reportContent) patch.reportContent = next.reportContent;
  if (prev.backgroundLayers !== next.backgroundLayers) patch.backgroundLayers = next.backgroundLayers;
  return patch;
}
