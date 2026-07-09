// ============================================
// Holand Storage Service
// File Explorer API calls via API Gateway (port 8000)
// Endpoints: /storage/artifacts/*
// ============================================

import { isAxiosError } from 'axios';
import { getSession } from 'next-auth/react';
import { gatewayClient } from '@/lib/api-client';
import { resolveActiveGroupId } from '@/lib/workspace-group-id';
import { isRateLimitedError } from '@/lib/gateway-retry';
import { assertGatewayToolSuccess } from '@/utils/gateway-tool-success';
import {
  normalizeFileManagerShareResult,
  unwrapToolExecuteData,
} from '@/utils/tool-execute';
import { toolExecutePath } from '@/utils/tool-id';
import {
  classifyStorageHttpStatus,
  isStoragePreviewFetchUrl,
  logStorageFetchFailure,
  supportsStorageThumbnailEndpoint,
} from '@/utils/storage-media-url';
import { thumbnailQueue, shareTokenQueue } from '@/utils/request-queue';
import type {
  Artifact,
  ArtifactListResponse,
  ArtifactDetail,
  ArtifactListParams,
  ArtifactProcessingDetail,
  FileManagerDetailArgs,
  FileManagerDetailResult,
  FileManagerFacetBucket,
  FileManagerFacetsArgs,
  FileManagerFacetsResult,
  FileManagerFoldersArgs,
  FileManagerFoldersResult,
  FileManagerItem,
  FileManagerBatchArgs,
  FileManagerBatchResult,
  FileManagerListArgs,
  FileManagerListResult,
  FileManagerPluginResult,
  FileManagerShareArgs,
  FileManagerShareResult,
  FileManagerToolStatus,
  FileManagerTotals,
  PluginResult,
  StorageStats,
  ToolExecuteResponse,
  UploadResponse,
} from '@/types/storage.types';

/** In-session blob URL cache â€” same pattern as chat preview (JWT-backed storage URLs). */
const blobUrlCache = new Map<string, string>();
/** Permanent failures (404 only) â€” do not cache 429/5xx so retries can succeed. */
const failedBlobUrlCache = new Set<string>();

/** Clear 404 cache when changing page (new files may have been processed). */
export function clearStoragePreviewFailureCache(): void {
  failedBlobUrlCache.clear();
}
/** Coalesce parallel fetches for the same URL (Strict Mode / grid re-renders). */
const inflightBlobFetches = new Map<string, Promise<string | null>>();
/** Share-token public URLs for grid images (artifactId â†’ { url, expiresAt }). */
const shareImageUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** Maps postgres tool table names from detail.everywhere to plugin IDs. */
const TOOL_TABLE_TO_PLUGIN: Record<string, string> = {
  tool_file_meta: 'file.meta',
  tool_file_secure: 'file.secure',
  tool_file_identify: 'file.identify',
};

// ==========================================
// Helpers â€” file_manager plugin adapter
// ==========================================

/**
 * Derive the UI-level `artifact_type` key from a MIME type.
 * Mirrors the logic in type-filter-chips so filter counts and the
 * File Explorer type filter stay consistent across all data sources.
 *
 * Keys: image | pdf | video | audio | archive | text | other
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Map explorer `prefix` â†’ plugin `folder_prefix` (+ optional subfolder scope). */
function buildFileManagerListPluginArgs(
  args: FileManagerListArgs
): Record<string, unknown> {
  const { prefix, folder_prefix, ...rest } = args;
  const resolvedPrefix = folder_prefix ?? prefix;
  const pluginArgs: Record<string, unknown> = { ...rest };
  if (resolvedPrefix) {
    pluginArgs.folder_prefix = resolvedPrefix;
  }
  if (args.include_subfolders !== undefined) {
    pluginArgs.include_subfolders = args.include_subfolders;
  }
  return pluginArgs;
}

/** Common nest keys where gateways put the file row inside `result.data`. */
const DETAIL_NEST_KEYS = [
  'artifact',
  'file',
  'item',
  'detail',
  'record',
  'payload',
  'document',
  'meta',
];

/**
 * Normalize plugin.file_manager.detail execute responses.
 * Gateways differ: `result.data`, flattened `result`, nested `artifact`/`file`,
 * double-wrapped `result`, or list-shaped payloads.
 *
 * @param fallbackArtifactId - Requested `artifact_id` (always inject as `id` if payload omits it but is otherwise usable).
 */
