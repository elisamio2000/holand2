// ============================================
// Case Importer Types — Type definitions for Case Importer Service
// All types verified from real backend responses (2026-02-17)
// Backend: Case Importer Service (10.7.0.7:8007 → internal 8006)
// Gateway: 10.7.0.7:8000 (/import/*)
// ============================================

// ==========================================
// Enums & Constants
// ==========================================

/**
 * Possible states of a case during the import lifecycle.
 *
 * Flow: pending → analyzing → embedding → storing → completed
 * Any stage can transition to 'failed'.
 */
export type CaseStatus =
  | 'pending'
  | 'analyzing'
  | 'embedding'
  | 'storing'
  | 'security'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed';

/**
 * File kind classification based on MIME type analysis.
 * Determined automatically by the backend during file scan.
 */
export type FileKind =
  | 'text'
  | 'image'
  | 'binary'
  | 'audio'
  | 'video'
  | 'document'
  | 'archive'
  | 'unknown';

/**
 * Log level for case processing logs.
 */
export type CaseLogLevel = 'info' | 'warn' | 'error' | 'debug';

// ==========================================
// Request Types (from OpenAPI spec)
// ==========================================

/**
 * Request body for POST /import/folder (async) and POST /import/folder/sync.
 *
 * @endpoint POST /import/folder
 * @endpoint POST /import/folder/sync
 */
export interface ImportFolderRequest {
  /** Server-side folder path to import */
  folder_path: string;
  /** Name for the case */
  case_name: string;
  /** Session ID for linking to chat (optional) */
  session_id?: string | null;
  /** Owner user ID (optional — can also be sent via X-User-Id header) */
  user_id?: string | null;
  /** Group ID (optional — can also be sent via X-Group-Id header) */
  group_id?: string | null;
  /** Tool allowlist — null = all/default from prefs, [] = none, ['file.meta'] = specific */
  tool_allowlist?: string[] | null;
}

/**
 * Request body for POST /import/review (Phase 1 only: scan + analyze).
 * Similar to ImportFolderRequest but with an additional `force` flag.
 *
 * @endpoint POST /import/review
 */
export interface ReviewFilesRequest {
  /** Server-side folder path */
  folder_path: string;
  /** Name for the case */
  case_name: string;
  /** Session ID (optional) */
  session_id?: string | null;
  /** Owner user ID (optional) */
  user_id?: string | null;
  /** Group ID (optional) */
  group_id?: string | null;
  /** Force re-run tools that have already been executed (default: false) */
  force?: boolean;
  /** Tool allowlist — null = all/default from prefs, [] = none, ['file.meta'] = specific */
  tool_allowlist?: string[] | null;
}

/**
 * Request body for POST /import/analyze (backward compatibility).
 *
 * NOTE: Gateway schema does NOT include user_id — it is injected
 * via X-User-Id header by the gateway from the JWT token.
 *
 * @endpoint POST /import/analyze
 */
export interface AnalyzeFilesRequest {
  /** Case ID — if provided, updates existing case */
  case_id?: string | null;
  /** Case name (default: "imported") */
  case_name?: string;
  /** Session ID (optional) */
  session_id?: string | null;
  /** Group ID (optional) */
  group_id?: string | null;
  /** Array of file objects to analyze */
  artifacts: Record<string, unknown>[];
  /** Tool allowlist — null = all/default from prefs, [] = none, ['file.meta'] = specific */
  tool_allowlist?: string[] | null;
}

/**
 * Request body for POST /import/folders/batch.
 * Batch import multiple folders — each becomes a separate case.
 *
 * @endpoint POST /import/folders/batch
 */
export interface MultiFolderImportRequest {
  /** Array of server folder paths — each becomes a separate case */
  folders: string[];
  /** Optional case names (same length as folders when provided) */
  case_names?: string[] | null;
  /** Optional session ID for all cases */
  session_id?: string | null;
  /** Optional group ID (can be injected via X-Group-Id header) */
  group_id?: string | null;
  /** Tool allowlist — null = prefs defaults, [] = none, string[] = override */
  tool_allowlist?: string[] | null;
}

