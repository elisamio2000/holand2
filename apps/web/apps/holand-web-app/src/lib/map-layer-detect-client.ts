/** Client-side layer kind detection for personal (local) files. */

export interface ClientDetectResult {
  ok: boolean;
  localKind?: 'geojson' | 'pmtiles' | 'kml' | 'raster';
  layerKind?: string;
  error?: string;
  warning?: string;
}

const PMTILES_MAGIC = new Uint8Array([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73]); // PMTiles

export async function detectLocalFile(file: File): Promise<ClientDetectResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'geojson' || ext === 'json') {
    try {
      const text = await file.slice(0, 4096).text();
      JSON.parse(text.length < file.size ? text : await file.text());
      return { ok: true, localKind: 'geojson', layerKind: 'vector_geojson' };
    } catch {
      return { ok: false, error: 'فایل GeoJSON نامعتبر است.' };
    }
  }
  if (ext === 'pmtiles') {
    const head = new Uint8Array(await file.slice(0, 7).arrayBuffer());
    if (head.length >= 7 && head.every((b, i) => b === PMTILES_MAGIC[i])) {
      return { ok: true, localKind: 'pmtiles', layerKind: 'raster_pmtiles' };
    }
    return { ok: true, localKind: 'pmtiles', layerKind: 'raster_pmtiles', warning: 'هدر PMTiles تشخیص داده نشد' };
  }
  if (ext === 'kml' || ext === 'kmz') {
    return { ok: true, localKind: 'kml', layerKind: 'vector_kml' };
  }
  return { ok: false, error: 'فرمت پشتیبانی‌نشده — GeoJSON، PMTiles یا KML انتخاب کنید.' };
}

export function kindLabel(kind?: string): string {
  if (!kind) return '—';
  if (kind.startsWith('raster_')) return kind.replace('raster_', '').toUpperCase();
  if (kind.startsWith('vector_')) return kind.replace('vector_', '').toUpperCase();
  if (kind.startsWith('streetview')) return 'Street View';
  return kind;
}
