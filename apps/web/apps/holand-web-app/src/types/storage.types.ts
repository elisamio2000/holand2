// ============================================
// Holand Storage Types
// TypeScript interfaces for File Explorer
// Based on: /storage/artifacts API endpoints
// ============================================

/**
 * File type categories for filtering in File Explorer.
 */
export type FileTypeKey = 
  | 'all'
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'archive'
  | 'text'
  | 'other';

/**
 * Processing status for a single plugin on an artifact.
 * null = not applicable for this file type
 */
export type PluginStatus = 'done' | 'pending' | 'failed' | null;

/**
 * Processing status summary per artifact (used in list view).
 * Returned as part of GET /storage/artifacts response items.
 */
export interface ArtifactProcessingStatus {
  file_identify?: PluginStatus;
  file_meta?: PluginStatus;
  file_secure?: PluginStatus;
  image_ocr?: PluginStatus;
  image_faces?: PluginStatus;
  audio_transcribe?: PluginStatus;
  [key: string]: PluginStatus | undefined;
}

/**
 * Metadata extracted by file.meta plugin.
 * Present in GET /storage/artifacts/{id} response.
 */
export interface ArtifactMetadata {
  /** Number of pages (PDF, DOCX) */
  pages?: number;
  /** Document author */
  author?: string;
  /** Creation date of the document content */
  created?: string;
  /** Software that created the file */
  software?: string;
  /** Image/video dimensions */
  width?: number;
  height?: number;
  /** Audio/video duration in seconds */
  duration?: number;
  /** Bitrate in bps */
  bitrate?: number;
  /** GPS latitude */
  gps_lat?: number;
  /** GPS longitude */
  gps_lon?: number;
  /** GPS altitude */
  gps_alt?: number;
  /** Camera model (from EXIF) */
  camera_model?: string;
  /** Additional dynamic metadata from backend */
  [key: string]: unknown;
}

/**
 * Security analysis from file.secure plugin.
 * Present in GET /storage/artifacts/{id} response.
 */
