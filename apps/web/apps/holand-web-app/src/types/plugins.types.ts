// ============================================
// Plugins Types — Type definitions for Plugins/Tools System
// All types based on tool.json schema and backend API Gateway /tools
// Backend: API Gateway (10.7.0.7:8000)
// ============================================

// ==========================================
// Plugin/Tool Data Structures
// ==========================================

/**
 * Plugin/Tool information from GET /tools.
 * Based on tool.json schema found in Plugins/ folder.
 *
 * @endpoint GET /tools
 */
export interface PluginInfo {
  /** Unique plugin identifier (e.g., "file.meta", "image.describe") */
  tool_id: string;
  /** Plugin ID (alternative field name) */
  id?: string;
  /** Display name (Persian or English) */
  name?: string;
  /** Plugin description */
  description?: string;
  /** English description */
  description_en?: string;
  /** Category (e.g., "general", "image", "text") */
  category?: string;
  /** Version string (e.g., "2.5.0") */
  version?: string;
  /** Last update date */
  updated_at?: string;
  /** Entry point (typically "tool:run") */
  entry?: string;
  /** Timeout in seconds */
  timeout_sec?: number;
  /** List of plugin capabilities */
  capabilities?: string[];
  /** Supported MIME types */
  mime_types?: string[];
  /** Arguments schema */
  args?: Record<string, string>;
  /** Args schema (alternative field) */
  args_schema?: Record<string, unknown>;
  /** Supported file formats */
  supported_formats?: string[];
  /** Output channels configuration */
  output_channels?: Record<string, string>;
  /** UI configuration */
  ui?: {
    path?: string;
    [key: string]: unknown;
  };
  /** List of possible errors */
  errors?: string[];
  /** Additional notes or hints */
  [key: string]: unknown;
  /** Is plugin active */
  is_active?: boolean;
}

/**
 * Plugin category metadata.
 *
 * @endpoint GET /tools/categories
 */
export interface PluginCategory {
  /** Category name */
  category: string;
  /** Number of tools in this category */
  count?: number;
}

// ==========================================
// Plugin Execution
// ==========================================

/**
 * Request body for executing a plugin.
 *
 * @endpoint POST /tools/{tool_id}/run
 */
export interface PluginRunRequest {
  /** Tool/plugin ID to execute */
  tool_id: string;
  /** Arguments for the plugin */
  args: Record<string, unknown>;
  /** Session ID (optional) */
  session_id?: string | null;
  /** User ID (optional — usually from JWT) */
  user_id?: string | null;
}

/**
 * Plugin execution result envelope.
 * The actual result structure varies per plugin.
 *
 * @endpoint POST /tools/{tool_id}/run (response)
 */
export interface PluginRunResult {
  /** Tool ID that was executed */
  tool_id: string;
  /** Execution status */
  status?: 'success' | 'error' | 'running' | 'completed';
  /** Result data (structure varies per plugin) */
  data?: Record<string, unknown>;
  /** Result channels (ui, llm, metadata, rawdata, embed) */
  channels?: {
    /** UI-formatted data for display */
    ui?: Record<string, unknown>;
    /** LLM-optimized summary */
    llm?: string;
    /** Structured metadata */
    metadata?: Record<string, unknown>;
    /** Raw data for database storage */
    rawdata?: Record<string, unknown>;
    /** Embeddings for similarity search */
    embed?: number[];
  };
  /** Error message if execution failed */
  error?: string;
  /** Warnings during execution */
  warnings?: string[];
  /** Execution metadata */
  execution?: {
    /** Start time (ISO 8601) */
    started_at?: string;
    /** Completion time (ISO 8601) */
    completed_at?: string;
    /** Duration in seconds */
    duration_sec?: number;
  };
  /** Additional fields */
  [key: string]: unknown;
}

// ==========================================
// file.meta Specific Types
// ==========================================

/**
 * file.meta plugin result structure.
 * Based on analysis of file.meta/ui/tool.js and real responses.
 */
