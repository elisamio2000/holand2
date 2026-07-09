// Normalize Storage street-view panorama rows for map UI.

import { MAP_STORAGE_PROXY } from '@/lib/map-storage-url';
import type { StreetViewPanorama } from '@/app/(hydrogen)/geo-location/components/panorama-viewer';

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function isValidLatLon(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function catalogStreetviewImageUrl(layerId: string, relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, '');
  return `${MAP_STORAGE_PROXY}/map/streetview/${encodeURIComponent(layerId)}/${rel
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}`;
}

/** Map Storage /map/streetview/panoramas row → UI model; null when coords missing. */
export function normalizeStreetViewPanorama(
  raw: Record<string, unknown>,
  layerId?: string
): StreetViewPanorama | null {
  const lat = num(raw.lat) ?? num(raw.latitude);
  const lon = num(raw.lon) ?? num(raw.longitude) ?? num(raw.lng);
  if (lat == null || lon == null || !isValidLatLon(lat, lon)) return null;

  const filename = String(raw.filename ?? '');
  const relativePath = String(raw.relative_path ?? filename);
  const id = String(raw.id ?? relativePath ?? filename);
  const meta =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};

  const northOffsetDeg =
    num(raw.northOffsetDeg) ??
    num(meta.northOffsetDeg) ??
    num(meta.north_offset_deg) ??
    num(meta.north_offset);

  let image: string | undefined;
  const imageRaw = raw.image ?? meta.image ?? meta.image_url;
  if (typeof imageRaw === 'string' && imageRaw.trim()) {
    image = imageRaw.trim();
  } else if (layerId && meta.equirectangular) {
    image = catalogStreetviewImageUrl(layerId, relativePath);
  }

  const headingsRaw = raw.headings;
  let headings: StreetViewPanorama['headings'] = [];

  if (Array.isArray(headingsRaw) && headingsRaw.length > 0) {
    headings = headingsRaw
      .map((entry, idx) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const h = entry as Record<string, unknown>;
          const heading = num(h.heading) ?? num(h.bearing) ?? idx * 90;
          const fn = String(h.filename ?? filename);
          const rel = String(h.relative_path ?? h.path ?? relativePath);
          const url =
            typeof h.url === 'string' && h.url.trim()
              ? h.url.trim()
              : layerId
                ? catalogStreetviewImageUrl(layerId, rel)
                : '';
          if (!url) return null;
          return { heading, url, filename: fn };
        }
        const heading = num(entry) ?? idx * 90;
        if (!layerId) return null;
        return {
          heading,
          url: catalogStreetviewImageUrl(layerId, relativePath),
          filename,
        };
      })
      .filter((h): h is StreetViewPanorama['headings'][number] => h != null);
  }

  if (!headings.length && layerId && relativePath) {
    headings = [
      {
        heading: 0,
        url: catalogStreetviewImageUrl(layerId, relativePath),
        filename: filename || relativePath.split('/').pop() || 'pano.jpg',
      },
    ];
  }

  return {
    id,
    lat,
    lon,
    headings,
    ...(image ? { image } : {}),
    ...(northOffsetDeg != null ? { northOffsetDeg } : {}),
  };
}

export function normalizeStreetViewPanoramas(
  rows: unknown[],
  layerId?: string
): StreetViewPanorama[] {
  const out: StreetViewPanorama[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const pano = normalizeStreetViewPanorama(row as Record<string, unknown>, layerId);
    if (pano) out.push(pano);
  }
  return out;
}
