/**
 * File System Access API helpers for personal map layers (no server upload).
 */

const FSA_HANDLES_DB = 'Holand-map-fsa-handles';
const FSA_STORE = 'handles';

export interface FsaHandleRecord {
  id: string;
  pathHint: string;
  kind: 'file' | 'directory';
  savedAt: number;
}

function openFsaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FSA_HANDLES_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FSA_STORE)) {
        db.createObjectStore(FSA_STORE, { keyPath: 'id' });
      }
    };
  });
}

export function fsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export async function pickLocalFile(
  accept: Record<string, string[]>
): Promise<File | null> {
  if (!fsaSupported()) return null;
  try {
    const handles = await (
      window as unknown as Window & {
        showOpenFilePicker: (opts: object) => Promise<FileSystemFileHandle[]>;
      }
    ).showOpenFilePicker({ multiple: false, types: [{ accept }] });
    const handle = handles[0];
    return handle.getFile();
  } catch {
    return null;
  }
}

export async function pickLocalDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!fsaSupported() || !('showDirectoryPicker' in window)) return null;
  try {
    return await (
      window as unknown as Window & {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker();
  } catch {
    return null;
  }
}

export async function saveFsaHandle(
  id: string,
  handle: FileSystemHandle,
  pathHint: string
): Promise<void> {
  const db = await openFsaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_STORE, 'readwrite');
    const kind = handle.kind === 'directory' ? 'directory' : 'file';
    tx.objectStore(FSA_STORE).put({ id, handle, pathHint, kind, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFsaHandle(id: string): Promise<FileSystemHandle | null> {
  const db = await openFsaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FSA_STORE, 'readonly');
    const req = tx.objectStore(FSA_STORE).get(id);
    req.onsuccess = () => {
      const row = req.result as { handle?: FileSystemHandle } | undefined;
      resolve(row?.handle ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Async iterator over directory entries â€” TS lib may omit `values()` on FileSystemDirectoryHandle. */
export async function* iterateDirectoryEntries(
  dir: FileSystemDirectoryHandle
): AsyncGenerator<FileSystemHandle> {
  const values = (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of values) {
    yield entry;
  }
}

/** Sniff a local directory for GeoJSON / PMTiles (not SAS sqlite â€” use shared server path). */
export async function sniffLocalDirectory(
  dir: FileSystemDirectoryHandle
): Promise<{ kind: 'geojson' | 'pmtiles' | 'unknown'; fileName?: string; warning?: string }> {
  for await (const entry of iterateDirectoryEntries(dir)) {
    if (entry.kind !== 'file') continue;
    const name = entry.name.toLowerCase();
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      return { kind: 'geojson', fileName: entry.name };
    }
    if (name.endsWith('.pmtiles')) {
      return { kind: 'pmtiles', fileName: entry.name };
    }
  }
  return {
    kind: 'unknown',
    warning: 'Ù¾ÙˆØ´Ù‡Ù” SAS/SQLite Ù…Ø­Ù„ÛŒ Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ú©Ø§Ù…Ù„ Ù†Ø¯Ø§Ø±Ø¯ â€” Ø§Ø² Â«Ù…Ø³ÛŒØ± Ù…Ø´ØªØ±Ú© Ø³Ø±ÙˆØ±Â» Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù†ÛŒØ¯.',
  };
}