export interface FileMetaResult {
  /** File information */
  file?: {
    filename?: string;
    filepath?: string;
    size?: number;
    size_formatted?: string;
    modified_at?: string;
    created_at?: string;
    accessed_at?: string;
  };
  /** File type information */
  type?: {
    mime_type?: string;
    kind?: string;
    extension?: string;
    description?: string;
  };
  /** File stats */
  stats?: {
    size_bytes?: number;
    size_formatted?: string;
    modified_at?: string;
    created_at?: string;
    accessed_at?: string;
  };
  /** Security/hash information */
  security?: {
    sha256?: string;
    md5?: string;
    sha1?: string;
    sha512?: string;
    entropy?: number;
  };
  /** GPS location (if available) */
  location?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    source?: string;
  };
  /** Metadata by type (image, audio, video, document, archive, etc.) */
  metadata?: {
    /** Image metadata */
    image?: {
      width?: number;
      height?: number;
      camera?: string;
      lens?: string;
      orientation?: number;
      [key: string]: unknown;
    };
    /** Audio metadata */
    audio?: {
      duration?: number;
      sample_rate?: number;
      channels?: number;
      bitrate?: number;
      codec?: string;
      [key: string]: unknown;
    };
    /** Video metadata */
    video?: {
      duration?: number;
      width?: number;
      height?: number;
      framerate?: number;
      codec?: string;
      [key: string]: unknown;
    };
    /** Document metadata */
    document?: {
      pages?: number;
      title?: string;
      author?: string;
      created_at?: string;
      [key: string]: unknown;
    };
    /** Archive metadata */
    archive?: {
      total_files?: number;
      total_size?: number;
      compressed_size?: number;
      entries_preview?: Array<{
        name?: string;
        size?: number;
      }>;
      [key: string]: unknown;
    };
    /** Text metadata */
    text?: {
      char_count?: number;
      word_count?: number;
      line_count?: number;
      encoding?: string;
      [key: string]: unknown;
    };
    /** SQLite metadata */
    sqlite?: {
      tables?: string[];
      version?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  /** Extended attributes (xattrs) */
  xattrs?: Record<string, unknown>;
  /** Hidden data (binwalk analysis) */
  hidden_data?: {
    found?: boolean;
    entries?: unknown[];
    [key: string]: unknown;
  };
  /** Warnings */
  warnings?: string[];
  [key: string]: unknown;
}

// ==========================================
// UI State Management
// ==========================================

/**
 * Plugin execution history item (for tracking recent runs).
 */
export interface PluginExecutionHistory {
  /** Unique execution ID */
  id: string;
  /** Plugin ID */
  tool_id: string;
  /** Plugin name */
  tool_name?: string;
  /** Execution timestamp */
  timestamp: number;
  /** Arguments used */
  args: Record<string, unknown>;
  /** Result (if completed) */
  result?: PluginRunResult;
  /** Status */
  status: 'success' | 'error' | 'running';
  /** Error message (if failed) */
  error?: string;
}

/**
 * Filter and sort options for plugin list.
 */
export type PluginCategoryFilter = 'all' | string;
export type PluginSortField = 'name' | 'category' | 'tool_id' | 'updated_at';
export type SortDirection = 'asc' | 'desc';

// ==========================================
// External Plugins (v3.0.0)
// ==========================================

/**
 * External plugin configuration from tool.json in Plugins/ folder.
 * These are plugins that run locally via Plugin Executor Server.
 */
export interface ExternalPluginInfo {
  /** Plugin identifier (e.g., "file.meta") */
  id: string;
  /** Display name */
  name: string;
  /** English name */
  name_en?: string;
  /** Description */
  description: string;
  /** English description */
  description_en?: string;
  /** Version */
  version: string;
  /** Last update */
  updated_at?: string;
  /** Category */
  category: string;
  /** Plugin capabilities */
  capabilities?: string[];
  /** Supported MIME types */
  mime_types?: string[];
  /** Supported file formats (human-readable) */
  supported_formats?: string[];
  /** Input arguments schema */
  args?: Record<string, string>;
  /** Entry point */
  entry?: string;
  /** Timeout in seconds */
  timeout_sec?: number;
  /** Has UI files */
  has_ui?: boolean;
  /** UI path (relative) */
  ui_path?: string;
  /** Plugin folder path */
  folder_path?: string;
  /** Is available (has all dependencies) */
  is_available?: boolean;
  /** Status message if not available */
  status_message?: string;
}

/**
 * Input modes for external plugins.
 */
export type ExternalPluginInputMode = 'upload' | 'directory' | 'api';

/**
 * Input configuration for external plugin execution.
 */
export interface ExternalPluginInput {
  /** Input mode */
  mode: ExternalPluginInputMode;
  /** Files for upload mode */
  files?: File[];
  /** Directory path for directory mode */
  directoryPath?: string;
  /** Recursive directory scan */
  recursive?: boolean;
  /** API URL for api mode */
  apiUrl?: string;
  /** API headers for authentication */
  apiHeaders?: Record<string, string>;
}

/**
 * Output configuration for external plugin execution.
 */
export interface ExternalPluginOutput {
  /** Show results in UI */
  preview: boolean;
  /** Send results to API */
  saveToApi: boolean;
  /** API endpoint for saving */
  apiEndpoint?: string;
  /** HTTP method for API */
  apiMethod?: 'POST' | 'PUT';
  /** Export as CSV */
  exportCsv: boolean;
  /** Export as SQLite DB */
  exportSqlite: boolean;
}

/**
 * Processing progress for batch operations.
 */
export interface ExternalPluginProgress {
  /** Current file index */
  current: number;
  /** Total files */
  total: number;
  /** Current filename being processed */
  currentFile?: string;
  /** Processing status */
  status: 'idle' | 'processing' | 'complete' | 'error';
  /** Error messages */
  errors?: string[];
}

/**
 * Batch processing result from external plugin.
 */
export interface ExternalPluginBatchResult {
  /** Processing status */
  status: 'success' | 'partial' | 'error';
  /** Total files processed */
  total: number;
  /** Successful count */
  success_count: number;
  /** Failed count */
  error_count: number;
  /** Individual results */
  results: ExternalPluginResult[];
  /** Processing duration in ms */
  duration_ms: number;
}

/**
 * Single file result from external plugin.
 */
export interface ExternalPluginResult {
  /** File ID (UUID) */
  id: string;
  /** Filename */
  filename: string;
  /** Full file path */
  filepath: string;
  /** File size in bytes */
  size_bytes: number;
  /** Formatted size */
  size_formatted: string;
  /** MIME type */
  mime_type: string;
  /** File extension */
  extension: string;
  /** Created timestamp */
  created_at: string;
  /** Modified timestamp */
  modified_at: string;
  /** Plugin-specific metadata */
  metadata: Record<string, unknown>;
  /** GPS data if available */
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    source?: string;
  };
  /** Security hashes */
  security?: {
    sha256?: string;
    md5?: string;
    entropy?: number;
  };
  /** Processing info */
  processing: {
    status: 'success' | 'error' | 'warning';
    duration_ms: number;
    errors?: string[];
    warnings?: string[];
  };
}