// ==========================================
// Staging Upload Types (Resumable Upload — TUS-like protocol)
// ==========================================

/**
 * Request body for POST /import/staging/session.
 * Creates a new staging upload session for chunked/resumable uploads.
 *
 * @endpoint POST /import/staging/session
 */
export interface StagingSessionCreateRequest {
  /** Session identifier (client-generated UUID recommended) */
  session_id?: string;
  /** Optional metadata for the session */
  metadata?: Record<string, unknown>;
}

/**
 * Response from POST /import/staging/session.
 * Contains session ID and initial state.
 *
 * @endpoint POST /import/staging/session
 */
export interface StagingSessionResponse {
  ok: boolean;
  /** Session ID (server confirms or assigns) */
  session_id: string;
  /** Session creation time */
  created_at?: number;
  message?: string;
}

/**
 * Request body for POST /import/staging/{session_id}/files.
 * Registers a file before uploading chunks (TUS-like Create).
 *
 * Backend expects ONLY these fields (per OpenAPI spec):
 * - relative_path: relative path of file under staging root
 * - upload_length: total file size in bytes
 *
 * @endpoint POST /import/staging/{session_id}/files
 */
export interface StagingRegisterFileRequest {
  /** Relative path of file under staging root */
  relative_path: string;
  /** Total file size in bytes */
  upload_length: number;
}

/**
 * Response from POST /import/staging/{session_id}/files.
 * Confirms file registration.
 *
 * @endpoint POST /import/staging/{session_id}/files
 */
export interface StagingFileResponse {
  ok: boolean;
  file_id: string;
  /** Current offset (bytes uploaded so far) */
  offset: number;
  message?: string;
}

/**
 * File info within a staging session.
 *
 * @source GET /import/staging/{session_id}/status → files[]
 */
export interface StagingFileInfo {
  file_id: string;
  filename: string;
  file_size: number;
  /** Bytes uploaded so far */
  offset: number;
  /** Upload complete flag */
  complete: boolean;
  mime_type?: string;
  relative_path?: string;
}

/**
 * Response from GET /import/staging/{session_id}/status.
 * Returns session state and all registered files.
 *
 * @endpoint GET /import/staging/{session_id}/status
 */
export interface StagingSessionStatusResponse {
  ok?: boolean;
  session_id: string;
  /** Session creation time */
  created_at?: number;
  /** All files in this session */
  files: StagingFileInfo[];
  /** Backend: all chunks uploaded */
  all_complete?: boolean;
  /** Backend: registered file count */
  file_count?: number;
  /** Server-side tree path (informational) */
  tree_path?: string;
  /** Normalized total files (derived from file_count or files.length) */
  total_files: number;
  /** Normalized completed files (derived from all_complete or files[]) */
  completed_files: number;
}

/**
 * Request body for POST /import/from-staging.
 * Imports files from a completed staging session.
 *
 * Per OpenAPI spec: staging_id + case_name are required.
 * session_id is an OPTIONAL chat session ID (not the staging session).
 *
 * @endpoint POST /import/from-staging
 */
export interface FromStagingImportRequest {
  /** Staging session ID (required — identifies the upload session) */
  staging_id: string;
  /** Case name (required) */
  case_name: string;
  /** Optional chat session ID (NOT the staging session) */
  session_id?: string | null;
  /** Optional group ID */
  group_id?: string | null;
  /** Tool allowlist — null = all/default from prefs, [] = none, ['file.meta'] = specific */
  tool_allowlist?: string[] | null;
}

/**
 * Request body for POST /import/from-staging/batch.
 * Imports multiple root paths from the same staging session as separate cases.
 *
 * Per OpenAPI spec: staging_id + roots are required.
 *
 * @endpoint POST /import/from-staging/batch
 */
