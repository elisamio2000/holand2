// ============================================
// Geo-Location Types
// TypeScript interfaces for geo-location analysis
// Data source: map_explorer plugin → Storage (in-project Postgres + Mongo)
// ============================================

/**
 * GPS coordinates from file EXIF metadata.
 */
export interface GpsCoordinates {
  /** Latitude in decimal degrees (-90 to 90) */
  latitude: number;
  /** Longitude in decimal degrees (-180 to 180) */
  longitude: number;
  /** Altitude in meters above sea level */
  altitude?: number;
  /** GPS accuracy in meters */
  accuracy?: number;
  /** GPS reference (WGS84, etc.) */
  ref?: string;
  /** Source of GPS data (exif, manual, etc.) */
  source?: string;
}

/**
 * Lightweight marker record for map rendering (Tier 1).
 * Returned by GET /api/geo/files?fields=minimal endpoint.
 *
 * WHY minimal: With 100K+ records, full GpsFile (~1KB/record = 100MB)
 * is too heavy for initial map load. Minimal records (~60B/record = 6MB)
 * are 17× lighter. Full details are fetched on-demand via Tier 2.
 */
export interface GpsFileMinimal {
  /** MongoDB _id */
  id: string;
  /** Latitude in decimal degrees */
  lat: number;
  /** Longitude in decimal degrees */
  lng: number;
  /** MIME type — drives marker color (image/video/audio) */
  type: string;
  /** Parent case/folder ID — used for case-based grouping and coloring */
  case_id?: string;
}

/**
 * Response from POST /api/geo/files/details endpoint.
 * Returns full GpsFile records for a batch of IDs.
 */
export interface GpsFileDetailsResponse {
  success: boolean;
  files: GpsFile[];
}

/**
 * File with GPS data for map display.
 * Returned by GET /api/geo/files endpoint (MongoDB).
 */
export interface GpsFile {
  /** Unique file identifier (MongoDB _id) */
  id: string;
  /** Full file path */
  path: string;
  /** Filename only */
  filename: string;
  /** MIME type (image/jpeg, etc.) */
  type: string;
  /** File size in bytes */
  size: number;
  /** Formatted file size (e.g. "877.4 KB") */
  size_formatted?: string;
  /** Associated case ID */
  case_id?: string;
  /** Disk/volume label (from MongoDB volume.label) */
  volume_label?: string;
  /** File tags */
  tags: string[];
  /** GPS coordinates (null if no GPS) */
  gps: GpsCoordinates | null;
  /** Date taken (ISO string) */
  datetime: string;
  /** Unix timestamp */
  timestamp: number;
  /** Camera make/model */
  camera?: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Number of faces detected */
  faces_count?: number;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Image format (JPEG, PNG, etc.) */
  format?: string;
  /** When metadata analysis was stored (ISO string) */
  metadata_stored_at?: string;
  /** When the file was tagged (ISO string) */
  tagged_at?: string;
  /** Origin device info */
  origin?: {
    hostname: string;
    ip: string;
    os: string;
  };
}

/**
 * Cluster of files in geographic proximity.
 * Returned by POST /geo/cluster endpoint.
 */
export interface GpsCluster {
  /** Cluster identifier */
  id: string;
  /** Center point of cluster */
  center: GpsCoordinates;
  /** IDs of files in cluster */
  file_ids: string[];
  /** Number of photos in cluster */
  photos_count: number;
  /** Total faces across all files */
  faces_count: number;
  /** Date range of files in cluster */
  date_range: {
    start: number;
    end: number;
  };
  /** Approximate radius in meters */
  radius_meters: number;
}

/**
 * Reverse geocoded address.
 * Returned by POST /geo/reverse-geocode endpoint.
 */
export interface GeoAddress {
  /** Country name */
  country: string;
  /** ISO country code (IR, US, etc.) */
  country_code: string;
  /** State/province name */
  state: string;
  /** City name */
  city: string;
  /** District/region */
  district?: string;
  /** Neighbourhood name */
  neighbourhood?: string;
  /** Street/road name */
  road?: string;
  /** Postal code */
  postcode?: string;
  /** Full formatted address */
  display_name: string;
}

/**
 * Filter options for files with GPS data.
 */
