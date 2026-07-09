import type { BoardLibraryCard } from './board-types';

const DB_NAME = 'user-boards-library';
const STORE = 'cards';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function listLibraryCards(): Promise<BoardLibraryCard[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as BoardLibraryCard[]) ?? []);
    req.onerror = () => resolve([]);
  });
}

export async function upsertLibraryCard(card: BoardLibraryCard): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(card);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