export interface FromStagingBatchRequest {
  /** Staging session ID (required) */
  staging_id: string;
  /** Array of root paths to import (each becomes a case) — min 1 */
  roots: string[];
  /** Case names (one per root path, optional) */
  case_names?: string[] | null;
  /** Optional chat session ID */
  session_id?: string | null;
  /** Optional group ID */
  group_id?: string | null;
  /** Tool allowlist — null = all/default from prefs, [] = none, ['file.meta'] = specific */
  tool_allowlist?: string[] | null;
}

// ==========================================
// Upload Response Types (Storage Service — /upload)
// ==========================================

/**
 * Single saved artifact entry from upload response.
 * Represents one file that was uploaded and stored on the server.
 */
export interface SavedArtifact {
  /** Artifact ID in the database */
  id?: string;
  /** Server-side storage path (e.g., "/data/uploads/session123/document.pdf") */
  storage_path?: string;
  /** Alternative path field */
  path?: string;
  /** Original filename */
  original_filename?: string;
  /** File name */
  name?: string;
  /** MIME type */
  mime_type?: string;
  /** Alternative MIME type field */
  media_type?: string;
  /** File size in bytes */
  file_size_bytes?: number;
  /** Alternative size field (backend returns `size` not `file_size_bytes`) */
  size?: number;
  /** File type classification (e.g., "document", "image") */
  type?: string;
  /** Original filename (alternative field) */
  filename?: string;
  /** Additional fields from backend */
  [key: string]: unknown;
}

/**
 * Response from POST /upload (via API Gateway).
 * Backend may return different shapes; this covers all known variants.
 *
 * @endpoint POST /upload
 */
export interface UploadFilesResponse {
  /** Array of saved artifact info */
  saved?: SavedArtifact[];
  /** Number of files saved */
  count?: number;
  /** Alternative: artifacts array */
  artifacts?: SavedArtifact[];
  /** Additional fields */
  [key: string]: unknown;
}

// ==========================================
// Response Types — Verified from backend (2026-02-17)
// ==========================================

/**
 * Response from POST /import/folder.
 * Returned immediately when an async import job is queued.
 *
 * @endpoint POST /import/folder
 */
export interface ImportResponse {
  /** Whether the operation was successful */
  ok: boolean;
  /** Generated case ID (e.g., "cas_317ad603d9b6") */
  case_id: string;
  /** Descriptive message (e.g., "Queued at position 1 (est. wait: 120s)") */
  message: string;
}

/**
 * Response from GET /import/list.
 * Contains count and array of all cases.
 *
 * @endpoint GET /import/list
 */
/** Query params for GET /import/list (BR-1); client applies when server ignores them */
export interface CaseListQueryParams {
  page?: number;
  page_size?: number;
  status?: CaseStatus | 'all';
  q?: string;
  sort?: 'updated_at' | 'case_name' | 'status' | 'progress';
  order?: 'asc' | 'desc';
}

export interface CaseListResponse {
  /** Total number of cases */
  count: number;
  /** Array of case summary items */
  cases: CaseListItem[];
  /** Server pagination (BR-1); optional until backend deploys */
  page?: number;
  page_size?: number;
  total_pages?: number;
}

/**
 * Summary item for a case in the list view.
 * Subset of CaseDetail — optimized for table display.
 *
 * @source GET /import/list → cases[]
 */
export interface CaseListItem {
  /** Case ID (e.g., "cas_317ad603d9b6") */
  case_id: string;
  /** Case name */
  case_name: string;
  /** Current status in the import lifecycle */
  status: CaseStatus;
  /** Progress as a fraction (0.0 to 1.0), NOT 0-100 */
  progress: number;
  /** Total number of files in the case */
  files_total: number;
  /** Number of files processed so far */
  files_processed: number;
  /** Owner user ID (empty string if not set) */
  user_id: string;
  /** Group ID (empty string if not set) */
  group_id: string;
  /** Last update time as epoch timestamp (seconds) */
  updated_at: number;
  /** Last error message (empty string if no error) */
  last_error: string;
  /**
   * When false, import detail API has no row for this case (ghost / list-only).
   * May come from backend list API or client-side 404 cache.
   */
  detail_available?: boolean;
}

