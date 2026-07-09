// ============================================
// Holand Geo-Location Service
// Single backend: the map_explorer plugin via the API Gateway tool-runner.
// All geo data flows through POST /tools/map_explorer.<tool>/execute.
// No direct MongoDB / local Next.js /api/geo/* routes anymore.
// ============================================

import { runMapTool } from '@/services/map-tool-client';
import type {
  GeoFilter,
  AdvancedGeoFilter,
  GpsFilesResponse,
  GpsFile,
  GpsFileMinimal,
  GeoClusterResponse,
  MongoGeoStatsResponse,
  MongoGeoStats,
  SpatialWithinRequest,
  SpatialWithinResponse,
  TimelineResponse,
  TimeGranularity,
  MovementResponse,
  ExportFormat,
} from '@/types/geo-location.types';
import type { MapCatalogLayer, MapLayersListResponse } from '@/types/map-layers.types';
import type { LayerStackPrefs } from '@/types/map-layer-stack-prefs.types';
import {
  LAYER_STACK_SCHEMA_VERSION,
  LAYER_STACK_TOOL_ID,
} from '@/lib/map-layer-stack-contract';

type Row = Record<string, unknown>;

export interface MapLayerDetectResult {
  ok?: boolean;
  layer_kind?: string;
  storage_root?: string;
  source_url?: string;
  source_type?: string;
  data_available?: boolean;
  min_zoom?: number;
  max_zoom?: number;
  tile_ext?: string;
  sas_role?: 'satellite_imagery' | 'labels_overlay' | string;
  layer_count?: number;
  layers_under?: MapLayerDetectResult[];
  warnings?: string[];
  error?: string;
  id?: string;
}

export const MAP_LAYERS_IMPORT_SHARED = 'map_layers:import_shared';

// ==========================================
// Shape adapters (plugin flat rows â†’ UI types)
// ==========================================

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

function toGpsFile(row: Row): GpsFile {
  const lat = num(row.latitude) ?? num((row.gps as Row)?.latitude);
  const lng = num(row.longitude) ?? num((row.gps as Row)?.longitude);
  const gps =
    lat != null && lng != null
      ? {
          latitude: lat,
          longitude: lng,
          altitude: num(row.altitude),
          source: (row.location_source as string) || (row.source as string) || undefined,
        }
      : ((row.gps as GpsFile['gps']) ?? null);

  return {
    id: String(row.id ?? row.artifact_id ?? ''),
    path: String(row.path ?? row.file_path ?? ''),
    filename: String(row.filename ?? row.original_filename ?? ''),
    type: String(row.type ?? row.mime_type ?? ''),
    size: num(row.size) ?? num(row.size_bytes) ?? 0,
    size_formatted: row.size_formatted as string | undefined,
    case_id: (row.case_id as string) ?? undefined,
    volume_label: (row.volume_label as string) ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    gps,
    datetime: String(row.datetime ?? row.created_at ?? ''),
    timestamp: num(row.timestamp) ?? 0,
    camera: row.camera as string | undefined,
    thumbnail: row.thumbnail as string | undefined,
    faces_count: num(row.faces_count),
    width: num(row.width),
    height: num(row.height),
    format: row.format as string | undefined,
    metadata_stored_at: row.metadata_stored_at as string | undefined,
    tagged_at: row.tagged_at as string | undefined,
    origin: row.origin as GpsFile['origin'],
  };
}

function toMarker(row: Row): GpsFileMinimal {
  return {
    id: String(row.id ?? row.artifact_id ?? ''),
    lat: num(row.lat) ?? num(row.latitude) ?? 0,
    lng: num(row.lng) ?? num(row.longitude) ?? 0,
    type: String(row.type ?? row.mime_type ?? ''),
    case_id: (row.case_id as string) ?? undefined,
  };
}

function rowsOf(body: Row): Row[] {
  const candidate = body.files ?? body.items ?? body.markers ?? body.results;
  return Array.isArray(candidate) ? (candidate as Row[]) : [];
}