// ==========================================
// File Manager Plugin Types
// plugin.file_manager.* — POST /tools/plugin.file_manager.{action}/execute
// All operations go through the API Gateway (port 8000) — no direct storage access.
// ==========================================

/**
 * Access info per file item from the file_manager plugin.
 * Indicates HOW the current user has access to this file.
 */
export interface FileManagerAccess {
  /** User is the owner (artifacts.user_id == user_id) */
  is_owner: boolean;
  /** User has access via group membership */
  is_group?: boolean;
  /** User has access via per-user override */
  is_override?: boolean;
}

/**
 * A single file item in the file_manager.list result.
 */
export interface FileManagerItem {
  /** Artifact UUID */
  id: string;
  /** Original upload filename */
  original_filename: string;
  /** File size in bytes */
  file_size_bytes: number;
  /** MIME type (e.g. "image/jpeg") */
  mime_type: string;
  /** Media type category (e.g. "image", "document") */
  media_type: string;
  /** ISO 8601 upload timestamp */
  created_at: string;
  /** Virtual folder path */
  folder_path?: string;
  /** Session ID the file belongs to */
  session_id?: string;
  /** Access info — how the current user can access this file */
  access?: FileManagerAccess;
  /** Additional fields from backend */
  [key: string]: unknown;
}

/**
 * Arguments for plugin.file_manager.list
 *
 * @endpoint POST /tools/plugin.file_manager.list/execute
 */