export interface GeoFilter {
  /** Filter by case ID */
  case_id?: string;
  /** Filter by tags (OR logic) */
  tags?: string[];
  /** Filter by file types (image/jpeg, etc.) */
  types?: string[];
  /** Start date filter (ISO string) */
  date_start?: string;
  /** End date filter (ISO string) */
  date_end?: string;
  /** Filter by camera make/model */
  camera?: string;
  /** Bounding box filter */
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * Response from GET /api/geo/files endpoint (MongoDB).
 * When fields=minimal, returns GpsFileMinimal[] in `markers` field.
 * When fields=full (default), returns GpsFile[] in `files` field.
 */
export interface GpsFilesResponse {
  /** Success status */
  success: boolean;
  /** Total number of files matching filter */
  total: number;
  /** Page number */
  page: number;
  /** Items per page */
  per_page: number;
  /** Raw document count fetched from DB (before post-processing filters) */
  returned?: number;
  /** Files with GPS data (full records, when fields=full) */
  files: GpsFile[];
  /** Lightweight marker records (when fields=minimal) */
  markers?: GpsFileMinimal[];
  /** All files (when has_gps=all) */
  all_files?: GpsFile[];
  /** Files without GPS (when has_gps=all) */
  non_gps_files?: GpsFile[];
  /** Summary stats */
  stats?: {
    total_files: number;
    with_gps: number;
    without_gps: number;
    cameras: string[];
  };
}

/**
 * Response from POST /geo/cluster endpoint.
 */
export interface GeoClusterResponse {
  /** Success status */
  success: boolean;
  /** Generated clusters */
  clusters: GpsCluster[];
  /** Files not in any cluster */
  unclustered: string[];
  /** Clustering statistics */
  stats: {
    total_files: number;
    total_clusters: number;
    single_locations: number;
    avg_cluster_size: number;
  };
}

/**
 * Response from POST /geo/reverse-geocode endpoint.
 */
export interface GeoReverseGeocodeResponse {
  /** Success status */
  success: boolean;
  /** Resolved address */
  address: GeoAddress;
  /** Location type (residential, commercial, etc.) */
  type?: string;
  /** Result importance score */
  importance?: number;
  /** Whether result was cached */
  cached?: boolean;
}

/**
 * Statistics for geo-location display.
 */
export interface GeoStats {
  /** Total files with GPS */
  totalFiles: number;
  /** Number of clusters */
  totalClusters: number;
  /** Unique locations */
  uniqueLocations: number;
  /** Date range string */
  dateRange: string;
  /** Countries represented */
  countries: string[];
}

/**
 * Map view state for persistence.
 */
export interface MapViewState {
  /** Current center coordinates */
  center: [number, number];
  /** Current zoom level */
  zoom: number;
  /** Active style (light/dark/satellite) */
  style: 'light' | 'dark' | 'satellite';
  /** Show clusters or individual markers */
  clustering: boolean;
  /** Show heatmap layer */
  heatmap: boolean;
}

/**
 * Marker for map display.
 */
export interface GeoMarker {
  /** Unique marker ID */
  id: string;
  /** Position [lng, lat] */
  position: [number, number];
  /** Marker type */
  type: 'single' | 'cluster';
  /** Number of items (for clusters) */
  count?: number;
  /** Associated file data */
  file?: GpsFile;
  /** Associated cluster data */
  cluster?: GpsCluster;
}

// ==========================================
// MongoDB Stats Types
// ==========================================

/**
 * Camera breakdown from MongoDB aggregation.
 */
export interface CameraStats {
  /** Camera name (make + model) */
  name: string;
  /** Number of files from this camera */
  count: number;
}

/**
 * Aggregated statistics from MongoDB.
 * Returned by GET /api/geo/stats endpoint.
 */
export interface MongoGeoStats {
  /** Total files in collection */
  totalFiles: number;
  /** Files with GPS coordinates */
  withGps: number;
  /** Files without GPS */
  withoutGps: number;
  /** Camera breakdown */
  cameras: CameraStats[];
  /** Date range of files */
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  /** Format breakdown */
  formats: Array<{ format: string; count: number }>;
  /** Total storage size in bytes */
  totalSize: number;
  /** Average file size in bytes */
  avgSize: number;
  /** Tag breakdown — distinct tags with counts */
  tags?: Array<{ name: string; count: number }>;
  /** MIME type breakdown — for filtering (matches file_meta.mime_type field) */
  mimeTypes?: Array<{ type: string; count: number }>;
  /** Case ID breakdown — distinct case_ids with file counts */
  cases?: Array<{ id: string; count: number }>;
  /** Volume/disk label breakdown — distinct volume.label values with file counts */
  volumeLabels?: Array<{ label: string; count: number }>;
}

/**
 * Response from GET /api/geo/stats endpoint.
 */
export interface MongoGeoStatsResponse {
  success: boolean;
  stats: MongoGeoStats;
}

// ==========================================
// Multi-Select Types
// ==========================================

/**
 * Summary of a multi-file selection on the map.
 * Computed when 2+ markers are selected.
 */
export interface SelectionSummary {
  /** IDs of all selected files */
  fileIds: string[];
  /** Count of selected files */
  count: number;
  /** File type breakdown (e.g. { "image/jpeg": 3, "image/png": 1 }) */
  typeBreakdown: Record<string, number>;
  /** Case ID breakdown (e.g. { "case_abc": 5, "case_def": 3 }) */
  caseBreakdown: Record<string, number>;
  /** Total size of selected files in bytes */
  totalSize: number;
  /** GPS bounding box (only for files with GPS) */
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  /** Date range of selected files */
  dateRange?: {
    earliest: string;
    latest: string;
  };
}

/**
 * Selection tool mode for the map.
 * - pointer: single click, Ctrl/Shift+click for multi-select, Shift+Drag for box-select
 * - box:     always-on drag-to-select rectangle
 * - path:    freehand lasso polygon — draw any shape to select all points inside it
 */
export type SelectionMode = 'pointer' | 'box' | 'path';

// ==========================================
// Advanced Filter Types
// ==========================================

/**
 * Extended filter options with DB-field-based filters.
 * Used by the advanced filter panel to query /api/geo/files.
 */
export interface AdvancedGeoFilter {
  /** GPS status filter */
  hasGps: 'all' | 'true' | 'false';
  /** MIME type filter (multi-select) */
  mimeTypes: string[];
  /** Camera model filter (multi-select) */
  cameras?: string[];
  /** EXIF date range start (ISO string) — filters file_meta.metadata.image.exif_clean.DateTime */
  dateStart?: string;
  /** EXIF date range end (ISO string) */
  dateEnd?: string;
  /** Filename search (partial match) */
  filenameSearch?: string;
  /** Volume/disk label filter (multi-select) — filters volume.label ($in) */
  volumeLabels?: string[];
  /** Tag filter (multi-select, OR logic) */
  tags?: string[];
  /** Case ID filter (multi-select, OR logic) */
  caseIds?: string[];
  /** If true, only show files that have a real thumbnail stored in MongoDB */
  hasThumbnail?: boolean;
  /** metadata_stored_at range start — when metadata analysis ran */
  metadataStoredStart?: string;
  /** metadata_stored_at range end */
  metadataStoredEnd?: string;
  /** tagged_at range start — when the file was tagged */
  taggedAtStart?: string;
  /** tagged_at range end */
  taggedAtEnd?: string;
  /** thumbnail_at range start — when the thumbnail was generated */
  thumbnailAtStart?: string;
  /** thumbnail_at range end */
  thumbnailAtEnd?: string;
}

/**
 * Default/empty advanced filter state.
 */
// WHY hasGps defaults to 'true': Showing only GPS files on first load
// reduces payload size and gives an immediately useful map view.
// Users can switch to 'all' from the filter panel.
export const DEFAULT_ADVANCED_FILTER: AdvancedGeoFilter = {
  hasGps: 'true',
  mimeTypes: [],
  cameras: [],
  tags: [],
  caseIds: [],
  volumeLabels: [],
  hasThumbnail: false,
};

// ==========================================
// Spatial Query Types
// ==========================================

/**
 * Request body for POST /api/geo/spatial/within.
 * Supports bounding box or radius-based spatial queries.
 */
export interface SpatialWithinRequest {
  /** Bounding box (alternative to center+radius) */
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  /** Center point for radius mode */
  center?: { lat: number; lng: number };
  /** Search radius in meters (used with center) */
  radiusMeters?: number;
  /** "minimal" or "full" (default: "minimal") */
  fields?: string;
  /** Max results (default: 5000, max: 50000) */
  limit?: number;
}

/**
 * Response from POST /api/geo/spatial/within.
 */
export interface SpatialWithinResponse {
  success: boolean;
  total: number;
  markers?: GpsFileMinimal[];
  files?: GpsFile[];
}

// ==========================================
// Timeline Analysis Types
// ==========================================

/** Time grouping granularity for timeline analysis */
export type TimeGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * A single time bucket in the timeline.
 * Returned by GET /api/geo/analysis/timeline.
 */
export interface TimelineBucket {
  /** Time bucket key (e.g. "2025:10:13" for day granularity) */
  key: string;
  /** Number of files in this bucket */
  count: number;
  /** Cameras that captured files in this bucket */
  cameras: string[];
  /** Case IDs represented in this bucket */
  cases: string[];
  /** Average GPS center of files in this bucket */
  center: { lat: number; lng: number };
  /** GPS bounding box of files in this bucket */
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * Response from GET /api/geo/analysis/timeline.
 */
export interface TimelineResponse {
  success: boolean;
  granularity: TimeGranularity;
  buckets: TimelineBucket[];
  summary: {
    totalFiles: number;
    totalBuckets: number;
    dateRange: { start: string; end: string } | null;
  };
}

// ==========================================
// Movement/Journey Detection Types
// ==========================================

/**
 * A detected stop — a cluster of consecutive GPS-tagged files
 * within a geographic radius, indicating the subject stayed in one place.
 */
export interface DetectedStop {
  /** Stop identifier */
  id: string;
  /** Average center of files at this stop */
  center: { lat: number; lng: number };
  /** Maximum distance from center in meters */
  radiusMeters: number;
  /** IDs of files at this stop */
  fileIds: string[];
  /** Number of files at this stop */
  fileCount: number;
  /** Time range of files at this stop */
  dateRange: { start: string; end: string };
  /** Duration of stop in seconds */
  durationSeconds: number;
}

/**
 * A point in the movement route.
 */
export interface RoutePoint {
  /** GPS latitude */
  lat: number;
  /** GPS longitude */
  lng: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** File ID */
  id: string;
}

/**
 * A segment between two consecutive GPS points.
 */
export interface RouteSegment {
  /** Source file ID */
  from: string;
  /** Destination file ID */
  to: string;
  /** Source coordinates */
  fromCoord: { lat: number; lng: number };
  /** Destination coordinates */
  toCoord: { lat: number; lng: number };
  /** Distance in meters */
  distanceMeters: number;
  /** Time delta in seconds */
  timeDeltaSeconds: number;
  /** Estimated speed in km/h */
  speedKmh: number;
}

/**
 * Response from GET /api/geo/analysis/movement.
 */
export interface MovementResponse {
  success: boolean;
  /** Detected stops (places where the subject stayed) */
  stops: DetectedStop[];
  /** Ordered GPS trail for route rendering */
  route: RoutePoint[];
  /** Segments between consecutive points (omitted if >5000) */
  segments?: RouteSegment[];
  /** Summary statistics */
  summary: {
    totalFiles: number;
    totalStops: number;
    totalDistanceMeters: number;
    totalDistanceKm: number;
    timeSpanSeconds: number;
    avgSpeedKmh: number;
    dateRange: { start: string; end: string };
  };
}

// ==========================================
// Export Types
// ==========================================

/** Supported export formats */
export type ExportFormat = 'csv' | 'json' | 'kml';

/**
 * Request body for POST /api/geo/export.
 */
export interface ExportRequest {
  /** File IDs to export (max 10000) */
  ids?: string[];
  /** Export format: "csv" | "json" | "kml" (default: "csv") */
  format?: ExportFormat;
  /** If true, export all GPS files (ignores ids). Max 50000. */
  includeAll?: boolean;
}

/**
 * Single record in the export output (when format is JSON).
 */
export interface ExportRecord {
  id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  case_id: string;
  latitude: number | string;
  longitude: number | string;
  altitude: number | string;
  datetime: string;
  camera_make: string;
  camera_model: string;
  tags: string;
  origin_hostname: string;
  volume_label: string;
}