/**
 * Response from GET /import/status/{case_id}.
 * Lightweight status check including queue position info.
 *
 * @endpoint GET /import/status/{case_id}
 */
export interface CaseStatusResponse {
  case_id: string;
  case_name: string;
  user_id: string;
  group_id: string;
  status: CaseStatus;
  /** Progress as a fraction (0.0 to 1.0) */
  progress: number;
  files_total: number;
  files_processed: number;
  last_error: string;
  /** Last update time as epoch timestamp (seconds) */
  updated_at: number;
  /** Queue position (0 = currently active or not in queue) */
  queue_position: number;
  /** Estimated wait time in seconds */
  estimated_wait_sec: number;
}

/**
 * Full case detail response from GET /import/detail/{case_id}.
 * Contains complete file list, tool results, and processing logs.
 *
 * @endpoint GET /import/detail/{case_id}
 */
export interface CaseDetail {
  case_id: string;
  case_name: string;
  /** Root path of the case on the server */
  case_root: string;
  status: CaseStatus;
  ok: boolean;
  /** Progress as a fraction (0.0 to 1.0) */
  progress: number;
  session_id: string;
  user_id: string;
  group_id: string;
  files_total: number;
  files_done: number;
  files_error: number;
  /** Number of vectors stored in Qdrant */
  qdrant_vectors_count: number;
  /** Error message (empty string if no error) */
  error: string;
  /** Creation time as epoch timestamp (seconds) */
  created_at: number;
  /** Last update time as epoch timestamp (seconds) */
  updated_at: number;
  /** All files in the case */
  files: CaseFile[];
  /** Processing logs */
  logs: CaseLog[];
}

/**
 * A single file (artifact) within a case.
 * Contains metadata, planned tools, and tool execution results.
 *
 * @source GET /import/detail/{case_id} → files[]
 */
export interface CaseFile {
  /** Unique file identifier (UUID) */
  artifact_id: string;
  /** Relative path within the case */
  relative_path: string;
  /** Original source path on the server */
  source_path: string;
  /** Path within the case structure */
  case_path: string;
  /** Folder identifier (UUID) */
  folder_id: string;
  /** File kind classification */
  kind: FileKind;
  /** Media type category (e.g., "text", "image") */
  media_type: string;
  /** File size in bytes */
  size_bytes: number;
  /** Processing status of this file */
  status: string;
  /** Whether the file has an extension */
  has_extension: boolean;
  /** List of tool IDs planned for execution */
  planned_tools: string[];
  /** Results of executed tools */
  tools: ToolResult[];
  /** Error messages for this file */
  errors: string[];
}

/**
 * Result of a single tool execution on a file.
 *
 * @source CaseFile → tools[]
 */
export interface ToolResult {
  /** Tool identifier (e.g., "file.secure", "file.meta", "text.summarize") */
  tool_id: string;
  /** Whether execution was successful */
  ok: boolean;
  /** Tool-specific result data (structure varies per tool_id) */
  result: Record<string, unknown>;
  /** Error message (null if successful) */
  error: string | null;
  /** Execution time in milliseconds */
  elapsed_ms: number;
}

/**
 * A log entry from case processing.
 *
 * @source GET /import/detail/{case_id} → logs[]
 */
export interface CaseLog {
  /** Timestamp as epoch (seconds) */
  ts: number;
  /** Log level */
  level: CaseLogLevel;
  /** Log scope (e.g., "case", "tool") */
  scope: string;
  /** Log message (may contain Persian text) */
  message: string;
  /** Additional data */
  data: Record<string, unknown>;
}

// ==========================================
// Queue Types
// ==========================================

/**
 * Response from GET /import/queue/status.
 * Overall queue status with active and queued jobs.
 *
 * @endpoint GET /import/queue/status
 */