export interface ArtifactSecurity {
  md5?: string;
  sha1?: string;
  sha256?: string;
  sha512?: string;
  /** Shannon entropy 0.0â€“8.0. Above 7.5 suggests encryption/packing. */
  entropy?: number;
  /** YARA rule match names. Empty array = clean. */
  yara_matches?: string[];
  /** Whether the file is a Windows PE executable */
  is_pe?: boolean;
  /** Overall risk assessment: low / medium / high / critical */
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * A single artifact (file) as returned by GET /storage/artifacts list.
 * Lightweight version â€” used in table rows.
 */
export interface Artifact {
  /** Unique artifact ID */
  id: string;
  /** Original filename with extension */
  filename: string;
  /** Full MIME type: application/pdf, image/jpeg, etc. */
  mime_type: string;
  /** File size in bytes */
  file_size: number;
  /** ISO timestamp of upload */
  created_at: string;
  /** Session that uploaded this file */
  session_id?: string | null;
  /** Username who uploaded */
  uploaded_by?: string;
  /**
   * Virtual folder path for tree navigation.
   * Example: "Documents/Reports/Q1"
   * null = root level
   */
  folder_path?: string | null;
  /**
   * Simplified type category for filter chips.
   * One of: image | pdf | video | audio | archive | text | other
   */
  artifact_type?: string;
  /**
   * Coarse media category from backend: image | document | video | audio | archive | other
   * Used by plugin.file_manager for server-side filtering and stats.
   */
  media_type?: string;
  /**
   * Per-file access flags from plugin.file_manager.list.
   * is_owner: current user owns the file.
   * is_group: access via group membership.
   * is_override: access via per-user override.
   */
  access?: FileManagerAccess;
  /** Summary processing status per plugin */
  processing_status?: ArtifactProcessingStatus;
}

/**
 * Full artifact detail returned by GET /storage/artifacts/{id}.
 * Extends Artifact with metadata and security fields.
 */
export interface ArtifactDetail extends Artifact {
  /** Metadata extracted by file.meta plugin */
  metadata?: ArtifactMetadata;
  /** Security analysis from file.secure plugin */
  security?: ArtifactSecurity;
}

/**
 * Paginated response from GET /storage/artifacts.
 */
export interface ArtifactListResponse {
  items: Artifact[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Single plugin result in processing detail.
 * From GET /storage/artifacts/{id}/processing
 */
export interface PluginResult {
  plugin_id: string;
  status: PluginStatus;
  executed_at?: string | null;
  result?: Record<string, unknown> | null;
}

/**
 * Alias for PluginResult when used in file-manager context.
 * Returned as part of plugin.file_manager.detail payload.
 */
export type FileManagerPluginResult = PluginResult;

/**
 * Full processing detail for an artifact.
 * From GET /storage/artifacts/{id}/processing
 */
export interface ArtifactProcessingDetail {
  artifact_id: string;
  plugins: PluginResult[];
}

/**
 * Storage stats from GET /storage/artifacts/stats
 */
export interface StorageStats {
  total_files: number;
  total_size: number;
  by_type: Record<string, { count: number; size: number }>;
  storage_quota?: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Upload response from POST /storage/upload
 */
export interface UploadResponse {
  uploaded: Array<{
    id: string;
    filename: string;
    mime_type: string;
    file_size: number;
  }>;
  failed: Array<{ filename: string; error: string }>;
}

/**
 * Query parameters for GET /storage/artifacts
 */
export interface ArtifactListParams {
  session_id?: string;
  artifact_type?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * A virtual folder node derived client-side from artifact.folder_path.
 * Used for building the Left Panel tree.
 */
export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  fileCount: number;
  fileCountRecursive?: number;
}

// ============================================
// file_manager Plugin (via /tools/.../execute)
// ============================================
// These types map the response from the unified file_manager plugin
// which returns all files a user can access (own + group + override),
// including files uploaded via chat, case importer, and the explorer.
//
// Backend recommended path per FRONTEND_GUIDE:
//   POST /tools/plugin.file_manager.list/execute
//   POST /tools/plugin.file_manager.detail/execute
//   POST /tools/plugin.file_manager.folders/execute
//   POST /tools/plugin.file_manager.facets/execute
//   POST /tools/plugin.file_manager.share/execute

/**
 * Per-item access flags returned by plugin.file_manager.list.
 * Indicates how the current user has access to this file.
 */
export interface FileManagerAccess {
  /** True if the current user owns this artifact (artifacts.user_id == user_id). */
  is_owner?: boolean;
  /** True if access is granted through group membership. */
  is_group?: boolean;
  /** True if access is granted through a per-user override. */
  is_override?: boolean;
}

/**
 * A single file as returned by plugin.file_manager.list.
 * Field names differ from the legacy Artifact type (see adapter in storage.service).
 */
export interface FileManagerItem {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  /** Coarse media category: image | document | video | audio | archive | other */
  media_type?: string;
  created_at: string;
  session_id?: string | null;
  uploaded_by?: string | null;
  /** Virtual folder path (S3-like prefix), e.g. "chat/abc/" */
  folder_path?: string | null;
  /** Some backends send virtual_dir instead of folder_path. */
  virtual_dir?: string | null;
  access?: FileManagerAccess;
  tags?: string[];
  /** Backend may return additional fields; keep schema open. */
  [key: string]: unknown;
}

/**
 * Totals bucket returned when include_stats=true.
 */
export interface FileManagerTotals {
  count: number;
  bytes: number;
}

/**
 * Payload inside result.data for plugin.file_manager.list.
 */
export interface FileManagerListResult {
  items: FileManagerItem[];
  page: number;
  page_size: number;
  total_count: number;
  /** Only present when include_stats=true. Keyed by media_type. */
  totals_by_type?: Record<string, FileManagerTotals>;
}

/** Ownership filter for plugin.file_manager.list. */
export type FileManagerOwnership = 'any' | 'owner' | 'shared';

/**
 * Args for plugin.file_manager.list.
 * Note: user_id is intentionally omitted â€” the gateway overrides it from JWT.
 */
export interface FileManagerListArgs {
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'name' | 'size' | 'mime_type' | 'media_type';
  sort_dir?: 'asc' | 'desc';
  media_type?: string;
  /** OR-list of exact MIME types (e.g. application/pdf, archive types). */
  mime_types?: string[];
  session_id?: string;
  search?: string;
  /** S3-like folder prefix filter (e.g. "case_importer/cas_xxx/"). */
  prefix?: string;
  /** Plugin arg name â€” mapped from `prefix` in storage.service. */
  folder_prefix?: string;
  /** When false, list only files directly in folder_prefix (not subfolders). */
  include_subfolders?: boolean;
  created_from?: string;
  created_to?: string;
  size_min?: number;
  size_max?: number;
  tags_any?: string[];
  tags_all?: string[];
  ownership?: FileManagerOwnership;
  include_stats?: boolean;
}

/** Batch actions for plugin.file_manager.batch */
export type FileManagerBatchAction =
  | 'delete'
  | 'set_tags'
  | 'add_tags'
  | 'remove_tags'
  | 'set_folder'
  | 'patch_metadata';

export interface FileManagerBatchArgs {
  action: FileManagerBatchAction;
  artifact_ids: string[];
  tags?: string[];
  folder_id?: string;
  metadata_patch?: Record<string, unknown>;
}

export interface FileManagerBatchResult {
  ok?: boolean;
  processed?: number;
  failed?: Array<{ id: string; error?: string }>;
  [key: string]: unknown;
}

/** Tool run summary from plugin.file_manager.tools_for_artifact. */
export interface FileManagerToolStatus {
  tool_id: string;
  tool_table?: string;
  row_count: number;
  last_item_index?: number;
  last_created_at?: string;
}

/**
 * Generic envelope returned by POST /tools/{tool_id}/execute.
 * The actual payload lives at `result.data`.
 */
export interface ToolExecuteResponse<T = unknown> {
  ok?: boolean;
  result?: {
    ok?: boolean;
    data?: T;
    channels?: Record<string, unknown>;
    error?: string | null;
  };
  error?: string | null;
  execution_time?: number;
  [key: string]: unknown;
}

// ============================================
// file_manager â€” facets / folders / detail / share
// ============================================

/**
 * Args for plugin.file_manager.facets â€” returns counts for building
 * sidebar chips and filter dropdowns (media_type, mime, session, tags).
 */
export interface FileManagerFacetsArgs {
  filters?: {
    search?: string;
    media_type?: string;
    session_id?: string;
    ownership?: FileManagerOwnership;
  };
  top_mimes?: number;
  top_tags?: number;
  top_sessions?: number;
  date_histogram?: {
    interval?: string;
    field?: string;
  };
}

/** A single facet bucket (value + count). */
export interface FileManagerFacetBucket {
  value: string;
  count: number;
  /** Some facets also return total bytes for the bucket. */
  bytes?: number;
}

/**
 * Payload inside result.data for plugin.file_manager.facets.
 * All fields are optional â€” backend may omit those not requested.
 */
export interface FileManagerFacetsResult {
  /** Count + bytes per coarse media category (image|document|video|audio|archive|other) */
  media_type?: Record<string, FileManagerTotals>;
  /** Top MIME types */
  mime_type?: FileManagerFacetBucket[];
  /** Top session IDs */
  session_id?: FileManagerFacetBucket[];
  /** Top tags */
  tags?: FileManagerFacetBucket[];
  /** Grand totals across all filtered items */
  total?: FileManagerTotals;
  [key: string]: unknown;
}

/**
 * Args for plugin.file_manager.folders â€” S3-like prefix browsing.
 */
export interface FileManagerFoldersArgs {
  /** Path prefix (e.g. "chat/" or ""). Ends with delimiter. */
  prefix?: string;
  /** Path separator â€” usually "/". */
  delimiter?: string;
  limit?: number;
  offset?: number;
  ownership?: FileManagerOwnership;
}

/** A single folder bucket from plugin.file_manager.folders. */
export interface FileManagerFolderBucket {
  /** Just the folder name, not the full prefix. */
  name: string;
  /** Full prefix ending with delimiter, e.g. "chat/abc/". */
  prefix: string;
  /** Files under this prefix (including sub-folders). */
  file_count_recursive?: number;
  /** Total bytes under this prefix. */
  total_bytes_recursive?: number;
}

/** Payload for plugin.file_manager.folders. */
export interface FileManagerFoldersResult {
  folders: FileManagerFolderBucket[];
  /** Pagination echo. */
  prefix?: string;
  delimiter?: string;
  limit?: number;
  offset?: number;
  total?: number;
}

/** Args for plugin.file_manager.detail. */
export interface FileManagerDetailArgs {
  artifact_id: string;
  /** Include a short-lived share token in the response for public thumbnail/download URLs. */
  include_share?: boolean;
  share_expires_sec?: number;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

/**
 * Share token info embedded in detail response when `include_share=true`.
 * Paths are relative to the api-gateway; prepend API base.
 */
export interface FileManagerShareInfo {
  token: string;
  expires_at?: string;
  gateway_download_path?: string;
  gateway_resolve_path?: string;
  gateway_thumbnail_path?: string;
}

/** Payload for plugin.file_manager.detail. */
export interface FileManagerDetailResult {
  id: string;
  original_filename?: string | null;
  file_size_bytes?: number;
  mime_type?: string | null;
  media_type?: string;
  created_at?: string;
  session_id?: string | null;
  uploaded_by?: string | null;
  folder_path?: string | null;
  access?: FileManagerAccess;
  tags?: string[];
  /** Gateway-relative download path (append to API base). */
  gateway_download_path?: string;
  /** Gateway-relative thumbnail path. */
  gateway_thumbnail_path?: string;
  /** Metadata extracted by file.meta plugin. */
  metadata?: ArtifactMetadata;
  /** Security analysis from file.secure plugin. */
  security?: ArtifactSecurity;
  /** Processing detail per plugin. */
  plugins?: PluginResult[];
  /** Optional short-lived public share token. */
  share?: FileManagerShareInfo;
  [key: string]: unknown;
}

/** Args for plugin.file_manager.share. */
export interface FileManagerShareArgs {
  action: 'create' | 'revoke';
  artifact_id?: string;
  expires_sec?: number;
  /** Required by validator â€” pass "" when action=create. */
  token?: string;
}

/** Payload for plugin.file_manager.share. */
export interface FileManagerShareResult {
  token?: string;
  expires_at?: string;
  gateway_download_path?: string;
  gateway_resolve_path?: string;
  revoked?: boolean;
  [key: string]: unknown;
}