function normalizeFileManagerDetailPayload(
  resData: unknown,
  fallbackArtifactId?: string
): FileManagerDetailResult {
  if (!resData || typeof resData !== 'object') {
    throw new Error('Invalid plugin.file_manager.detail response: empty body');
  }
  const root = resData as Record<string, unknown>;

  if (root.ok === false) {
    throw new Error(String(root.error ?? 'plugin.file_manager.detail reported ok=false'));
  }

  const result = root.result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (r.ok === false) {
      throw new Error(String(r.error ?? 'plugin.file_manager.detail inner ok=false'));
    }
  }

  const isDetailLike = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value.hasOwnProperty('id') ||
      value.hasOwnProperty('artifact_id') ||
      value.hasOwnProperty('plugins') ||
      value.hasOwnProperty('metadata') ||
      value.hasOwnProperty('security') ||
      value.hasOwnProperty('original_filename'));

  let data: Record<string, unknown> | undefined;

  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)) {
      data = { ...(r.data as Record<string, unknown>) };
    } else if (r.result && typeof r.result === 'object' && !Array.isArray(r.result)) {
      const nested = r.result as Record<string, unknown>;
      if (nested.ok === false) {
        throw new Error(String(nested.error ?? 'plugin.file_manager.detail nested inner ok=false'));
      }
      if (nested.data && typeof nested.data === 'object' && !Array.isArray(nested.data)) {
        data = { ...(nested.data as Record<string, unknown>) };
      } else if (isDetailLike(nested)) {
        data = { ...nested };
      }
    } else if (isDetailLike(r)) {
      data = { ...r };
    }
  }

  if (!data && root.data != null && typeof root.data === 'object' && !Array.isArray(root.data)) {
    data = { ...(root.data as Record<string, unknown>) };
  }

  if (!data && isDetailLike(root)) {
    data = { ...root };
  }

  if (!data || typeof data !== 'object') {
    console.warn('[StorageService] file_manager.detail: unparseable envelope (no object result.data or detail payload)', {
      rawSample: JSON.stringify(resData).slice(0, 2800),
    });
    throw new Error('Invalid plugin.file_manager.detail response: missing result.data');
  }

  // Work on a mutable plain object so TS does not infer circular types from repeated `data = { ...data, ... }`.
  let merged: Record<string, unknown> = { ...data };

  // Unwrap nested `result` layers some gateways add under `data`.
  for (let depth = 0; depth < 3; depth++) {
    const nestedResult: unknown = merged.result;
    if (!isPlainObject(nestedResult) || merged.id || merged.artifact_id) break;
    merged = { ...merged, ...nestedResult };
  }

  // Merge nested file/artifact blobs into the top-level detail object.
  for (const k of DETAIL_NEST_KEYS) {
    const nestedBlob: unknown = merged[k];
    if (isPlainObject(nestedBlob)) {
      merged = { ...merged, ...nestedBlob };
    }
  }

  // If payload is list-shaped, pick the row matching the requested artifact or the first object.
  if (!merged.id && !merged.artifact_id && !merged.file_id) {
    for (const v of Object.values(merged)) {
      if (!Array.isArray(v) || v.length === 0) continue;
      const firstObj = v.find((x) => isPlainObject(x));
      if (!isPlainObject(firstObj)) continue;
      const match =
        fallbackArtifactId &&
        v.find(
          (x) =>
            isPlainObject(x) &&
            ((x as Record<string, unknown>).id === fallbackArtifactId ||
              (x as Record<string, unknown>).artifact_id === fallbackArtifactId)
        );
      merged = { ...merged, ...(isPlainObject(match) ? match : firstObj) };
      break;
    }
  }

  const id = (merged.id ??
    merged.artifact_id ??
    merged.file_id ??
    fallbackArtifactId) as string | undefined;

  if (!id) {
    console.warn('[StorageService] file_manager.detail: payload still has no id', {
      keys: Object.keys(merged),
      rawSample: JSON.stringify(resData).slice(0, 2800),
    });
    throw new Error(
      'Invalid plugin.file_manager.detail response: missing id / artifact_id on payload'
    );
  }

  // artifact.metadata may be a JSON string (case-importer rows).
  if (typeof merged.metadata === 'string') {
    try {
      merged.metadata = JSON.parse(merged.metadata);
    } catch {
      /* keep raw string */
    }
  }

  const existingPlugins = Array.isArray(merged.plugins) ? (merged.plugins as PluginResult[]) : [];
  if (existingPlugins.length === 0 && merged.everywhere) {
    merged.plugins = extractPluginsFromEverywhere(merged.everywhere);
  }

  const plugins = (merged.plugins as PluginResult[] | undefined) ?? [];
  if (!merged.metadata || (typeof merged.metadata === 'object' && Object.keys(merged.metadata as object).length === 0)) {
    const metaRow = plugins.find((p) => p.plugin_id === 'file.meta');
    if (metaRow?.result) merged.metadata = metaRow.result;
  }
  if (!merged.security || (typeof merged.security === 'object' && Object.keys(merged.security as object).length === 0)) {
    const secureRow = plugins.find((p) => p.plugin_id === 'file.secure');
    if (secureRow?.result) merged.security = secureRow.result;
  }

  return { ...merged, id } as FileManagerDetailResult;
}

/** Infer MIME from filename extension when backend returns null mime_type. */
function inferMimeFromFilename(filename: string, mediaType?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    zip: 'application/zip',
    tar: 'application/x-tar',
  };
  if (ext && mimeMap[ext]) return mimeMap[ext];
  if (mediaType === 'image') return 'image/png';
  if (mediaType === 'video') return 'video/mp4';
  if (mediaType === 'audio') return 'audio/mpeg';
  if (mediaType === 'document') return 'application/pdf';
  if (mediaType === 'text') return 'text/plain';
  return 'application/octet-stream';
}

/** Normalize list response â€” backend nests pagination under `paging`. */
function normalizeFileManagerListResult(raw: Record<string, unknown>): FileManagerListResult {
  const paging = isPlainObject(raw.paging) ? raw.paging : {};
  const totals = isPlainObject(raw.totals) ? raw.totals : null;
  return {
    items: (Array.isArray(raw.items) ? raw.items : []) as FileManagerItem[],
    page: Number(paging.page ?? raw.page ?? 1),
    page_size: Number(paging.page_size ?? raw.page_size ?? 100),
    total_count: Number(
      paging.total_count ??
        raw.total_count ??
        totals?.count ??
        (Array.isArray(raw.items) ? raw.items.length : 0)
    ),
    totals_by_type: raw.totals_by_type as Record<string, FileManagerTotals> | undefined,
  };
}

function normalizeFacetBuckets(arr: unknown): FileManagerFacetBucket[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  return arr.map((item) => {
    if (!isPlainObject(item)) {
      return { value: String(item), count: 0 };
    }
    return {
      value: String(item.key ?? item.value ?? ''),
      count: Number(item.count ?? 0),
      bytes: item.bytes != null ? Number(item.bytes) : undefined,
    };
  });
}

function normalizeFacetsMediaType(raw: unknown): Record<string, FileManagerTotals> | undefined {
  if (isPlainObject(raw) && !Array.isArray(raw)) {
    return raw as Record<string, FileManagerTotals>;
  }
  if (!Array.isArray(raw)) return undefined;
  const record: Record<string, FileManagerTotals> = {};
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const key = String(item.key ?? item.value ?? '');
    if (!key) continue;
    record[key] = {
      count: Number(item.count ?? 0),
      bytes: Number(item.bytes ?? 0),
    };
  }
  return record;
}

/** Normalize facets â€” backend nests buckets under `facets` with array media_type. */
function normalizeFileManagerFacetsResult(raw: Record<string, unknown>): FileManagerFacetsResult {
  const facets = isPlainObject(raw.facets) ? raw.facets : raw;
  const totalRaw = raw.total ?? (isPlainObject(facets) ? facets.total : undefined);
  return {
    media_type: normalizeFacetsMediaType(facets.media_type ?? raw.media_type),
    mime_type: normalizeFacetBuckets(facets.mime_type ?? raw.mime_type),
    session_id: normalizeFacetBuckets(
      facets.sessions ?? facets.session_id ?? raw.session_id
    ),
    tags: normalizeFacetBuckets(facets.tags ?? raw.tags),
    total: isPlainObject(totalRaw)
      ? {
          count: Number(totalRaw.count ?? 0),
          bytes: Number(totalRaw.bytes ?? 0),
        }
      : undefined,
  };
}

