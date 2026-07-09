import toast from 'react-hot-toast';
import { boardService } from '../services/board.service';
import type { BoardRecord } from '../lib/board-types';
import { markBoardRemoteSynced, shouldSyncBoardRemote } from './board-remote-sync-diff';

let remoteSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastFailedRow: {
  id: string;
  title: string;
  purpose?: BoardRecord['purpose'];
  caseId?: string;
  snapshot: BoardRecord['snapshot'];
} | null = null;

async function attemptSync(row: {
  id: string;
  title: string;
  purpose?: BoardRecord['purpose'];
  caseId?: string;
  snapshot: BoardRecord['snapshot'];
}): Promise<void> {
  const payload = {
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    caseId: row.caseId,
    snapshot: row.snapshot,
    revision: Date.now(),
  };
  if (!shouldSyncBoardRemote(payload)) return;

  const result = await boardService.upsertRemote(row);
  if (result) {
    lastFailedRow = null;
    markBoardRemoteSynced(payload);
    return;
  }
  lastFailedRow = row;
  toast.error('Cloud sync failed — saved locally', { id: 'board-sync-fail' });
}

export function scheduleBoardRemoteSync(
  row: {
    id: string;
    title: string;
    purpose?: BoardRecord['purpose'];
    caseId?: string;
    snapshot: BoardRecord['snapshot'];
  },
  debounceMs = 2200
): void {
  if (remoteSyncTimer) clearTimeout(remoteSyncTimer);
  remoteSyncTimer = setTimeout(() => {
    remoteSyncTimer = null;
    if (typeof window === 'undefined') return;
    void attemptSync(row);
  }, debounceMs);
}

export function retryBoardRemoteSync(): void {
  if (!lastFailedRow) return;
  void attemptSync(lastFailedRow);
}