export interface QueueStatusResponse {
  ok: boolean;
  /** Number of jobs waiting in queue */
  queue_size: number;
  /** Number of currently active jobs */
  active_count: number;
  /** Maximum concurrent jobs allowed */
  max_concurrent: number;
  /** Total jobs processed since service start */
  total_processed: number;
  /** Currently running jobs */
  active_jobs: QueueJob[];
  /** Jobs waiting to be processed */
  queued_jobs: QueueJob[];
}

/**
 * A job in the import queue.
 *
 * @source QueueStatusResponse → active_jobs[] | queued_jobs[]
 */
export interface QueueJob {
  case_id: string;
  case_name: string;
  status: string;
  /** Additional fields vary by job state */
  [key: string]: unknown;
}

/**
 * Response from GET /import/queue/position/{case_id}.
 * Position of a specific case in the queue.
 *
 * @endpoint GET /import/queue/position/{case_id}
 */
export interface QueuePositionResponse {
  ok: boolean;
  case_id: string;
  /** Position in queue (0 = active or not in queue) */
  position: number;
  /** Job status: "active" | "queued" | "not_found" */
  status: string;
  /** Estimated wait time in seconds */
  estimated_wait_sec: number;
}

/**
 * Response from GET /import/embed/preview/{case_id}.
 * Preview of the embedding plan before execution.
 *
 * @endpoint GET /import/embed/preview/{case_id}
 */
export interface EmbedPreviewResponse {
  ok: boolean;
  case_id: string;
  /** Number of embedding tasks */
  task_count: number;
  /** Embedding task details */
  tasks: EmbedTask[];
}

/**
 * A single embedding task in the preview.
 *
 * @source EmbedPreviewResponse → tasks[]
 */
export interface EmbedTask {
  /** Task structure varies — needs further investigation */
  [key: string]: unknown;
}

// ==========================================
// UI Helper Types
// ==========================================

/**
 * Status badge configuration for UI display.
 */
export interface CaseStatusConfig {
  label: string;
  labelFa: string;
  color: 'warning' | 'info' | 'secondary' | 'primary' | 'success' | 'danger';
  icon: string;
}

/**
 * Import mode selection for the import form.
 */
export type ImportMode = 'async' | 'sync' | 'review';

/**
 * Status filter options for the case list page.
 */
export type CaseStatusFilter = CaseStatus | 'all';

/**
 * Sort options for the case list.
 */
export type CaseSortField = 'case_name' | 'status' | 'progress' | 'files_total' | 'updated_at';

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

// ==========================================
// Plugin Selection Types
// ==========================================

/**
 * Available plugin IDs in the system.
 * These plugins process files during case import.
 *
 * @see PLUGIN_SELECTION_SYSTEM.md for detailed documentation
 */
export type PluginId =
  | 'file.identify'
  | 'file.meta'
  | 'file.secure'
  | 'image.meta'
  | 'image.faces'
  | 'image.ocr'
  | 'image.describe'
  | 'image.search'
  | 'text.search'
  | 'face.search'
  | 'audio.transcribe'
  | 'audio.voiceprints'
  | 'embed.face'
  | 'embed.text'
  | 'embed.imagetext'
  | 'analysis.geo_location';

/**
 * Plugin metadata for display and categorization.
 * Backend should return this structure for each available plugin.
 */
export interface PluginInfo {
  /** Unique plugin identifier */
  id: PluginId;
  /** Display name (English) */
  name: string;
  /** Display name (Persian) */
  name_fa: string;
  /** Short description */
  description: string;
  /** Short description (Persian) */
  description_fa: string;
  /** Category for grouping in UI */
  category: PluginCategory;
  /** Whether this plugin is always required */
  required: boolean;
  /** Whether this is an AI-heavy plugin (affects cost/time) */
  ai_powered: boolean;
  /** Estimated processing time per file in seconds */
  estimated_time_per_file?: number;
  /** Plugin version */
  version?: string;
}