/** Build plugins[] from detail.everywhere.postgres tool tables. */
function extractPluginsFromEverywhere(everywhere: unknown): FileManagerPluginResult[] {
  if (!isPlainObject(everywhere)) return [];
  const postgres = everywhere.postgres;
  if (!isPlainObject(postgres)) return [];

  const plugins: FileManagerPluginResult[] = [];
  for (const [tableName, tableData] of Object.entries(postgres)) {
    if (!tableName.startsWith('tool_') || !isPlainObject(tableData)) continue;
    const rows = tableData.rows;
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const firstRow = rows[0];
    if (!isPlainObject(firstRow)) continue;

    const pluginId =
      TOOL_TABLE_TO_PLUGIN[tableName] ??
      tableName.replace(/^tool_/, '').replace(/_/g, '.');

    const result =
      isPlainObject(firstRow.data) ? firstRow.data : (firstRow as Record<string, unknown>);

    plugins.push({
      plugin_id: pluginId,
      status: 'done',
      result,
      executed_at:
        typeof firstRow.created_at === 'string' ? firstRow.created_at : null,
    });
  }
  return plugins;
}

function deriveArtifactType(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('text/')) return 'text';
  if (
    m.includes('zip') ||
    m.includes('tar') ||
    m.includes('rar') ||
    m.includes('7z') ||
    m.includes('archive')
  ) {
    return 'archive';
  }
  return 'other';
}

/**
 * Map a plugin.file_manager.list item to the legacy Artifact shape used
 * by FileTable, FolderTree, and FileDetailPanel â€” so the UI layer does
 * not have to change when swapping data sources.
 *
 * NOTE: Folder path is not guaranteed by the list endpoint; when absent
 * we default to null (root) and rely on plugin.file_manager.folders for
 * tree population later.
 */
function mapPluginItemToArtifact(item: FileManagerItem): Artifact {
  // Defensive: backend may return null for mime_type / original_filename
  // for legacy rows. Downstream components (file-table, type-filter-chips)
  // call `.startsWith()` on mime_type, so null MUST be coerced to string.
  const filename = item.original_filename ?? `file-${item.id}`;
  const mime =
    item.mime_type ??
    inferMimeFromFilename(filename, item.media_type);
  const rawFolderPath = item.folder_path ?? item.virtual_dir ?? null;
  const normalizedFolderPath = rawFolderPath
    ? rawFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    : null;
  return {
    id: item.id,
    filename,
    mime_type: mime,
    file_size: item.file_size_bytes ?? 0,
    created_at: item.created_at,
    session_id: item.session_id ?? null,
    uploaded_by: item.uploaded_by ?? undefined,
    folder_path: normalizedFolderPath,
    artifact_type: deriveArtifactType(mime),
    media_type: item.media_type,
    access: item.access,
  };
}

/** Transcript segment for audio/video artifacts. */
export interface TranscriptSegment {
  start_sec: number;
  end_sec: number;
  text: string;
}

export interface ArtifactTranscript {
  artifact_id: string;
  language?: string;
  duration_sec?: number;
  segments: TranscriptSegment[];
  full_text?: string;
}

export interface WaveformPeaksResponse {
  artifact_id: string;
  duration_sec: number;
  bins: number;
  peaks: number[];
}

/** POST plugin execute and reject masked HTTP-200 error bodies (BE-CRIT-2). */
async function postPluginExecute<T>(url: string, body: unknown) {
  const res = await gatewayClient.post<T>(url, body);
  assertGatewayToolSuccess(res);
  return res;
}