export interface FileManagerListArgs {
  /** Current page (1-based, default: 1) */
  page?: number;
  /** Items per page (default: 25) */
  page_size?: number;
  /** Sort field */
  sort_by?: 'created_at' | 'name' | 'size' | 'mime_type' | 'media_type';
  /** Sort direction */
  sort_dir?: 'asc' | 'desc';
  /** Filter by media_type */
  media_type?: string;
  /** Filter by session_id */
  session_id?: string;
  /** Substring search in filename/path */
  search?: string;
  /** Ownership filter: any=all, owner=mine, shared=others */
  ownership?: 'any' | 'owner' | 'shared';
  /** Include per-type stats in response (totals_by_type) */
  include_stats?: boolean;
}

/**
 * Result data from plugin.file_manager.list (inside PluginRunResult.data).
 */
export interface FileManagerListData {
  items: FileManagerItem[];
  page: number;
  page_size: number;
  total_count: number;
  /** Per media-type stats — only present when include_stats=true */
  totals_by_type?: Record<string, { count: number; bytes: number }>;
}

/**
 * Arguments for plugin.file_manager.detail
 *
 * @endpoint POST /tools/plugin.file_manager.detail/execute
 */
export interface FileManagerDetailArgs {
  /** Artifact UUID */
  artifact_id: string;
  /** Thumbnail width in pixels (optional) */
  thumbnail_width?: number;
  /** Thumbnail height in pixels (optional) */
  thumbnail_height?: number;
  /**
   * If provided, a share token is created with this TTL.
   * The token appears in result.data.share.
   */
  share_expires_sec?: number;
}

/**
 * Result data from plugin.file_manager.detail (inside PluginRunResult.data).
 */
export interface FileManagerDetailData extends FileManagerItem {
  /** Gateway path for inline/attachment download (no Bearer needed via /api/gateway proxy) */
  download_path?: string;
  /** Gateway path for thumbnail (no Bearer needed via /api/gateway proxy) */
  thumbnail_path?: string;
  /** Share token info — present only when share_expires_sec was provided */
  share?: {
    token?: string;
    /** e.g. /storage/shares/{token}/download */
    gateway_download_path?: string;
    /** e.g. /storage/shares/{token}/resolve */
    gateway_resolve_path?: string;
  };
  /** File metadata (EXIF, dimensions, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Arguments for plugin.file_manager.folders
 *
 * @endpoint POST /tools/plugin.file_manager.folders/execute
 */
export interface FileManagerFoldersArgs {
  /** Path prefix to list children of (e.g. "chat/") */
  prefix?: string;
  /** Delimiter (default: "/") */
  delimiter?: string;
  limit?: number;
  offset?: number;
}

/**
 * A single folder node from plugin.file_manager.folders.
 */
export interface FileManagerFolderItem {
  name: string;
  prefix: string;
  file_count_recursive: number;
  total_bytes_recursive: number;
}

/**
 * Result data from plugin.file_manager.folders (inside PluginRunResult.data).
 */
export interface FileManagerFoldersData {
  folders: FileManagerFolderItem[];
}

/**
 * Arguments for plugin.file_manager.facets
 *
 * @endpoint POST /tools/plugin.file_manager.facets/execute
 */
export interface FileManagerFacetsArgs {
  filters?: Record<string, unknown>;
  top_mimes?: number;
  top_tags?: number;
  top_sessions?: number;
}

/**
 * Result data from plugin.file_manager.facets (inside PluginRunResult.data).
 */
export interface FileManagerFacetsData {
  media_type?: Record<string, number>;
  mime_type?: Record<string, number>;
  tags?: Record<string, number>;
  sessions?: Record<string, number>;
}

/**
 * Arguments for plugin.file_manager.share
 *
 * @endpoint POST /tools/plugin.file_manager.share/execute
 */
export interface FileManagerShareArgs {
  /** "create" to generate a new token, "revoke" to invalidate one */
  action: 'create' | 'revoke';
  /** Artifact ID — required for action=create, empty string for revoke */
  artifact_id: string;
  /** Token TTL in seconds (default: 900 = 15 min) */
  expires_sec?: number;
  /**
   * Share token — required by validator even for create action.
   * Pass empty string "" for create, pass the actual token for revoke.
   */
  token: string;
}

/**
 * Result data from plugin.file_manager.share (inside PluginRunResult.data).
 */
export interface FileManagerShareData {
  /** The share token string */
  token?: string;
  /** e.g. /storage/shares/{token}/download */
  gateway_download_path?: string;
  /** e.g. /storage/shares/{token}/resolve */
  gateway_resolve_path?: string;
  /** Revocation confirmation message */
  message?: string;
}
