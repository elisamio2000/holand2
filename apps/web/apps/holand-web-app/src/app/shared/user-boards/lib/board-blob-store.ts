const DB_NAME = 'user-boards-blobs';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function putBoardBlob(key: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const tx = db.transaction(BLOB_STORE, 'readwrite');
  tx.objectStore(BLOB_STORE).put({ key, blob });
  return new Promise((resolve) => {
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      resolve(false);
    };
  });
}

export async function getBoardBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(BLOB_STORE, 'readonly');
  const req = tx.objectStore(BLOB_STORE).get(key);
  return new Promise((resolve) => {
    req.onsuccess = () => {
      db.close();
      const row = req.result as { key: string; blob: Blob } | undefined;
      resolve(row?.blob ?? null);
    };
    req.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

export async function deleteBoardBlob(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(BLOB_STORE, 'readwrite');
  tx.objectStore(BLOB_STORE).delete(key);
  tx.oncomplete = () => db.close();
}

const urlCache = new Map<string, string>();

export async function getBoardBlobUrl(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key)!;
  const blob = await getBoardBlob(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function revokeBoardBlobUrl(key: string): void {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}