export const storageService = {
  // ==========================================
  // Artifacts (Storage â€” /storage/artifacts/)
  // ==========================================

  /**
   * List artifacts with optional filtering and pagination.
   *
   * @endpoint GET /storage/artifacts
   * @param params.session_id - Filter by session
   * @param params.artifact_type - Filter by type: image | pdf | video | audio | archive | other
   * @param params.limit - Page size (default: 50)
   * @param params.offset - Start offset (default: 0)
   * @param params.search - Text search in filename
   * @returns Paginated list of artifacts
   * @throws {AxiosError} 401 if token invalid, 500 on server error
   */
  async listArtifacts(params?: ArtifactListParams): Promise<ArtifactListResponse> {
    console.info('[StorageService] Fetching artifacts:', { params });
    try {
      const res = await gatewayClient.get<ArtifactListResponse>('/storage/artifacts', { params });
      console.info('[StorageService] Artifacts fetched:', {
        total: res.data.total,
        count: res.data.items?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] Failed to fetch artifacts:', { params, error });
      throw error;
    }
  },

  /**
   * Get full artifact detail including metadata and security info.
   *
   * @endpoint GET /storage/artifacts/{artifact_id}
   * @param artifactId - Artifact UUID
   * @returns Full artifact detail with metadata + security fields
   * @throws {AxiosError} 404 if not found, 403 if not authorized
   */
  async getArtifact(artifactId: string): Promise<ArtifactDetail> {
    console.info('[StorageService] Fetching artifact detail:', { artifactId });
    try {
      const res = await gatewayClient.get<ArtifactDetail>(`/storage/artifacts/${artifactId}`);
      console.info('[StorageService] Artifact detail fetched:', {
        id: artifactId,
        filename: res.data.filename,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] Failed to fetch artifact detail:', { artifactId, error });
      throw error;
    }
  },

  /**
   * Delete an artifact by ID.
   *
   * @endpoint DELETE /storage/artifacts/{artifact_id}
   * @param artifactId - Artifact UUID to delete
   * @returns Deletion confirmation
   * @throws {AxiosError} 404 if not found, 403 if not authorized
   */
  /**
   * Delete artifact(s) via plugin.file_manager.batch (preferred).
   *
   * @endpoint POST /tools/plugin_file_manager_batch/execute
   */
  async runFileManagerBatch(args: FileManagerBatchArgs): Promise<FileManagerBatchResult> {
    const res = await postPluginExecute<ToolExecuteResponse<FileManagerBatchResult>>(
      '/tools/plugin_file_manager_batch/execute',
      { args }
    );
    const data = res.data?.result?.data ?? res.data?.result ?? {};
    return (typeof data === 'object' && data !== null
      ? data
      : { ok: true }) as FileManagerBatchResult;
  },

  async deleteArtifactsViaBatch(
    artifactIds: string[]
  ): Promise<FileManagerBatchResult> {
    if (artifactIds.length === 0) {
      return { ok: true, processed: 0 };
    }
    try {
      return await this.runFileManagerBatch({
        action: 'delete',
        artifact_ids: artifactIds,
      });
    } catch (error: unknown) {
      console.error('[StorageService] file_manager.batch delete failed:', {
        count: artifactIds.length,
        error,
      });
      throw error;
    }
  },

  /** @deprecated Use deleteArtifactsViaBatch */
  async deleteArtifact(artifactId: string): Promise<{ message: string; id: string }> {
    await this.deleteArtifactsViaBatch([artifactId]);
    return { message: 'deleted', id: artifactId };
  },

  /**
   * Public share download URL for browser-cached `<img src>` (no Bearer).
   */
  getShareDownloadUrl(token: string): string {
    return `/api/gateway/storage/shares/${encodeURIComponent(token)}/download`;
  },

  /**
   * Cached share token per artifact for grid thumbnails (15 min).
   * Uses shareTokenQueue to limit concurrent requests.
   */
  async getShareImageUrl(artifactId: string): Promise<string | null> {
    const cached = shareImageUrlCache.get(artifactId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
    try {
      const data = await shareTokenQueue.enqueue(
        `share-token:${artifactId}`,
        () => this.createShareToken(artifactId, 900)
      );
      if (!data?.token) return null;
      const url = this.getShareDownloadUrl(data.token);
      shareImageUrlCache.set(artifactId, {
        url,
        expiresAt: Date.now() + 840_000,
      });
      return url;
    } catch {
      return null;
    }
  },

  /**
   * Storage quota â€” deprecated endpoint; prefer facets.total from file_manager.
   */
  async getStorageQuota(): Promise<{
    used_bytes: number;
    quota_bytes: number;
    usage_percent: number;
    used_human?: string;
    quota_human?: string;
  } | null> {
    try {
      const res = await gatewayClient.get<{
        used_bytes: number;
        quota_bytes: number;
        usage_percent: number;
        used_human?: string;
        quota_human?: string;
      }>('/storage/storage/quota');
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Get artifact download URL (proxied through gateway).
   * Use mode=inline for browser preview, mode=attachment for download.
   *
   * **Do not** use the returned URL in `<a href>`, `<img src>`, or `window.open()` â€”
   * the gateway requires JWT and those navigations cannot send Authorization.
   * Use {@link fetchArtifactBlob} or {@link downloadArtifact} instead.
   *
   * @endpoint GET /storage/artifacts/{artifact_id}/download
   * @param artifactId - Artifact UUID
   * @param mode - 'inline' (preview) | 'attachment' (download)
   * @returns Gateway-proxied download URL for authenticated fetch only
   */
  getDownloadUrl(artifactId: string, mode: 'inline' | 'attachment' = 'attachment'): string {
    return `/api/gateway/storage/artifacts/${artifactId}/download?mode=${mode}`;
  },

  /**
   * Fetch an artifact as a Blob with JWT auth.
   *
   * Browser top-level navigations (`window.open`, `<a href>`) cannot attach an
   * Authorization header, so the gateway rejects them with AUTH_REQUIRED. This
   * fetches the bytes with the Bearer token (+ X-Group-Id) like thumbnails do.
   *
   * @endpoint GET /storage/artifacts/{artifact_id}/download
   */
  async fetchArtifactBlob(
    artifactId: string,
    mode: 'inline' | 'attachment' = 'attachment'
  ): Promise<Blob> {
    const headers = await this.getAuthHeaders();
    if (!headers.Authorization) {
      throw new Error('unauthorized');
    }
    const response = await fetch(this.getDownloadUrl(artifactId, mode), { headers });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    return response.blob();
  },

  /**
   * Download an artifact to the user's device with JWT auth.
   *
   * Fetches the file as an authenticated Blob and triggers a save via a
   * temporary object URL â€” the auth-safe replacement for
   * `window.open(getDownloadUrl(...))`.
   */
  async downloadArtifact(
    artifactId: string,
    filename?: string,
    mode: 'inline' | 'attachment' = 'attachment'
  ): Promise<void> {
    const blob = await this.fetchArtifactBlob(artifactId, mode);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },

  /**
   * Build auth headers for storage endpoints loaded outside axios (e.g. `<img>` blob fetch).
   * Mirrors chat preview â€” storage routes require Bearer + optional X-Group-Id.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      let session = await getSession();
      if (!session?.user?.accessToken) {
        for (const delay of [300, 600, 1100]) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          session = await getSession();
          if (session?.user?.accessToken) break;
        }
      }

      const token = session?.user?.accessToken;
      if (!token) {
        console.warn('[StorageService] No auth token available after retries');
        return {};
      }

      if ((session?.user as Record<string, unknown>)?.error === 'RefreshTokenExpired') {
        console.warn('[StorageService] Token refresh expired â€” cannot attach auth headers.');
        return {};
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const groups = (session?.user as Record<string, unknown>)?.groups;
      const groupId = resolveActiveGroupId(groups);
      if (groupId) {
        headers['X-Group-Id'] = groupId;
      }

      return headers;
    } catch (error: unknown) {
      console.warn('[StorageService] Failed to get auth token:', error);
      return {};
    }
  },

  /**
   * Fetch a storage URL as a blob URL with JWT auth.
   * Required because browser `<img src>` cannot send Authorization headers.
   *
   * @endpoint Any gateway-proxied GET (thumbnail, download inline, etc.)
   */
  async fetchAuthenticatedBlobUrl(url: string): Promise<string | null> {
    const cached = blobUrlCache.get(url);
    if (cached) return cached;
    if (failedBlobUrlCache.has(url)) return null;

    const inflight = inflightBlobFetches.get(url);
    if (inflight) return inflight;

    const run = () => this.fetchAuthenticatedBlobUrlOnce(url);
    const promise = isStoragePreviewFetchUrl(url)
      ? thumbnailQueue.enqueue(url, run)
      : run();

    const tracked = promise.then((result) => result);
    inflightBlobFetches.set(url, tracked);
    try {
      return await tracked;
    } finally {
      inflightBlobFetches.delete(url);
    }
  },

  async fetchAuthenticatedBlobUrlOnce(url: string): Promise<string | null> {
    try {
      const authHeaders = await this.getAuthHeaders();
      if (!authHeaders.Authorization) {
        logStorageFetchFailure('StorageService', url, 'unauthorized', 401);
        return null;
      }

      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) {
        const kind = classifyStorageHttpStatus(response.status);
        logStorageFetchFailure('StorageService', url, kind, response.status);
        if (kind === 'not_available') {
          failedBlobUrlCache.add(url);
        } else if (kind === 'rate_limited') {
          thumbnailQueue.pause(2500);
        }
        return null;
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(url, blobUrl);
      return blobUrl;
    } catch (error: unknown) {
      logStorageFetchFailure('StorageService', url, 'network');
      console.debug('[StorageService] Authenticated blob fetch error:', { url, error });
      return null;
    }
  },

  /**
   * Get optimized thumbnail URL for an image artifact.
   *
   * @endpoint GET /storage/files/{artifact_id}/thumbnail
   * @see documents/file_manager_frontend_guide.md Â§6
   */
  getThumbnailUrl(
    artifactId: string,
    width = 200,
    height = width,
    format: 'webp' | 'jpeg' | 'png' = 'webp',
    quality = 80,
    mimeType?: string,
    mediaType?: string
  ): string | null {
    if (!supportsStorageThumbnailEndpoint(mimeType, mediaType)) return null;

    const w = Math.max(32, Math.min(800, Math.round(width)));
    const h = Math.max(32, Math.min(800, Math.round(height)));
    return `/api/gateway/storage/files/${artifactId}/thumbnail?width=${w}&height=${h}&format=${format}&quality=${quality}`;
  },

  /**
   * PDF (and similar) preview â€” first page as binary stream.
   *
   * @endpoint GET /storage/files/{artifact_id}/preview?page=1
   */
  getPreviewUrl(artifactId: string, page = 1): string {
    const p = Math.max(1, Math.round(page));
    return `/api/gateway/storage/files/${artifactId}/preview?page=${p}`;
  },

  /**
   * Presigned MinIO URL for streaming (video/audio with Range requests).
   *
   * @endpoint GET /storage/files/{artifact_id}/presigned-url
   */
  getPresignedUrl(artifactId: string, expiresSec = 3600): string {
    const exp = Math.max(60, Math.min(86400, Math.round(expiresSec)));
    return `/api/gateway/storage/files/${artifactId}/presigned-url?expires=${exp}`;
  },

  /**
   * Full transcript for an audio/video artifact.
   *
   * @endpoint GET /storage/files/{artifact_id}/transcript
   */
  async fetchArtifactTranscript(artifactId: string): Promise<ArtifactTranscript> {
    const res = await gatewayClient.get<ArtifactTranscript>(
      `/storage/files/${artifactId}/transcript`
    );
    return res.data;
  },

  /**
   * Chapter markers for video player advanced mode.
   *
   * @endpoint GET /storage/files/{artifact_id}/chapters
   */
  async fetchArtifactChapters(artifactId: string): Promise<
    Array<{ id: string; title: string; start: number; end?: number; thumbnailUrl?: string }>
  > {
    try {
      const res = await gatewayClient.get<{
        chapters: Array<{
          id: string;
          title: string;
          start_sec: number;
          end_sec?: number;
          thumbnail_url?: string;
        }>;
      }>(`/storage/files/${artifactId}/chapters`);
      return (res.data.chapters ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        start: c.start_sec,
        end: c.end_sec,
        thumbnailUrl: c.thumbnail_url,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Subtitle/caption tracks for video player.
   *
   * @endpoint GET /storage/files/{artifact_id}/subtitles
   */
  async fetchArtifactSubtitles(artifactId: string): Promise<
    Array<{
      id: string;
      label: string;
      language: string;
      src?: string;
      kind?: 'subtitles' | 'captions';
      default?: boolean;
    }>
  > {
    try {
      const res = await gatewayClient.get<{
        tracks: Array<{
          id: string;
          label: string;
          language: string;
          kind?: string;
          url: string;
          default?: boolean;
        }>;
      }>(`/storage/files/${artifactId}/subtitles`);
      return (res.data.tracks ?? []).map((track) => ({
        id: track.id,
        label: track.label,
        language: track.language,
        src: track.url,
        kind: (track.kind as 'subtitles' | 'captions') ?? 'subtitles',
        default: track.default,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Filmstrip sprite sheet for advanced timeline (404 â†’ FE offscreen sampler fallback).
   *
   * @endpoint GET /storage/files/{artifact_id}/filmstrip
   */
  async fetchArtifactFilmstrip(
    artifactId: string,
    intervalSec = 10,
    width = 160
  ): Promise<{
    spriteUrl: string;
    tileWidth: number;
    tileHeight: number;
    intervalSec: number;
    tileCount: number;
  } | null> {
    try {
      const res = await gatewayClient.get<{
        sprite_url: string;
        tile_width: number;
        tile_height: number;
        interval_sec: number;
        tile_count: number;
      }>(`/storage/files/${artifactId}/filmstrip`, {
        params: {
          interval_sec: Math.max(1, Math.round(intervalSec)),
          width: Math.max(80, Math.min(320, Math.round(width))),
        },
      });
      const data = res.data;
      if (!data?.sprite_url) return null;
      return {
        spriteUrl: data.sprite_url,
        tileWidth: data.tile_width,
        tileHeight: data.tile_height,
        intervalSec: data.interval_sec,
        tileCount: data.tile_count,
      };
    } catch {
      return null;
    }
  },

  /**
   * Precomputed waveform peaks for fast mini-waveform render.
   *
   * @endpoint GET /storage/files/{artifact_id}/waveform-peaks
   */
  async fetchWaveformPeaks(artifactId: string, bins = 128): Promise<WaveformPeaksResponse> {
    const res = await gatewayClient.get<WaveformPeaksResponse>(
      `/storage/files/${artifactId}/waveform-peaks`,
      { params: { bins: Math.max(16, Math.min(512, bins)) } }
    );
    return res.data;
  },

  CHUNKED_UPLOAD_THRESHOLD_BYTES: 10 * 1024 * 1024,
  CHUNK_UPLOAD_SIZE_BYTES: 5 * 1024 * 1024,

  async uploadFileSmart(
    file: File,
    sessionId?: string,
    folderPath?: string,
    onProgress?: (percent: number) => void
  ): Promise<UploadResponse> {
    if (file.size >= this.CHUNKED_UPLOAD_THRESHOLD_BYTES) {
      return this.uploadFileChunked(file, sessionId, folderPath, onProgress);
    }
    return this.uploadFiles([file], sessionId, folderPath);
  },

  async uploadFileChunked(
    file: File,
    sessionId?: string,
    folderPath?: string,
    onProgress?: (percent: number) => void
  ): Promise<UploadResponse> {
    const chunkSize = this.CHUNK_UPLOAD_SIZE_BYTES;
    const initRes = await gatewayClient.post<{
      upload_id: string;
      chunk_size?: number;
    }>('/storage/upload/init', {
      filename: file.name,
      total_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      session_id: sessionId,
      folder_path: folderPath,
    });
    const uploadId = initRes.data.upload_id;
    const totalChunks = Math.ceil(file.size / chunkSize);
    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const slice = file.slice(start, end);
      await gatewayClient.put(
        `/storage/upload/${uploadId}/chunk/${index}`,
        slice,
        {
          headers: { 'Content-Type': 'application/octet-stream' },
        }
      );
      onProgress?.(Math.round(((index + 1) / totalChunks) * 100));
    }
    const completeRes = await gatewayClient.post<UploadResponse>(
      `/storage/upload/${uploadId}/complete`,
      {
        filename: file.name,
        session_id: sessionId,
        folder_path: folderPath,
      }
    );
    return completeRes.data;
  },

  /**
   * Upload one or more files to storage.
   *
   * @endpoint POST /storage/upload
   */
  async uploadFiles(
    files: File[],
    sessionId?: string,
    folderPath?: string
  ): Promise<UploadResponse> {
    console.info('[StorageService] Uploading files:', {
      count: files.length,
      sessionId,
      folderPath,
    });
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (sessionId) formData.append('session_id', sessionId);
      if (folderPath) formData.append('folder_path', folderPath);

      const res = await gatewayClient.post<UploadResponse>('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.info('[StorageService] Upload complete:', {
        uploaded: res.data.uploaded?.length,
        failed: res.data.failed?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] Upload failed:', { count: files.length, error });
      throw error;
    }
  },

  /**
   * Search artifacts by text query.
   *
   * @endpoint POST /storage/search
   * @param query - Search text
   * @param limit - Max results (default: 20)
   * @returns Search results
   * @throws {AxiosError} 422 on invalid query
   */
  async searchArtifacts(query: string, limit = 20): Promise<ArtifactListResponse> {
    console.info('[StorageService] Searching artifacts:', { query, limit });
    try {
      const formData = new FormData();
      const res = await gatewayClient.post<ArtifactListResponse>(
        `/storage/search?query=${encodeURIComponent(query)}&limit=${limit}`,
        formData
      );
      console.info('[StorageService] Search complete:', {
        query,
        total: res.data.total,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] Search failed:', { query, error });
      throw error;
    }
  },

  // ==========================================
  // Stats (âš ï¸ Backend NOT available yet)
  // Required endpoint: GET /storage/artifacts/stats
  // See: documents/backend-requests/FILE_EXPLORER_BACKEND_REQUIREMENTS_v0.39.0.md
  // ==========================================

  /**
   * Get storage statistics summary.
   *
   * âš ï¸ Backend NOT available â€” endpoint GET /storage/artifacts/stats not implemented yet.
   * Component using this must show "Backend Not Available" banner if this throws.
   *
   * @endpoint GET /storage/artifacts/stats
   * @returns Storage statistics by file type
   * @throws {AxiosError} 404 if endpoint not implemented yet
   */
  async getStorageStats(): Promise<StorageStats> {
    console.info('[StorageService] Fetching storage stats...');
    try {
      const res = await gatewayClient.get<StorageStats>('/storage/artifacts/stats');
      console.info('[StorageService] Storage stats fetched:', {
        total_files: res.data.total_files,
        total_size: res.data.total_size,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] Failed to fetch storage stats:', error);
      throw error;
    }
  },

  // ==========================================
  // Processing Detail (âš ï¸ Backend NOT available yet)
  // Required endpoint: GET /storage/artifacts/{id}/processing
  // See: documents/backend-requests/FILE_EXPLORER_BACKEND_REQUIREMENTS_v0.39.0.md
  // ==========================================

  /**
   * Get full processing detail for an artifact.
   *
   * âš ï¸ Backend NOT available â€” endpoint GET /storage/artifacts/{id}/processing not implemented yet.
   * Component using this must show "Backend Not Available" banner if this throws.
   *
   * @endpoint GET /storage/artifacts/{artifact_id}/processing
   * @param artifactId - Artifact UUID
   * @returns Full plugin processing results
   * @throws {AxiosError} 404 if endpoint not implemented yet
   */
  async getProcessingDetail(artifactId: string): Promise<ArtifactProcessingDetail> {
    console.info('[StorageService] Fetching processing detail:', { artifactId });
    try {
      const res = await gatewayClient.get<ArtifactProcessingDetail>(
        `/storage/artifacts/${artifactId}/processing`
      );
      console.info('[StorageService] Processing detail fetched:', {
        artifactId,
        plugins: res.data.plugins?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] Failed to fetch processing detail:', { artifactId, error });
      throw error;
    }
  },

  // ==========================================
  // File Manager Plugin (API Gateway Tools)
  // Unified view that returns every file the user can access
  // (own + group + override). Replaces direct /storage/artifacts for
  // the File Explorer, because that endpoint only returned standalone
  // uploads and hid files created via chat / case-importer flows.
  //
  // Auth: JWT Bearer; the gateway overrides `user_id` from the token,
  //       so any user_id sent in args is ignored by backend.
  //
  // See: documents/file_manager_frontend_guide (2).md
  // ==========================================

  /**
   * List files via the file_manager plugin (raw response).
   *
   * Preferred over `listArtifacts()` for the File Explorer because it:
   *  - resolves owner + group + per-user overrides server-side
   *  - includes files uploaded from chat, case importer, tools, etc.
   *  - supports `ownership` (any | owner | shared) and `include_stats`
   *
   * @endpoint POST /tools/plugin.file_manager.list/execute
   * @param args - Pagination, sort, filters, and ownership scope
   * @returns Raw plugin payload (result.data)
   * @throws {AxiosError} 401 if token invalid, 403 if tool permission missing
   */
  async listFilesViaPlugin(
    args: FileManagerListArgs = {}
  ): Promise<FileManagerListResult> {
    const body = {
      args: {
        page: 1,
        page_size: 100,
        sort_by: 'created_at' as const,
        sort_dir: 'desc' as const,
        ownership: 'any' as const,
        include_stats: false,
        ...buildFileManagerListPluginArgs(args),
      },
    };
    console.info('[StorageService] file_manager.list:', { args: body.args });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<FileManagerListResult>
      >('/tools/plugin_file_manager_list/execute', body);

      const raw = res.data?.result?.data;
      if (!raw || !Array.isArray(raw.items)) {
        console.error('[StorageService] file_manager.list invalid payload:', {
          response: res.data,
        });
        throw new Error('Invalid response from plugin.file_manager.list');
      }
      const data = normalizeFileManagerListResult(raw as unknown as Record<string, unknown>);
      console.info('[StorageService] file_manager.list fetched:', {
        total: data.total_count,
        count: data.items.length,
        page: data.page,
      });
      return data;
    } catch (error: unknown) {
      console.error('[StorageService] file_manager.list failed:', { args, error });
      throw error;
    }
  },

  /**
   * List files for the File Explorer UI.
   *
   * Wraps `listFilesViaPlugin()` and adapts each item to the legacy
   * `Artifact` shape so existing components (FileTable, FolderTree,
   * FileDetailPanel) keep working unchanged.
   *
   * @param args - Plugin args (pagination, filters, ownership, stats)
   * @returns Items in Artifact shape + pagination + optional totals
   */
  async listFilesForExplorer(args: FileManagerListArgs = {}): Promise<{
    items: Artifact[];
    total: number;
    page: number;
    page_size: number;
    totals_by_type?: Record<string, FileManagerTotals>;
  }> {
    const data = await this.listFilesViaPlugin(args);
    return {
      items: data.items.map(mapPluginItemToArtifact),
      total: data.total_count,
      page: data.page,
      page_size: data.page_size,
      totals_by_type: data.totals_by_type,
    };
  },

  /**
   * Get facet counts for filter UI (chips, sidebar dropdowns).
   *
   * Returns counts grouped by media_type, mime, session, and tags.
   * Use this to populate Type Filter Chips with real backend totals
   * instead of computing them from the page-local artifact set.
   *
   * @endpoint POST /tools/plugin.file_manager.facets/execute
   * @param args - Optional filters and bucket-size limits
   * @returns Facet buckets and grand totals
   * @throws {AxiosError} 401 / 403 on auth failure
   */
  async getFileManagerFacets(
    args: FileManagerFacetsArgs = {}
  ): Promise<FileManagerFacetsResult> {
    const body = {
      args: {
        top_mimes: 10,
        top_tags: 10,
        top_sessions: 10,
        ...args,
      },
    };
    console.info('[StorageService] file_manager.facets:', { args: body.args });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<FileManagerFacetsResult>
      >('/tools/plugin_file_manager_facets/execute', body);
      const raw = res.data?.result?.data;
      if (!raw || typeof raw !== 'object') {
        throw new Error('Invalid response from plugin.file_manager.facets');
      }
      const data = normalizeFileManagerFacetsResult(raw as Record<string, unknown>);
      console.info('[StorageService] file_manager.facets fetched:', {
        media_types: data.media_type ? Object.keys(data.media_type).length : 0,
        mimes: data.mime_type?.length ?? 0,
        total: data.total?.count,
      });
      return data;
    } catch (error: unknown) {
      console.error('[StorageService] file_manager.facets failed:', { args, error });
      throw error;
    }
  },

  /**
   * List sub-folders under a given prefix (S3-like browsing).
   *
   * Use this to populate the FolderTree with the full hierarchy that
   * the user can access â€” independent of the current page of files.
   *
   * @endpoint POST /tools/plugin.file_manager.folders/execute
   * @param args - prefix/delimiter + pagination
   * @returns Folder buckets with file counts
   * @throws {AxiosError} 401 / 403 on auth failure
   */
  async getFileManagerFolders(
    args: FileManagerFoldersArgs = {}
  ): Promise<FileManagerFoldersResult> {
    const body = {
      args: {
        prefix: '',
        delimiter: '/',
        limit: 200,
        offset: 0,
        ownership: 'any' as const,
        ...args,
      },
    };
    console.info('[StorageService] file_manager.folders:', { args: body.args });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<FileManagerFoldersResult>
      >('/tools/plugin_file_manager_folders/execute', body);
      const data = res.data?.result?.data;
      if (!data || !Array.isArray(data.folders)) {
        throw new Error('Invalid response from plugin.file_manager.folders');
      }
      console.info('[StorageService] file_manager.folders fetched:', {
        prefix: body.args.prefix,
        count: data.folders.length,
      });
      return data;
    } catch (error: unknown) {
      console.error('[StorageService] file_manager.folders failed:', { args, error });
      throw error;
    }
  },

  /**
   * Get full detail for a single file (Right Panel tabs).
   *
   * Replaces `getArtifact()` for the File Explorer because this returns
   * a unified, access-checked view including metadata, security, and
   * processing â€” without needing the (still-pending) backend endpoint
   * GET /storage/artifacts/{id}/processing.
   *
   * @endpoint POST /tools/plugin.file_manager.detail/execute
   * @param args - artifact_id and optional share/thumbnail params
   * @returns Full file detail
   * @throws {AxiosError} 401 / 403 / 404 (file not accessible)
   */
  async getFileManagerDetail(
    args: FileManagerDetailArgs
  ): Promise<FileManagerDetailResult> {
    // Keep args minimal â€” some gateways validate unknown fields; share_* only when caller opts in.
    const body = {
      args: {
        thumbnail_width: 200,
        thumbnail_height: 200,
        ...args,
      },
    };
    console.info('[StorageService] file_manager.detail:', {
      artifact_id: body.args.artifact_id,
    });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<FileManagerDetailResult>
      >('/tools/plugin_file_manager_detail/execute', body);
      const data = normalizeFileManagerDetailPayload(res.data, args.artifact_id);
      console.info('[StorageService] file_manager.detail fetched:', {
        artifact_id: data.id,
        has_metadata: !!data.metadata,
        has_security: !!data.security,
        plugins: data.plugins?.length ?? 0,
      });
      return data;
    } catch (error: unknown) {
      const ax = isAxiosError(error);
      console.error('[StorageService] file_manager.detail failed:', {
        artifact_id: args.artifact_id,
        status: ax ? error.response?.status : undefined,
        responseData: ax ? error.response?.data : undefined,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      throw error;
    }
  },

  /**
   * Adapter â€” convert plugin.file_manager.detail payload to the legacy
   * `ArtifactDetail` shape used by FileDetailPanel tabs (Info / Meta /
   * Security / Processing).
   *
   * @param d - Raw plugin detail payload
   * @returns ArtifactDetail-shaped object plus optional `plugins` and `share`
   */
  toArtifactDetail(
    d: FileManagerDetailResult
  ): ArtifactDetail & {
    plugins?: FileManagerDetailResult['plugins'];
    share?: FileManagerDetailResult['share'];
  } {
    const filename = d.original_filename ?? `file-${d.id}`;
    const mime =
      d.mime_type ??
      inferMimeFromFilename(filename, d.media_type);
    return {
      id: d.id,
      filename,
      mime_type: mime,
      file_size: d.file_size_bytes ?? 0,
      created_at: d.created_at ?? '',
      session_id: d.session_id ?? null,
      uploaded_by: d.uploaded_by ?? undefined,
      folder_path: d.folder_path ?? null,
      artifact_type: deriveArtifactType(mime),
      media_type: d.media_type,
      access: d.access,
      metadata: d.metadata,
      security: d.security,
      plugins: d.plugins,
      share: d.share,
    };
  },

  /**
   * Create a short-lived public share token for a file.
   *
   * The returned token can be used in `<img>` / `<a>` tags via the
   * gateway's public route (no Bearer needed): `/storage/shares/{token}/...`.
   *
   * @endpoint POST /tools/plugin.file_manager.share/execute  (action=create)
   * @param artifactId - File to share
   * @param expiresSec - Token lifetime in seconds (default: 900 = 15min)
   * @returns Token + gateway-relative paths
   * @throws {AxiosError} 401 / 403 / 404
   */
  async createShareToken(
    artifactId: string,
    expiresSec = 900
  ): Promise<FileManagerShareResult> {
    const body = {
      args: {
        action: 'create' as const,
        artifact_id: artifactId,
        expires_sec: expiresSec,
        // Validator requires the field even on create â€” pass empty string.
        token: '',
      } satisfies FileManagerShareArgs,
    };
    console.info('[StorageService] file_manager.share create:', {
      artifact_id: artifactId,
      expires_sec: expiresSec,
    });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<FileManagerShareResult>
      >('/tools/plugin_file_manager_share/execute', body);
      const raw =
        unwrapToolExecuteData<FileManagerShareResult>(res.data) ??
        res.data?.result?.data;
      const data = normalizeFileManagerShareResult(raw);
      if (!data?.token) {
        throw new Error('Invalid response from plugin.file_manager.share');
      }
      console.info('[StorageService] file_manager.share created:', {
        token_prefix: data.token.slice(0, 8) + 'â€¦',
      });
      return data;
    } catch (error: unknown) {
      if (isRateLimitedError(error)) {
        shareTokenQueue.pause(3000);
      }
      console.error('[StorageService] file_manager.share create failed:', {
        artifact_id: artifactId,
        error,
      });
      throw error;
    }
  },

  /**
   * Revoke a previously-created share token.
   *
   * @endpoint POST /tools/plugin.file_manager.share/execute  (action=revoke)
   * @param token - Share token to invalidate
   * @returns Plugin response (`revoked: true` on success)
   * @throws {AxiosError} 401 / 403 / 404
   */
  async revokeShareToken(token: string): Promise<FileManagerShareResult> {
    const body = {
      args: {
        action: 'revoke' as const,
        token,
        artifact_id: '',
        expires_sec: 0,
      } satisfies FileManagerShareArgs,
    };
    console.info('[StorageService] file_manager.share revoke:', {
      token_prefix: token.slice(0, 8) + 'â€¦',
    });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<FileManagerShareResult>
      >('/tools/plugin_file_manager_share/execute', body);
      console.info('[StorageService] file_manager.share revoked');
      const raw =
        unwrapToolExecuteData<FileManagerShareResult>(res.data) ??
        res.data?.result?.data;
      return normalizeFileManagerShareResult(raw) ?? { revoked: true };
    } catch (error: unknown) {
      console.error('[StorageService] file_manager.share revoke failed:', { error });
      throw error;
    }
  },

  /**
   * List tools that have run (or are applicable) for an artifact.
   *
   * @endpoint POST /tools/plugin_file_manager_tools_for_artifact/execute
   */
  async getToolsForArtifact(artifactId: string): Promise<FileManagerToolStatus[]> {
    console.info('[StorageService] file_manager.tools_for_artifact:', { artifactId });
    try {
      const res = await postPluginExecute<
        ToolExecuteResponse<{ tools?: FileManagerToolStatus[] }>
      >('/tools/plugin_file_manager_tools_for_artifact/execute', {
        args: { artifact_id: artifactId },
      });
      const tools = res.data?.result?.data?.tools ?? [];
      console.info('[StorageService] file_manager.tools_for_artifact fetched:', {
        artifactId,
        count: tools.length,
      });
      return tools;
    } catch (error: unknown) {
      console.warn('[StorageService] file_manager.tools_for_artifact failed:', {
        artifactId,
        error,
      });
      return [];
    }
  },

  // ==========================================
  // Run-Analysis (generic plugin executor)
  // ==========================================

  /**
   * Run any plugin/tool against a file. Used by the Right Panel "Run
   * Analysis" buttons in the Processing tab.
   *
   * @endpoint POST /tools/{tool_id}/execute
   * @param toolId - e.g. "file.identify", "file.meta", "file.secure"
   * @param artifactId - Target artifact
   * @param extraArgs - Optional plugin-specific args
   * @returns Raw tool execute envelope
   * @throws {AxiosError} 401 / 403 / 404 / 422
   */
  async runArtifactAnalysis(
    toolId: string,
    artifactId: string,
    extraArgs: Record<string, unknown> = {}
  ): Promise<ToolExecuteResponse<unknown>> {
    // Tool-runner validates `path` for file.* plugins. Storage artifacts use the artifact UUID
    // as the logical path (same as chat uploads). Callers may override via extraArgs.path (e.g. virtual prefix).
    const path =
      typeof extraArgs.path === 'string' && extraArgs.path.trim().length > 0
        ? extraArgs.path.trim()
        : artifactId;
    const body = { args: { artifact_id: artifactId, ...extraArgs, path } };
    console.info('[StorageService] runArtifactAnalysis:', { toolId, artifactId, path });
    try {
      const res = await postPluginExecute<ToolExecuteResponse<unknown>>(
        toolExecutePath(toolId),
        body
      );
      console.info('[StorageService] runArtifactAnalysis done:', {
        toolId,
        ok: res.data?.ok ?? res.data?.result?.ok,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[StorageService] runArtifactAnalysis failed:', {
        toolId,
        artifactId,
        error,
      });
      throw error;
    }
  },
};

