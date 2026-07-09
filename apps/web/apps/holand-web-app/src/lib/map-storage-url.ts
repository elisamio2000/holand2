// Client-side URLs for Storage map tile / asset routes (proxied via Next.js).

/** Prefix for authenticated proxy to Storage /map/* routes */
export const MAP_STORAGE_PROXY = '/api/map-storage';

/** SAS sqlite cache role inferred server-side from tile bytes (not folder names). */
export type SasTileRole = 'satellite_imagery' | 'labels_overlay';

/** XYZ raster tile template for a catalog layer id */
export function catalogLayerTileUrl(layerId: string, ext = 'jpg'): string {
  return `${MAP_STORAGE_PROXY}/map/tiles/${layerId}/{z}/{x}/{y}.${ext}`;
}

/** TileJSON for a catalog layer */
export function catalogLayerTileJsonUrl(layerId: string): string {
  return `${MAP_STORAGE_PROXY}/map/layers/${layerId}/tilejson`;
}

/** Load raster zoom cap from Storage tilejson (SAS sqlite layers). */
export async function fetchCatalogRasterMaxZoom(layerId: string): Promise<number | undefined> {
  try {
    const res = await fetch(catalogLayerTileJsonUrl(layerId), { credentials: 'include' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { maxzoom?: number };
    return typeof body.maxzoom === 'number' ? body.maxzoom : undefined;
  } catch {
    return undefined;
  }
}

/** PMTiles archive URL for a catalog layer (Range requests supported) */
export function catalogLayerPmtilesUrl(layerId: string, filename?: string): string {
  const base = `${MAP_STORAGE_PROXY}/map/layers/${layerId}/pmtiles`;
  if (!filename?.trim()) return base;
  return `${base}/${encodeURIComponent(filename.trim())}`;
}

export type PmtilesStyleUrls = {
  main: string;
  world?: string;
  worldFull?: string;
};

/** @deprecated use PmtilesStyleUrls */
export type BasemapTileUrls = PmtilesStyleUrls;

/** Build PMTiles style URLs from Storage pmtiles-style payload. */
export function pmtilesStyleUrlsFromPayload(
  layerId: string,
  cfg: Record<string, unknown> | null | undefined
): PmtilesStyleUrls {
  const mainFile =
    typeof cfg?.pmtiles_file === 'string' ? cfg.pmtiles_file : undefined;
  const main = catalogLayerPmtilesUrl(layerId, mainFile);
  if (!cfg) return { main };
  const worldFile =
    typeof cfg.world_overview_file === 'string' ? cfg.world_overview_file : undefined;
  const worldFullFile =
    typeof cfg.world_full_file === 'string' ? cfg.world_full_file : undefined;
  return {
    main,
    world: worldFile ? catalogLayerPmtilesUrl(layerId, worldFile) : undefined,
    worldFull: worldFullFile ? catalogLayerPmtilesUrl(layerId, worldFullFile) : undefined,
  };
}

/** @deprecated use pmtilesStyleUrlsFromPayload */
export function basemapUrlsFromConfig(
  layerId: string,
  cfg: Record<string, unknown> | null | undefined
): PmtilesStyleUrls {
  return pmtilesStyleUrlsFromPayload(layerId, cfg);
}

/** Build style URLs from a catalog row (source_config + layer id). */
export function pmtilesStyleUrlsFromCatalogLayer(layer: {
  id: string;
  source_config?: Record<string, unknown> | null;
}): PmtilesStyleUrls {
  const sc = layer.source_config ?? {};
  return pmtilesStyleUrlsFromPayload(layer.id, {
    pmtiles_file: sc.pmtiles_file,
    world_overview_file: sc.world_overview_file,
    world_full_file: sc.world_full_file,
  });
}

/** Fetch read-only PMTiles bundle URLs for map style (no user basemap DB). */
export async function fetchPmtilesStyleUrls(
  layerId: string,
  catalogLayer?: { id: string; source_config?: Record<string, unknown> | null }
): Promise<PmtilesStyleUrls> {
  const fallback = catalogLayer
    ? pmtilesStyleUrlsFromCatalogLayer(catalogLayer)
    : { main: catalogLayerPmtilesUrl(layerId) };
  try {
    const res = await fetch(`${MAP_STORAGE_PROXY}/map/layers/${layerId}/pmtiles-style`, {
      credentials: 'include',
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as Record<string, unknown>;
    return pmtilesStyleUrlsFromPayload(layerId, body);
  } catch {
    return fallback;
  }
}

export function isPmtilesCatalogKind(kind: string | undefined): boolean {
  return kind === 'vector_pmtiles' || kind === 'raster_pmtiles';
}

/** @deprecated use isPmtilesCatalogKind */
export function isBasemapCatalogKind(kind: string | undefined): boolean {
  return isPmtilesCatalogKind(kind);
}

/** XYZ / SAS sqlite rasters served via /map/tiles/{id}/{z}/{x}/{y} — not PMTiles/MBTiles. */
export function isXyzRasterCatalogKind(kind: string | undefined): boolean {
  if (!kind || !kind.startsWith('raster_')) return false;
  return kind === 'raster_sas_sqlite' || kind === 'raster_sas' || kind === 'raster_xyz';
}

export function isRasterCatalogKind(kind: string | undefined): boolean {
  return isXyzRasterCatalogKind(kind);
}

export function isStreetviewCatalogKind(kind: string | undefined): boolean {
  return Boolean(kind && kind.startsWith('streetview'));
}

type SasCatalogLayer = {
  layer_kind?: string;
  storage_root?: string | null;
  source_config?: { tile_ext?: string; sas_role?: string } | null;
  /** Populated by Storage list/get when source_config lacks sas_role. */
  sas_role?: SasTileRole | string | null;
  tile_ext?: string | null;
};

/** Role from detect/import or live enrichment on list — never from folder name. */
export function getSasTileRole(layer: SasCatalogLayer): SasTileRole | undefined {
  const raw =
    layer.sas_role ??
    layer.source_config?.sas_role;
  if (raw === 'satellite_imagery' || raw === 'labels_overlay') return raw;
  return undefined;
}

export function isSasSqliteCatalogLayer(layer: SasCatalogLayer): boolean {
  return layer.layer_kind === 'raster_sas_sqlite' || layer.layer_kind === 'raster_sas';
}

export function isSasSatelliteCatalogLayer(layer: SasCatalogLayer): boolean {
  return isSasSqliteCatalogLayer(layer) && getSasTileRole(layer) === 'satellite_imagery';
}

export function isSasLabelsCatalogLayer(layer: SasCatalogLayer): boolean {
  return isSasSqliteCatalogLayer(layer) && getSasTileRole(layer) === 'labels_overlay';
}

export function isSasHybridCatalogLayer(layer: SasCatalogLayer): boolean {
  return isSasSatelliteCatalogLayer(layer) || isSasLabelsCatalogLayer(layer);
}

/** Map stack role derived from catalog metadata — never from folder names. */
export type CatalogStackRole = 'pmtiles' | 'imagery' | 'labels' | 'overlay' | 'streetview';

export function catalogStackRole(layer: SasCatalogLayer & { layer_kind?: string }): CatalogStackRole {
  if (isPmtilesCatalogKind(layer.layer_kind)) return 'pmtiles';
  if (isSasSatelliteCatalogLayer(layer)) return 'imagery';
  if (isSasLabelsCatalogLayer(layer)) return 'labels';
  if (isStreetviewCatalogKind(layer.layer_kind)) return 'streetview';
  if (isRasterCatalogKind(layer.layer_kind)) return 'overlay';
  return 'overlay';
}

/** Higher rank = higher on map = earlier in top-first panel order. */
const STACK_ROLE_RANK: Record<CatalogStackRole, number> = {
  labels: 50,
  streetview: 40,
  overlay: 30,
  pmtiles: 20,
  imagery: 10,
};

export function catalogStackRank(layer: SasCatalogLayer & { layer_kind?: string }): number {
  return STACK_ROLE_RANK[catalogStackRole(layer)] ?? 0;
}

export function compareCatalogStackOrder(
  a: SasCatalogLayer & { layer_kind?: string; sort_order?: number },
  b: SasCatalogLayer & { layer_kind?: string; sort_order?: number }
): number {
  const roleDiff = catalogStackRank(b) - catalogStackRank(a);
  if (roleDiff !== 0) return roleDiff;
  return (b.sort_order ?? 0) - (a.sort_order ?? 0);
}

/** Tile URL extension from Storage detect/enrichment — role-based fallback only. */
export function catalogLayerTileExt(layer: SasCatalogLayer): string {
  const ext = layer.tile_ext ?? layer.source_config?.tile_ext;
  if (typeof ext === 'string' && ext) return ext.replace(/^\./, '');
  const role = getSasTileRole(layer);
  if (role === 'labels_overlay') return 'png';
  if (role === 'satellite_imagery') return 'jpg';
  return 'jpg';
}
