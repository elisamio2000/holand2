/**
 * IndexedDB store for personal map layers (GeoJSON / PMTiles blobs) â€” no server upload.
 */

const DB_NAME = 'Holand-map-local-layers';
const DB_VERSION = 1;
const STORE = 'layers';

export interface LocalLayerRecord {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  localKind: 'geojson' | 'pmtiles' | 'kml';
  payload: Blob | string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function putLocalLayer(record: LocalLayerRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalLayer(id: string): Promise<LocalLayerRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as LocalLayerRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalLayer(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Build a runtime URL for a stored layer (caller must revoke when done). */
export async function localLayerRuntimeUrl(
  record: LocalLayerRecord
): Promise<{ url: string; type: 'raster' | 'geojson'; data?: GeoJSON.GeoJSON }> {
  if (record.localKind === 'geojson') {
    const text =
      typeof record.payload === 'string'
        ? record.payload
        : await record.payload.text();
    return { url: '', type: 'geojson', data: JSON.parse(text) as GeoJSON.GeoJSON };
  }
  const blob = record.payload instanceof Blob ? record.payload : new Blob([record.payload]);
  const url =
    record.localKind === 'pmtiles'
      ? `pmtiles://${URL.createObjectURL(blob)}`
      : URL.createObjectURL(blob);
  return { url, type: 'raster' };
}