/**
 * Plugin categories for UI grouping.
 */
export type PluginCategory =
  | 'file'
  | 'image'
  | 'search'
  | 'audio'
  | 'embed'
  | 'analysis'
  | 'security'
  | 'graph';

/**
 * Response from GET /plugins endpoint (future backend implementation).
 */
export interface PluginsListResponse {
  /** List of available plugins */
  plugins: PluginInfo[];
  /** Total count */
  total: number;
}

/**
 * Plugin selection configuration for import request.
 * Sent to backend to specify which plugins should be executed.
 */
export interface PluginSelection {
  /** List of enabled plugin IDs */
  enabled: PluginId[];
}

/**
 * Plugin execution result in import response.
 * Backend returns this for each executed plugin.
 */
export interface PluginExecutionInfo {
  /** Execution status */
  status: 'success' | 'failed' | 'skipped';
  /** Execution duration (e.g., "2.5s", "1m 30s") */
  duration?: string;
  /** Number of files processed */
  files_processed?: number;
  /** Error message if failed */
  error?: string;
  /** Plugin-specific results */
  [key: string]: unknown;
}

// ==========================================
// Import Tool & Preferences Types
// ==========================================

/**
 * Import tool metadata from backend catalog.
 * Different from PluginInfo — this is what backend returns from GET /import/tools.
 *
 * @source GET /import/tools
 */
export interface ImportToolInfo {
  /** Tool ID (e.g., "file.meta", "image.ocr") */
  tool_id: string;
  /** Human-readable name */
  name?: string;
  /** Tool description */
  description?: string;
  /** Tool category */
  category?: string;
  /** Whether this tool is enabled by default */
  default_enabled?: boolean;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Response from GET /import/tools.
 * Lists all available import tools.
 *
 * **Backend Format Note**: Currently returns tools as object dictionary:
 * ```json
 * {
 *   "ok": true,
 *   "count": 13,
 *   "tools": {
 *     "audio.voiceprints": { "description": "...", "category": "audio" },
 *     "file.identify": { ... }
 *   }
 * }
 * ```
 *
 * Service layer transforms this to array format for consistency.
 *
 * @endpoint GET /import/tools
 */
export interface ImportToolsResponse {
  ok: boolean;
  /** Tool count */
  count?: number;
  /** Tools — can be array (preferred) or object dictionary (backend format) */
  tools: ImportToolInfo[] | Record<string, BackendToolInfo>;
  /** Total count (deprecated — use count) */
  total?: number;
}

/**
 * Backend's raw tool info format (from /import/tools).
 * Does NOT include tool_id — it's the object key instead.
 */
export interface BackendToolInfo {
  description: string;
  category: string;
  enabled: boolean;
  version: string;
  channels: string[];
}

/**
 * Request body for PUT /import/preferences.
 * Updates user's tool allowlist (which tools are enabled during import).
 *
 * @endpoint PUT /import/preferences
 */
export interface CaseImporterPrefsBody {
  /**
   * Tool allowlist configuration:
   * - `null` or omitted: use defaults (backend decides)
   * - `[]` (empty array): disable ALL tools
   * - `["tool.id1", "tool.id2"]`: enable only these tools
   */
  tool_allowlist?: string[] | null;
}

/**
 * Response from GET /import/preferences and PUT /import/preferences.
 * Contains user's saved tool preferences.
 *
 * @endpoint GET /import/preferences
 * @endpoint PUT /import/preferences
 */
export interface CaseImporterPrefsResponse {
  ok: boolean;
  /** User ID (from JWT sub claim) */
  user_id: string;
  /**
   * Tool allowlist:
   * - `null`: use defaults
   * - `[]`: no tools enabled
   * - `["tool.id"]`: specific tools enabled
   */
  tool_allowlist: string[] | null;
  /** Last update time (epoch timestamp in seconds) */
  updated_at?: number;
  message?: string;
}