/** Storage /map/geo/stats (snake_case, minimal) â†’ UI MongoGeoStats (camelCase). */
function toMongoGeoStats(raw: Row): MongoGeoStats {
  const byMime = (raw.by_mime_type ?? raw.byMimeType) as Record<string, number> | undefined;
  const mimeFromMap = byMime
    ? Object.entries(byMime).map(([type, count]) => ({
        type,
        count: typeof count === 'number' ? count : Number(count) || 0,
      }))
    : [];
  const mimeTypes = Array.isArray(raw.mimeTypes)
    ? (raw.mimeTypes as MongoGeoStats['mimeTypes'])
    : Array.isArray(raw.mime_types)
      ? (raw.mime_types as MongoGeoStats['mimeTypes'])
      : mimeFromMap;

  const formats = Array.isArray(raw.formats)
    ? (raw.formats as MongoGeoStats['formats'])
    : mimeFromMap.map((m) => ({ format: m.type, count: m.count }));

  const dr = (raw.dateRange ?? raw.date_range) as Row | undefined;

  return {
    totalFiles: num(raw.totalFiles) ?? num(raw.total_files) ?? 0,
    withGps: num(raw.withGps) ?? num(raw.with_gps) ?? 0,
    withoutGps: num(raw.withoutGps) ?? num(raw.without_gps) ?? 0,
    cameras: Array.isArray(raw.cameras) ? (raw.cameras as MongoGeoStats['cameras']) : [],
    dateRange: {
      earliest: (dr?.earliest as string | null) ?? null,
      latest: (dr?.latest as string | null) ?? null,
    },
    formats,
    totalSize: num(raw.totalSize) ?? num(raw.total_size) ?? 0,
    avgSize: num(raw.avgSize) ?? num(raw.avg_size) ?? 0,
    mimeTypes,
    tags: Array.isArray(raw.tags) ? (raw.tags as MongoGeoStats['tags']) : [],
    cases: Array.isArray(raw.cases) ? (raw.cases as MongoGeoStats['cases']) : [],
    volumeLabels: Array.isArray(raw.volumeLabels)
      ? (raw.volumeLabels as MongoGeoStats['volumeLabels'])
      : Array.isArray(raw.volume_labels)
        ? (raw.volume_labels as MongoGeoStats['volumeLabels'])
        : [],
  };
}

function toFilesResponse(body: Row, minimal: boolean): GpsFilesResponse {
  const rows = rowsOf(body);
  const total = num(body.total) ?? rows.length;
  const page = num(body.page) ?? 1;
  const perPage = num(body.per_page) ?? num(body.page_size) ?? rows.length;
  return {
    success: true,
    total,
    page,
    per_page: perPage,
    returned: rows.length,
    files: minimal ? [] : rows.map(toGpsFile),
    markers: minimal ? rows.map(toMarker) : undefined,
  };
}

// ==========================================
// Detail cache (LRU, client-side)
// ==========================================
const DETAIL_CACHE_MAX = 200;
const detailCache = new Map<string, GpsFile>();

function getCachedDetail(id: string): GpsFile | null {
  const cached = detailCache.get(id);
  if (!cached) return null;
  detailCache.delete(id);
  detailCache.set(id, cached);
  return cached;
}

function cacheDetails(files: GpsFile[]): void {
  for (const f of files) detailCache.set(f.id, f);
  while (detailCache.size > DETAIL_CACHE_MAX) {
    const oldest = detailCache.keys().next().value;
    if (oldest) detailCache.delete(oldest);
  }
}

function applyFilterArgs(
  target: Record<string, unknown>,
  filters?: GeoFilter | Partial<AdvancedGeoFilter> | Record<string, unknown>
): void {
  if (!filters) return;
  const f = filters as Record<string, unknown>;
  if (f.date_start || f.dateStart) target.date_start = f.date_start || f.dateStart;
  if (f.date_end || f.dateEnd) target.date_end = f.date_end || f.dateEnd;
  if (Array.isArray(f.cameras) && f.cameras.length) target.cameras = f.cameras;
  if (Array.isArray(f.tags) && f.tags.length) target.tags = f.tags;
  if (Array.isArray(f.caseIds) && f.caseIds.length) target.case_ids = f.caseIds;
  if (Array.isArray(f.mimeTypes) && f.mimeTypes.length) target.mime_types = f.mimeTypes;
  if (Array.isArray(f.volumeLabels) && f.volumeLabels.length) target.volume_labels = f.volumeLabels;
  if (f.filenameSearch) target.filename = f.filenameSearch;
  if (f.hasThumbnail) target.has_thumbnail = true;
  if (f.metadataStoredStart) target.metadata_stored_start = f.metadataStoredStart;
  if (f.metadataStoredEnd) target.metadata_stored_end = f.metadataStoredEnd;
  if (f.taggedAtStart) target.tagged_at_start = f.taggedAtStart;
  if (f.taggedAtEnd) target.tagged_at_end = f.taggedAtEnd;
  if (f.thumbnailAtStart) target.thumbnail_at_start = f.thumbnailAtStart;
  if (f.thumbnailAtEnd) target.thumbnail_at_end = f.thumbnailAtEnd;
}

