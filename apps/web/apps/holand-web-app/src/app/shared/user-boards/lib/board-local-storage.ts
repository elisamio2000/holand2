import type { BoardRecord } from './board-types';
import { normalizeBoardRecord } from './board-snapshot';

const DB_NAME = 'user-boards-db';
const DB_VERSION = 1;
const BOARD_STORE = 'boards';
const CHECKPOINT_STORE = 'checkpoints';
const LIBRARY_STORE = 'library';

export interface BoardCheckpointRecord {
  id: string;
  boardId: string;
  label: string;
  createdAt: string;
  snapshot: BoardRecord['snapshot'];
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOARD_STORE)) {
        db.createObjectStore(BOARD_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
        const store = db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
        store.createIndex('boardId', 'boardId', { unique: false });
      }
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
        db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function txDone(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function upsertBoard(record: BoardRecord): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const tx = db.transaction(BOARD_STORE, 'readwrite');
  tx.objectStore(BOARD_STORE).put(record);
  const ok = await txDone(tx);
  db.close();
  return ok;
}

export async function loadBoard(boardId: string): Promise<BoardRecord | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(BOARD_STORE, 'readonly');
  const req = tx.objectStore(BOARD_STORE).get(boardId);
  const result = await new Promise<BoardRecord | null>((resolve) => {
    req.onsuccess = () => resolve(normalizeBoardRecord(req.result as BoardRecord));
    req.onerror = () => resolve(null);
  });
  db.close();
  return result;
}

export async function listBoards(): Promise<BoardRecord[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(BOARD_STORE, 'readonly');
  const req = tx.objectStore(BOARD_STORE).getAll();
  const result = await new Promise<BoardRecord[]>((resolve) => {
    req.onsuccess = () => {
      const rows = ((req.result as BoardRecord[]) ?? [])
        .map((r) => normalizeBoardRecord(r))
        .filter((r): r is BoardRecord => r !== null);
      resolve(rows);
    };
    req.onerror = () => resolve([]);
  });
  db.close();
  return result.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function deleteBoard(boardId: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const tx = db.transaction(BOARD_STORE, 'readwrite');
  tx.objectStore(BOARD_STORE).delete(boardId);
  const ok = await txDone(tx);
  db.close();
  return ok;
}

export async function duplicateBoard(source: BoardRecord, newTitle: string): Promise<BoardRecord | null> {
  const now = new Date().toISOString();
  const copy: BoardRecord = {
    ...JSON.parse(JSON.stringify(source)) as BoardRecord,
    id: `${source.id}_copy_${Date.now()}`,
    title: newTitle,
    createdAt: now,
    updatedAt: now,
    snapshotVersion: undefined,
  };
  const ok = await upsertBoard(copy);
  return ok ? copy : null;
}

export async function createCheckpoint(
  boardId: string,
  label: string,
  snapshot: BoardRecord['snapshot']
): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const record: BoardCheckpointRecord = {
    id: `cp_${boardId}_${Date.now()}`,
    boardId,
    label,
    createdAt: new Date().toISOString(),
    snapshot: JSON.parse(JSON.stringify(snapshot)) as BoardRecord['snapshot'],
  };
  const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
  tx.objectStore(CHECKPOINT_STORE).put(record);
  const ok = await txDone(tx);
  db.close();
  return ok;
}

export async function deleteCheckpoint(checkpointId: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
  tx.objectStore(CHECKPOINT_STORE).delete(checkpointId);
  const ok = await txDone(tx);
  db.close();
  return ok;
}

export async function listCheckpoints(boardId: string): Promise<BoardCheckpointRecord[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(CHECKPOINT_STORE, 'readonly');
  const index = tx.objectStore(CHECKPOINT_STORE).index('boardId');
  const req = index.getAll(boardId);
  const result = await new Promise<BoardCheckpointRecord[]>((resolve) => {
    req.onsuccess = () => resolve((req.result as BoardCheckpointRecord[]) ?? []);
    req.onerror = () => resolve([]);
  });
  db.close();
  return result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