function base64ToBlob(b64: string, contentType: string): Blob {
  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

export const geoLocationService = {
  // ---- Files with GPS â†’ map_explorer.list ----
  async getFilesWithGps(
    filters?: GeoFilter | Partial<AdvancedGeoFilter> | Record<string, unknown>,
    page: number = 1,
    perPage: number = 100,
    hasGps: string = 'all',
    signal?: AbortSignal
  ): Promise<GpsFilesResponse> {
    const args: Record<string, unknown> = { page, page_size: perPage, has_gps: hasGps, fields: 'full' };
    applyFilterArgs(args, filters);
    const body = await runMapTool<Row>('list', args, signal);
    return toFilesResponse(body, false);
  },

  // ---- Minimal markers â†’ map_explorer.list (fields=minimal) ----
  async getMinimalMarkers(
    filters?: Partial<AdvancedGeoFilter> | Record<string, unknown>,
    page: number = 1,
    perPage: number = 2000,
    hasGps: string = 'true',
    signal?: AbortSignal
  ): Promise<GpsFilesResponse> {
    const args: Record<string, unknown> = { page, page_size: perPage, has_gps: hasGps, fields: 'minimal' };
    applyFilterArgs(args, filters);
    const body = await runMapTool<Row>('list', args, signal);
    return toFilesResponse(body, true);
  },

  // ---- File details â†’ map_explorer.details ----
  async getFileDetails(ids: string[], signal?: AbortSignal): Promise<GpsFile[]> {
    if (ids.length === 0) return [];

    const API_BATCH_SIZE = 2000;
    if (ids.length > API_BATCH_SIZE) {
      const allResults: GpsFile[] = [];
      for (let i = 0; i < ids.length; i += API_BATCH_SIZE) {
        if (signal?.aborted) break;
        const batch = await geoLocationService.getFileDetails(ids.slice(i, i + API_BATCH_SIZE), signal);
        allResults.push(...batch);
      }
      return allResults;
    }

    const cached: GpsFile[] = [];
    const uncachedIds: string[] = [];
    for (const id of ids) {
      const hit = getCachedDetail(id);
      if (hit) cached.push(hit);
      else uncachedIds.push(id);
    }
    if (uncachedIds.length === 0) return cached;

    const body = await runMapTool<Row>('details', { ids: uncachedIds }, signal);
    const rows = rowsOf(body);
    const fetched = rows.map(toGpsFile);
    cacheDetails(fetched);

    const detailMap = new Map([...cached, ...fetched].map((f) => [f.id, f]));
    return ids.map((id) => detailMap.get(id)).filter(Boolean) as GpsFile[];
  },

  // ---- Stats â†’ map_explorer.stats ----
  async getStats(
    filters?: {
      hasGps?: 'all' | 'true' | 'false';
      caseIds?: string[];
      mimeTypes?: string[];
      cameras?: string[];
      tags?: string[];
      volumeLabels?: string[];
    },
    signal?: AbortSignal
  ): Promise<MongoGeoStatsResponse> {
    const args: Record<string, unknown> = {};
    if (filters?.hasGps) args.has_gps = filters.hasGps;
    if (filters?.caseIds?.length) args.case_ids = filters.caseIds;
    if (filters?.mimeTypes?.length) args.mime_types = filters.mimeTypes;
    if (filters?.cameras?.length) args.cameras = filters.cameras;
    if (filters?.tags?.length) args.tags = filters.tags;
    if (filters?.volumeLabels?.length) args.volume_labels = filters.volumeLabels;

    const body = await runMapTool<Row>('stats', args, signal);
    const raw = (body.stats as Row) ?? body;
    return { success: true, stats: toMongoGeoStats(raw) };
  },

  // ---- Clustering (client-side DBSCAN, unchanged) ----
  clusterFilesLocal(
    files: Array<{ id: string; gps: { latitude: number; longitude: number } }>,
    clusterRadius: number = 100,
    minSize: number = 2
  ): GeoClusterResponse {
    const visited = new Set<number>();
    const clusters: GeoClusterResponse['clusters'] = [];
    const unclustered: string[] = [];

    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    for (let i = 0; i < files.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);
      const neighbors: number[] = [];
      for (let j = 0; j < files.length; j++) {
        if (i === j) continue;
        const dist = haversine(
          files[i].gps.latitude,
          files[i].gps.longitude,
          files[j].gps.latitude,
          files[j].gps.longitude
        );
        if (dist <= clusterRadius) neighbors.push(j);
      }
      if (neighbors.length + 1 >= minSize) {
        const clusterMembers = [i, ...neighbors];
        clusterMembers.forEach((idx) => visited.add(idx));
        const clusterFiles = clusterMembers.map((idx) => files[idx]);
        const avgLat = clusterFiles.reduce((s, f) => s + f.gps.latitude, 0) / clusterFiles.length;
        const avgLng = clusterFiles.reduce((s, f) => s + f.gps.longitude, 0) / clusterFiles.length;
        clusters.push({
          id: `cluster_${clusters.length}`,
          center: { latitude: avgLat, longitude: avgLng },
          file_ids: clusterFiles.map((f) => f.id),
          photos_count: clusterFiles.length,
          faces_count: 0,
          date_range: { start: 0, end: 0 },
          radius_meters: clusterRadius,
        });
      } else {
        unclustered.push(files[i].id);
      }
    }

    return {
      success: true,
      clusters,
      unclustered,
      stats: {
        total_files: files.length,
        total_clusters: clusters.length,
        single_locations: unclustered.length,
        avg_cluster_size: clusters.length > 0 ? Math.round(files.length / clusters.length) : 0,
      },
    };
  },

  // ---- Health â†’ map_explorer.stats ----
  async checkHealth(): Promise<boolean> {
    try {
      await runMapTool('stats', {});
      return true;
    } catch {
      return false;
    }
  },

  // ---- Spatial within â†’ map_explorer.within ----
  async spatialWithin(params: SpatialWithinRequest, signal?: AbortSignal): Promise<SpatialWithinResponse> {
    const fields = params.fields || 'minimal';
    const args: Record<string, unknown> = { fields, limit: params.limit ?? 5000 };
    if (params.bounds) args.bounds = params.bounds;
    if (params.center) args.center = params.center;
    if (params.radiusMeters != null) args.radius_meters = params.radiusMeters;

    const body = await runMapTool<Row>('within', args, signal);
    const rows = rowsOf(body);
    const total = num(body.count) ?? num(body.total) ?? rows.length;
    return {
      success: true,
      total,
      markers: fields === 'minimal' ? rows.map(toMarker) : undefined,
      files: fields === 'minimal' ? undefined : rows.map(toGpsFile),
    };
  },

  // ---- Timeline â†’ map_explorer.timeline ----
  async getTimeline(
    granularity: TimeGranularity = 'day',
    dateStart?: string,
    dateEnd?: string,
    caseIds?: string[],
    signal?: AbortSignal
  ): Promise<TimelineResponse> {
    const args: Record<string, unknown> = { granularity };
    if (dateStart) args.date_start = dateStart;
    if (dateEnd) args.date_end = dateEnd;
    if (caseIds?.length) args.case_ids = caseIds;
    const body = await runMapTool<Row>('timeline', args, signal);
    return {
      success: true,
      granularity: (body.granularity as TimeGranularity) || granularity,
      buckets: (body.buckets as TimelineResponse['buckets']) || [],
      summary:
        (body.summary as TimelineResponse['summary']) || {
          totalFiles: 0,
          totalBuckets: 0,
          dateRange: null,
        },
    };
  },

  // ---- Movement â†’ map_explorer.movement ----
  async getMovement(
    options?: { caseIds?: string[]; stopRadius?: number; stopMinFiles?: number; limit?: number },
    signal?: AbortSignal
  ): Promise<MovementResponse> {
    const args: Record<string, unknown> = {};
    if (options?.caseIds?.length) args.case_ids = options.caseIds;
    if (options?.stopRadius) args.stop_radius = options.stopRadius;
    if (options?.stopMinFiles) args.stop_min_files = options.stopMinFiles;
    if (options?.limit) args.limit = options.limit;
    const body = await runMapTool<Row>('movement', args, signal);
    return {
      success: true,
      stops: (body.stops as MovementResponse['stops']) || [],
      route: (body.route as MovementResponse['route']) || [],
      segments: body.segments as MovementResponse['segments'],
      summary:
        (body.summary as MovementResponse['summary']) || {
          totalFiles: 0,
          totalStops: 0,
          totalDistanceMeters: 0,
          totalDistanceKm: 0,
          timeSpanSeconds: 0,
          avgSpeedKmh: 0,
          dateRange: { start: '', end: '' },
        },
    };
  },

  // ---- Export â†’ map_explorer.export (base64 â†’ Blob) ----
  async exportFiles(
    ids?: string[],
    format: ExportFormat = 'csv',
    includeAll: boolean = false
  ): Promise<Blob> {
    const args: Record<string, unknown> = { format, include_all: includeAll };
    if (!includeAll) args.ids = ids ?? [];
    const body = await runMapTool<Row>('export', args);
    const b64 = body.content_base64 as string | undefined;
    const ct =
      (body.content_type as string) ||
      (format === 'json' ? 'application/json' : format === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'text/csv');
    if (b64) return base64ToBlob(b64, ct);
    // Fallback: storage returned JSON rows instead of a binary blob
    return new Blob([JSON.stringify(body)], { type: 'application/json' });
  },

  // ---- Single-file metadata download â†’ details + client-side JSON blob ----
  async downloadFileMetadata(id: string): Promise<Blob> {
    const files = await geoLocationService.getFileDetails([id]);
    const data = files[0] ?? { id };
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  },

  // ---- Reverse geocoding â†’ map_explorer.reverse_geocode (map-py) ----
  async reverseGeocode(
    coordinates: Array<{ lat: number; lng: number }>,
    signal?: AbortSignal
  ): Promise<{ success: boolean; results: Array<Record<string, unknown>> }> {
    if (!coordinates.length) return { success: true, results: [] };
    const body = await runMapTool<Row>('reverse_geocode', { coordinates }, signal);
    const results = (body.results as Array<Record<string, unknown>>) ?? [];
    return { success: body.success !== false, results };
  },

  // ---- Street-view directory browse â†’ map_explorer.streetview_browse ----
  async streetviewBrowse(path?: string, signal?: AbortSignal): Promise<Row> {
    const args: Record<string, unknown> = {};
    if (path) args.path = path;
    return runMapTool<Row>('streetview_browse', args, signal);
  },

  // ---- Street-view panoramas â†’ map_explorer.streetview_panoramas ----
  /** Load street-view panoramas for a folder or catalog layer id. */
  async streetviewPanoramas(
    folder?: string,
    layerId?: string,
    signal?: AbortSignal
  ): Promise<{ panoramas: Row[]; layerId?: string }> {
    const args: Record<string, unknown> = {};
    if (layerId) args.layer_id = layerId;
    else if (folder) args.folder = folder;
    const body = await runMapTool<Row>('streetview_panoramas', args, signal);
    const list = body.panoramas ?? body.items ?? body.results ?? body;
    const panoramas = Array.isArray(list) ? (list as Row[]) : [];
    const lid =
      typeof body.layer_id === 'string'
        ? body.layer_id
        : typeof body.layerId === 'string'
          ? body.layerId
          : undefined;
    return { panoramas, layerId: lid };
  },

  // ---- Satellite raster layer config â†’ map_explorer.sat_tile_config ----
  async satTileConfig(path?: string, signal?: AbortSignal): Promise<Row> {
    const args: Record<string, unknown> = {};
    if (path) args.path = path;
    return runMapTool<Row>('sat_tile_config', args, signal);
  },

  // ---- Vector basemap (PMTiles) â†’ map_explorer.basemap_config ----
  async basemapConfig(
    options?: { path?: string; layer_id?: string; name?: string },
    signal?: AbortSignal
  ): Promise<Row> {
    const args: Record<string, unknown> = {};
    if (options?.path) args.path = options.path;
    if (options?.layer_id) args.layer_id = options.layer_id;
    if (options?.name) args.name = options.name;
    return runMapTool<Row>('basemap_config', args, signal);
  },

  // ---- Map catalog layers (Storage /map/layers via map_explorer) ----
  async listMapLayers(
    options?: { layer_kind?: string; limit?: number; offset?: number },
    signal?: AbortSignal
  ): Promise<MapLayersListResponse> {
    const args: Record<string, unknown> = {
      limit: options?.limit ?? 200,
      offset: options?.offset ?? 0,
    };
    if (options?.layer_kind) args.layer_kind = options.layer_kind;
    const body = await runMapTool<Row>('layers_list', args, signal);
    const items = (body.items as MapCatalogLayer[]) ?? [];
    return {
      items,
      total_count: num(body.total_count) ?? items.length,
      limit: num(body.limit) ?? args.limit as number,
      offset: num(body.offset) ?? args.offset as number,
    };
  },

  async detectMapLayer(path: string, signal?: AbortSignal): Promise<MapLayerDetectResult> {
    return runMapTool<MapLayerDetectResult>('layers_detect', { path }, signal);
  },

  async detectMapLayerUrl(url: string, signal?: AbortSignal): Promise<MapLayerDetectResult> {
    return runMapTool<MapLayerDetectResult>('layers_detect_url', { url }, signal);
  },

  async browseMapLayers(path?: string, signal?: AbortSignal): Promise<Row> {
    const args: Record<string, unknown> = {};
    if (path?.trim()) args.path = path.trim();
    return runMapTool<Row>('layers_browse', args, signal);
  },

  async importMapLayer(
    path: string,
    options?: { name?: string; layer_kind?: string },
    signal?: AbortSignal
  ): Promise<Row> {
    const args: Record<string, unknown> = { path };
    if (options?.name) args.name = options.name;
    if (options?.layer_kind) args.layer_kind = options.layer_kind;
    return runMapTool<Row>('layers_import', args, signal);
  },

  async registerMapLayer(
    payload: {
      name: string;
      layer_kind: string;
      storage_root?: string;
      source_url?: string;
      source_type?: string;
    },
    signal?: AbortSignal
  ): Promise<Row> {
    return runMapTool<Row>('layers_register', payload, signal);
  },

  async removeMapLayer(
    layerId: string,
    purgeData = false,
    signal?: AbortSignal
  ): Promise<Row> {
    return runMapTool<Row>('layers_remove', { layer_id: layerId, purge_data: purgeData }, signal);
  },

  // ---- Per-user layers panel preferences (order / opacity / visibility) ----
  async getLayerStackPrefs(signal?: AbortSignal): Promise<LayerStackPrefs> {
    const body = await runMapTool<Row>(LAYER_STACK_TOOL_ID, {}, signal);
    return normalizeLayerStackPrefs(body);
  },

  async saveLayerStackPrefs(
    prefs: LayerStackPrefs,
    signal?: AbortSignal
  ): Promise<LayerStackPrefs> {
    const body = await runMapTool<Row>(
      LAYER_STACK_TOOL_ID,
      { prefs, schema_version: prefs.version ?? LAYER_STACK_SCHEMA_VERSION },
      signal
    );
    return normalizeLayerStackPrefs(body);
  },
};

function normalizeLayerStackPrefs(body: Row): LayerStackPrefs {
  const order = Array.isArray(body.order) ? (body.order as string[]) : [];
  const layers =
    body.layers && typeof body.layers === 'object'
      ? (body.layers as LayerStackPrefs['layers'])
      : {};
  const version =
    typeof body.version === 'number' ? body.version : LAYER_STACK_SCHEMA_VERSION;
  return { version, order, layers };
}

