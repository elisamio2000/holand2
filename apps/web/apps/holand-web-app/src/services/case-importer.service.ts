// ============================================
// Holand Case Importer Service
// Handles case import operations: folder import, review, embed, store
// Backend: Case Importer Service (10.7.0.7:8007 â†’ internal 8006)
// Gateway: 10.7.0.7:8000 (/import/*)
// ============================================

import { getSession } from 'next-auth/react';

import { gatewayClient } from '@/lib/api-client';
import { resolveActiveGroupId } from '@/lib/workspace-group-id';
import { withGateway429Retry } from '@/lib/gateway-retry';
import {
  mapRequestToolAllowlist,
  toBackendToolAllowlist,
  toBackendToolId,
  toUiToolAllowlist,
  toUiToolId,
} from '@/utils/case-importer-tool-ids';

import type {
  ImportFolderRequest,
  ReviewFilesRequest,
  AnalyzeFilesRequest,
  ImportResponse,
  CaseListResponse,
  CaseListQueryParams,
  CaseStatusResponse,
  CaseDetail,
  QueueStatusResponse,
  QueuePositionResponse,
  EmbedPreviewResponse,
  UploadFilesResponse,
  MultiFolderImportRequest,
  StagingSessionCreateRequest,
  StagingSessionResponse,
  StagingRegisterFileRequest,
  StagingFileResponse,
  StagingSessionStatusResponse,
  FromStagingImportRequest,
  FromStagingBatchRequest,
  ImportToolsResponse,
  CaseImporterPrefsResponse,
  CaseImporterPrefsBody,
  BackendToolInfo,
  ImportToolInfo,
} from '@/types/case-importer.types';

/** Normalize backend preferences payload to UI-facing tool IDs. */
function normalizePrefsResponse(
  data: CaseImporterPrefsResponse
): CaseImporterPrefsResponse {
  return {
    ...data,
    tool_allowlist: toUiToolAllowlist(data.tool_allowlist),
  };
}

/**
 * Active workspace group_id from session + localStorage selection.
 * Gateway requires group_id when the user belongs to multiple groups.
 */
async function getSessionGroupId(): Promise<string | undefined> {
  try {
    const session = await getSession();
    const groups = (session?.user as Record<string, unknown>)?.groups;
    return resolveActiveGroupId(groups);
  } catch {
    return undefined;
  }
}

export const caseImporterService = {
  // ==========================================
  // File Upload (Gateway â€” /upload)
  // ==========================================

  /** Upload timeout: 5 minutes for large files */
  UPLOAD_TIMEOUT: 5 * 60 * 1000,

  /**
   * Upload files to the Storage Service via API Gateway.
   * Files are stored on the server and can then be used as `folder_path`
   * for the Case Importer.
   *
   * @endpoint POST /upload
   * @param files - Array of File objects from file input
   * @param sessionId - Optional session ID for grouping uploaded files
   * @param onProgress - Progress callback (0-100 percentage)
   * @returns UploadFilesResponse with saved artifacts including storage_path
   * @throws {AxiosError} 401 if unauthorized
   * @throws {AxiosError} 413 if file too large
   */
  async uploadFiles(
    files: File[],
    sessionId?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadFilesResponse> {
    console.info('[CaseImporterService] Uploading files:', {
      count: files.length,
      names: files.map((f) => f.name),
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
    });
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (sessionId) {
        formData.append('session_id', sessionId);
      }

      // âš ï¸ Do NOT set Content-Type manually for FormData â€” Axios auto-detects it
      // and appends the correct multipart boundary. Setting it explicitly can
      // cause boundary mismatches when proxied through Next.js API routes.
      const res = await gatewayClient.post<UploadFilesResponse>('/upload', formData, {
        timeout: this.UPLOAD_TIMEOUT,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percent);
          }
        },
      });

      console.info('[CaseImporterService] Files uploaded:', {
        count: res.data.count ?? res.data.saved?.length ?? 0,
        saved: res.data.saved?.map((s) => s.storage_path),
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Upload failed:', {
        fileCount: files.length,
        error,
      });
      throw error;
    }
  },

  /**
   * Extract artifacts array from upload response for use with /import/analyze.
   * Maps saved artifacts to the format expected by AnalyzeFilesRequest.
   *
   * @param response - Upload response from uploadFiles()
   * @returns Array of artifact objects with storage_path, original_filename, etc.
   */
  extractArtifacts(response: UploadFilesResponse): Record<string, unknown>[] {
    const saved = response.saved ?? response.artifacts ?? [];
    if (saved.length === 0) return [];

    return saved.map((artifact) => ({
      id: artifact.id,
      storage_path: artifact.storage_path ?? artifact.path,
      original_filename: artifact.original_filename ?? artifact.name ?? artifact.filename,
      mime_type: artifact.mime_type ?? artifact.media_type,
      file_size_bytes: artifact.file_size_bytes ?? artifact.size,
    }));
  },

  /**
   * Import files that were uploaded via browser (artifacts-based flow).
   *
   * Unlike importFolder() which scans a server filesystem directory,
   * this method uses the /import/analyze endpoint which accepts
   * artifacts directly â€” perfect for browser-uploaded files stored in MinIO.
   *
   * Flow: analyze (Phase 1) â†’ embed (Phase 2) â†’ store (Phase 3)
   *
   * @param artifacts - Array of artifact objects from upload response
   * @param caseName - Name for the case
   * @param options - Optional session_id, user_id, group_id
   * @param runFullPipeline - If true, runs all 3 phases; if false, only Phase 1
   * @returns Object with case_id and message
   * @throws {AxiosError} 422 if validation fails
   */
  async importViaArtifacts(
    artifacts: Record<string, unknown>[],
    caseName: string,
    options?: {
      session_id?: string;
      group_id?: string;
      tool_allowlist?: string[] | null;
    },
    runFullPipeline: boolean = true
  ): Promise<{ case_id: string; message: string }> {
    console.info('[CaseImporterService] Importing via artifacts:', {
      artifacts_count: artifacts.length,
      case_name: caseName,
      full_pipeline: runFullPipeline,
      tool_allowlist: options?.tool_allowlist,
    });

    try {
      // Phase 1: Analyze files using artifacts-based endpoint
      // NOTE: user_id is NOT sent in the body â€” Gateway injects it via X-User-Id header
      const analyzeResult = await this.analyzeFiles(
        mapRequestToolAllowlist({
          artifacts,
          case_name: caseName,
          session_id: options?.session_id,
          group_id: options?.group_id,
          tool_allowlist: options?.tool_allowlist,
        })
      );

      const caseId = (analyzeResult.case_id as string) ?? '';
      if (!caseId) {
        console.error('[CaseImporterService] No case_id in analyze response:', analyzeResult);
        throw new Error('Analysis completed but no case_id was returned');
      }

      console.info('[CaseImporterService] Phase 1 (analyze) completed:', { caseId });

      if (runFullPipeline) {
        // Phase 2: Embed
        try {
          await this.embedCase(caseId);
          console.info('[CaseImporterService] Phase 2 (embed) completed:', { caseId });
        } catch (embedErr: unknown) {
          console.warn('[CaseImporterService] Phase 2 (embed) failed, case still created:', {
            caseId,
            error: embedErr,
          });
          // Don't throw â€” case is created, user can retry embed from detail page
        }

        // Phase 3: Store
        try {
          await this.storeCase(caseId);
          console.info('[CaseImporterService] Phase 3 (store) completed:', { caseId });
        } catch (storeErr: unknown) {
          console.warn('[CaseImporterService] Phase 3 (store) failed, case still created:', {
            caseId,
            error: storeErr,
          });
          // Don't throw â€” case is created, user can retry store from detail page
        }
      }

      return {
        case_id: caseId,
        message: runFullPipeline
          ? 'Import completed (analyze â†’ embed â†’ store)'
          : 'Analysis completed. You can trigger embed and store from the case detail page.',
      };
    } catch (error: unknown) {
      console.error('[CaseImporterService] Import via artifacts failed:', {
        artifacts_count: artifacts.length,
        case_name: caseName,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Import â€” Full Pipeline (Case Importer â€” /import/folder)
  // ==========================================

  /**
   * Start async import of a folder â€” runs all 3 phases (review â†’ embed â†’ store).
   * Returns immediately with a queue position. Processing happens in background.
   *
   * @endpoint POST /import/folder
   * @param request - Import configuration (folder_path, case_name required)
   * @returns ImportResponse with case_id and queue position message
   * @throws {AxiosError} 400 if folder path is invalid
   * @throws {AxiosError} 422 if validation fails
   */
  async importFolder(request: ImportFolderRequest): Promise<ImportResponse> {
    const body = mapRequestToolAllowlist({ ...request });
    // âš ï¸ Gateway requires group_id when user belongs to multiple groups
    if (!body.group_id) {
      body.group_id = await getSessionGroupId();
    }
    console.info('[CaseImporterService] Starting async import:', {
      folder_path: body.folder_path,
      case_name: body.case_name,
      group_id: body.group_id,
    });
    try {
      const res = await gatewayClient.post<ImportResponse>('/import/folder', body);
      console.info('[CaseImporterService] Import queued:', {
        case_id: res.data.case_id,
        message: res.data.message,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Import failed:', {
        folder_path: request.folder_path,
        error,
      });
      throw error;
    }
  },

  /**
   * Start sync import of a folder â€” waits until all 3 phases complete.
   * Suitable for small folders only. May timeout for large imports.
   *
   * @endpoint POST /import/folder/sync
   * @param request - Import configuration (folder_path, case_name required)
   * @returns Full result object after all phases complete
   * @throws {AxiosError} 400 if folder path is invalid
   * @throws {AxiosError} 422 if validation fails
   */
  async importFolderSync(request: ImportFolderRequest): Promise<Record<string, unknown>> {
    const body = mapRequestToolAllowlist({ ...request });
    // âš ï¸ Gateway requires group_id when user belongs to multiple groups
    if (!body.group_id) {
      body.group_id = await getSessionGroupId();
    }
    console.info('[CaseImporterService] Starting sync import:', {
      folder_path: body.folder_path,
      case_name: body.case_name,
      group_id: body.group_id,
    });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        '/import/folder/sync',
        body
      );
      console.info('[CaseImporterService] Sync import completed:', {
        case_name: request.case_name,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Sync import failed:', {
        folder_path: request.folder_path,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Phase 1: Review / Analyze (Case Importer â€” /import/review, /import/analyze)
  // ==========================================

  /**
   * Phase 1: Review and analyze files in a folder.
   * Scans folder â†’ detects tools â†’ runs batch analysis â†’ saves state.
   * Does NOT run embedding or store phases.
   *
   * @endpoint POST /import/review
   * @param request - Review configuration (folder_path, case_name required)
   * @returns Analysis result object
   * @throws {AxiosError} 422 if validation fails
   */
  async reviewFiles(request: ReviewFilesRequest): Promise<Record<string, unknown>> {
    const body = mapRequestToolAllowlist({ ...request });
    // âš ï¸ Gateway requires group_id when user belongs to multiple groups
    if (!body.group_id) {
      body.group_id = await getSessionGroupId();
    }
    console.info('[CaseImporterService] Starting file review:', {
      folder_path: body.folder_path,
      case_name: body.case_name,
      force: body.force,
      group_id: body.group_id,
    });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        '/import/review',
        body
      );
      console.info('[CaseImporterService] Review completed:', {
        case_name: request.case_name,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Review failed:', {
        folder_path: request.folder_path,
        error,
      });
      throw error;
    }
  },

  /**
   * Analyze files â€” backward compatibility endpoint.
   * Prefer reviewFiles() for new implementations.
   *
   * @endpoint POST /import/analyze
   * @param request - Analyze request with artifacts array
   * @returns Analysis result object
   * @throws {AxiosError} 422 if validation fails
   */
  async analyzeFiles(request: AnalyzeFilesRequest): Promise<Record<string, unknown>> {
    // âš ï¸ Build a clean request body â€” only include defined fields.
    // Gateway Pydantic model rejects unknown fields (user_id is injected via header).
    const body: Record<string, unknown> = {
      artifacts: request.artifacts,
    };
    if (request.case_name) body.case_name = request.case_name;
    if (request.case_id) body.case_id = request.case_id;
    if (request.session_id) body.session_id = request.session_id;

    // âš ï¸ Gateway requires group_id when user belongs to multiple groups.
    // If not explicitly provided, auto-resolve from the user's session.
    const groupId = request.group_id || (await getSessionGroupId());
    if (groupId) body.group_id = groupId;

    // âš ï¸ Send tool_allowlist so backend only runs the tools the user selected in Settings.
    // If null/undefined, backend falls back to running all tools.
    if (request.tool_allowlist !== undefined && request.tool_allowlist !== null) {
      body.tool_allowlist = toBackendToolAllowlist(request.tool_allowlist);
    }

    console.info('[CaseImporterService] Analyzing files:', {
      case_name: request.case_name,
      artifacts_count: request.artifacts.length,
      body_keys: Object.keys(body),
    });
    console.debug('[CaseImporterService] Analyze request body:', JSON.stringify(body, null, 2));

    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        '/import/analyze',
        body
      );
      console.info('[CaseImporterService] Analysis completed:', {
        case_name: request.case_name,
        response_keys: Object.keys(res.data),
      });
      return res.data;
    } catch (error: unknown) {
      // Log the full error response body for debugging
      const axiosErr = error as { response?: { data?: unknown; status?: number } };
      console.error('[CaseImporterService] Analysis failed:', {
        status: axiosErr.response?.status,
        response_data: axiosErr.response?.data,
        body_sent: body,
      });
      throw error;
    }
  },

  // ==========================================
  // Phase 2: Embed (Case Importer â€” /import/embed/)
  // ==========================================

  /**
   * Run embedding phase for a case.
   * Generates vector embeddings from analysis results.
   *
   * @endpoint POST /import/{case_id}/embed
   * @param caseId - Case ID to embed
   * @returns Embedding result object
   * @throws {AxiosError} 404 if case not found
   * @throws {AxiosError} 422 if validation fails
   */
  async embedCase(caseId: string): Promise<Record<string, unknown>> {
    console.info('[CaseImporterService] Starting embedding:', { caseId });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        `/import/${encodeURIComponent(caseId)}/embed`
      );
      console.info('[CaseImporterService] Embedding completed:', { caseId });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Embedding failed:', { caseId, error });
      throw error;
    }
  },

  /**
   * Preview the embedding plan before execution.
   * Shows what tasks will be performed without actually running them.
   *
   * @endpoint GET /import/embed/preview/{case_id}
   * @param caseId - Case ID to preview
   * @returns Preview of embedding tasks
   * @throws {AxiosError} 404 if case not found
   */
  async getEmbedPreview(caseId: string): Promise<EmbedPreviewResponse> {
    console.info('[CaseImporterService] Getting embed preview:', { caseId });
    try {
      const res = await gatewayClient.get<EmbedPreviewResponse>(
        `/import/embed/preview/${encodeURIComponent(caseId)}`
      );
      console.info('[CaseImporterService] Embed preview loaded:', {
        caseId,
        task_count: res.data.task_count,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Embed preview failed:', { caseId, error });
      throw error;
    }
  },

  // ==========================================
  // Phase 3: Store (Case Importer â€” /import/store/)
  // ==========================================

  /**
   * Run storage phase for a case.
   * Stores metadata in PostgreSQL, raw data in MongoDB, vectors in Qdrant.
   *
   * @endpoint POST /import/{case_id}/store
   * @param caseId - Case ID to store
   * @returns Storage result object
   * @throws {AxiosError} 404 if case not found
   * @throws {AxiosError} 422 if validation fails
   */
  async storeCase(caseId: string): Promise<Record<string, unknown>> {
    console.info('[CaseImporterService] Starting storage:', { caseId });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        `/import/${encodeURIComponent(caseId)}/store`
      );
      console.info('[CaseImporterService] Storage completed:', { caseId });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Storage failed:', { caseId, error });
      throw error;
    }
  },

  // ==========================================
  // Status & Detail (Case Importer â€” /import/status, /import/detail, /import/list)
  // ==========================================

  /**
   * Get lightweight status of a case import.
   * Includes queue position and estimated wait time.
   *
   * @endpoint GET /import/status/{case_id}
   * @param caseId - Case ID to check
   * @returns Status response with progress and queue info
   * @throws {AxiosError} 404 if case not found
   */
  async getImportStatus(caseId: string): Promise<CaseStatusResponse> {
    console.info('[CaseImporterService] Fetching status:', { caseId });
    try {
      const res = await gatewayClient.get<CaseStatusResponse>(
        `/import/status/${encodeURIComponent(caseId)}`
      );
      console.info('[CaseImporterService] Status loaded:', {
        caseId,
        status: res.data.status,
        progress: res.data.progress,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Status fetch failed:', { caseId, error });
      throw error;
    }
  },

  /**
   * Get full detail of a case including all files, tool results, and logs.
   *
   * @endpoint GET /import/detail/{case_id}
   * @param caseId - Case ID to retrieve
   * @returns Complete case detail with files and logs
   * @throws {AxiosError} 404 if case not found
   */
  async getCaseDetail(caseId: string): Promise<CaseDetail> {
    console.info('[CaseImporterService] Fetching case detail:', { caseId });
    try {
      const res = await gatewayClient.get<CaseDetail>(
        `/import/detail/${encodeURIComponent(caseId)}`
      );
      console.info('[CaseImporterService] Detail loaded:', {
        caseId,
        status: res.data.status,
        files: res.data.files_total,
        logs: res.data.logs?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Detail fetch failed:', { caseId, error });
      throw error;
    }
  },

  /**
   * List cases. Pass query params when BR-1 server pagination is available;
   * backward compatible when called with no args.
   *
   * @endpoint GET /import/list
   */
  async listCases(params?: CaseListQueryParams): Promise<CaseListResponse> {
    console.info('[CaseImporterService] Fetching case list...', params ?? {});
    try {
      const res = await withGateway429Retry(
        () =>
          gatewayClient.get<CaseListResponse>('/import/list', {
            params: params
              ? {
                  page: params.page,
                  page_size: params.page_size,
                  status: params.status === 'all' ? undefined : params.status,
                  q: params.q,
                  sort: params.sort,
                  order: params.order,
                }
              : undefined,
          }),
        'listCases'
      );
      console.info('[CaseImporterService] Case list loaded:', {
        count: res.data.count,
        page: res.data.page,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] List fetch failed:', error);
      throw error;
    }
  },

  // ==========================================
  // Case Lifecycle Controls (pause / resume / cancel active job)
  // ==========================================

  /** @endpoint POST /import/{case_id}/pause */
  async pauseCase(caseId: string): Promise<Record<string, unknown>> {
    const res = await gatewayClient.post<Record<string, unknown>>(
      `/import/${encodeURIComponent(caseId)}/pause`
    );
    return res.data;
  },

  /** @endpoint POST /import/{case_id}/resume */
  async resumeCase(caseId: string): Promise<Record<string, unknown>> {
    const res = await gatewayClient.post<Record<string, unknown>>(
      `/import/${encodeURIComponent(caseId)}/resume`
    );
    return res.data;
  },

  /** @endpoint POST /import/{case_id}/cancel â€” cancel an active import (not queue-only) */
  async cancelActiveImport(caseId: string): Promise<Record<string, unknown>> {
    const res = await gatewayClient.post<Record<string, unknown>>(
      `/import/${encodeURIComponent(caseId)}/cancel`
    );
    return res.data;
  },

  /**
   * Re-run analyze phase for an existing case after a failed/partial import.
   *
   * @endpoint POST /import/{case_id}/re-analyze
   * @param caseId - Case ID to re-analyze
   * @returns Operation result
   * @throws {AxiosError} 404 if case not found
   */
  async reAnalyzeCase(caseId: string): Promise<Record<string, unknown>> {
    console.info('[CaseImporterService] Re-analyzing case:', { caseId });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        `/import/${encodeURIComponent(caseId)}/re-analyze`
      );
      console.info('[CaseImporterService] Re-analyze started:', { caseId });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Re-analyze failed:', { caseId, error });
      throw error;
    }
  },

  /**
   * Official frontend integration guide from backend.
   * @endpoint GET /import/frontend-flow
   */
  async getFrontendFlow(): Promise<Record<string, unknown>> {
    const res = await gatewayClient.get<Record<string, unknown>>('/import/frontend-flow');
    return res.data;
  },

  /**
   * WebSocket endpoint discovery for import realtime channels.
   * @endpoint GET /import/ws-info
   */
  async getWsInfo(): Promise<Record<string, unknown>> {
    const res = await gatewayClient.get<Record<string, unknown>>('/import/ws-info');
    return res.data;
  },

  /**
   * Lightweight probes for case-importer gateway endpoints used by dev requirements panel.
   *
   * NOTE:
   * - 404 and 5xx are treated as unavailable.
   * - 4xx (except 404) is treated as available because route exists but request was rejected.
   *
   * @endpoint GET /import/queue/status
   * @endpoint GET /import/tools
   * @endpoint GET /import/preferences
   * @endpoint GET /import/ws-info
   * @endpoint GET /import/frontend-flow
   * @returns Availability flags for key case-importer endpoints
   */
  async probeApiHealth(): Promise<{
    queueStatus: 'available' | 'unavailable';
    toolsCatalog: 'available' | 'unavailable';
    preferences: 'available' | 'unavailable';
    wsInfo: 'available' | 'unavailable';
    frontendFlow: 'available' | 'unavailable';
  }> {
    console.info('[CaseImporterService] Probing case-importer API health...');
    const probe = async (
      fn: () => Promise<unknown>
    ): Promise<'available' | 'unavailable'> => {
      try {
        await fn();
        return 'available';
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 404 || (typeof status === 'number' && status >= 500)) {
          return 'unavailable';
        }
        return 'available';
      }
    };

    const [queueStatus, toolsCatalog, preferences, wsInfo, frontendFlow] =
      await Promise.all([
        probe(() => gatewayClient.get('/import/queue/status')),
        probe(() => gatewayClient.get('/import/tools')),
        probe(() => gatewayClient.get('/import/preferences')),
        probe(() => gatewayClient.get('/import/ws-info')),
        probe(() => gatewayClient.get('/import/frontend-flow')),
      ]);

    console.info('[CaseImporterService] API health probe completed:', {
      queueStatus,
      toolsCatalog,
      preferences,
      wsInfo,
      frontendFlow,
    });

    return {
      queueStatus,
      toolsCatalog,
      preferences,
      wsInfo,
      frontendFlow,
    };
  },

  // ==========================================
  // Delete (Case Importer â€” /import/{case_id})
  // ==========================================

  /**
   * Delete a case and all associated data.
   *
   * @endpoint DELETE /import/{case_id}
   * @param caseId - Case ID to delete
   * @returns Deletion result
   * @throws {AxiosError} 404 if case not found
   */
  async deleteCase(caseId: string): Promise<Record<string, unknown>> {
    console.info('[CaseImporterService] Deleting case:', { caseId });
    try {
      const res = await gatewayClient.delete<Record<string, unknown>>(
        `/import/${encodeURIComponent(caseId)}`
      );
      console.info('[CaseImporterService] Case deleted:', { caseId });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Delete failed:', { caseId, error });
      throw error;
    }
  },

  // ==========================================
  // Queue (Case Importer â€” /import/queue/)
  // ==========================================

  /**
   * Get overall queue status including active and pending jobs.
   *
   * @endpoint GET /import/queue/status
   * @param options.signal - Optional abort signal for cancelling stale requests
   * @returns Queue status with active/queued job lists
   */
  async getQueueStatus(options?: {
    signal?: AbortSignal;
  }): Promise<QueueStatusResponse> {
    console.info('[CaseImporterService] Fetching queue status...');
    try {
      const res = await gatewayClient.get<QueueStatusResponse>('/import/queue/status', {
        signal: options?.signal,
      });
      console.info('[CaseImporterService] Queue status:', {
        queue_size: res.data.queue_size,
        active_count: res.data.active_count,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Queue status failed:', error);
      throw error;
    }
  },

  /**
   * Get position of a specific case in the import queue.
   *
   * @endpoint GET /import/queue/position/{case_id}
   * @param caseId - Case ID to check
   * @returns Queue position and estimated wait time
   * @throws {AxiosError} 404 if case not found in queue
   */
  async getQueuePosition(caseId: string): Promise<QueuePositionResponse> {
    console.info('[CaseImporterService] Fetching queue position:', { caseId });
    try {
      const res = await gatewayClient.get<QueuePositionResponse>(
        `/import/queue/position/${encodeURIComponent(caseId)}`
      );
      console.info('[CaseImporterService] Queue position:', {
        caseId,
        position: res.data.position,
        status: res.data.status,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Queue position failed:', { caseId, error });
      throw error;
    }
  },

  /**
   * Cancel a queued import job.
   * Only works for jobs still in the queue (not active).
   *
   * @endpoint POST /import/queue/cancel/{case_id}
   * @param caseId - Case ID to cancel
   * @returns Cancellation result
   * @throws {AxiosError} 404 if case not found in queue
   */
  async cancelQueuedJob(caseId: string): Promise<Record<string, unknown>> {
    console.info('[CaseImporterService] Cancelling queued job:', { caseId });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        `/import/queue/cancel/${encodeURIComponent(caseId)}`
      );
      console.info('[CaseImporterService] Job cancelled:', { caseId });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Cancel failed:', { caseId, error });
      throw error;
    }
  },

  // ==========================================
  // Batch Operations (Case Importer â€” /import/folders/batch)
  // ==========================================

  /**
   * Batch import multiple server folders â€” each becomes a separate case.
   * All imports are queued and processed asynchronously.
   *
   * @endpoint POST /import/folders/batch
   * @param request - Batch import configuration
   * @returns Array of case IDs or error details
   * @throws {AxiosError} 400 if any folder path is invalid
   */
  async importFoldersBatch(
    request: MultiFolderImportRequest
  ): Promise<Record<string, unknown>> {
    const body = mapRequestToolAllowlist({ ...request });
    // âš ï¸ Gateway requires group_id when user belongs to multiple groups
    if (!body.group_id) {
      body.group_id = await getSessionGroupId();
    }
    console.info('[CaseImporterService] Starting batch import:', {
      folder_count: body.folders.length,
      group_id: body.group_id,
    });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        '/import/folders/batch',
        body
      );
      console.info('[CaseImporterService] Batch import queued:', {
        folder_count: body.folders.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Batch import failed:', {
        folder_count: body.folders?.length ?? 0,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Staging Upload System (Case Importer â€” /import/staging/*)
  // Resumable chunked upload protocol for large files
  // ==========================================

  /**
   * Create a new staging upload session.
   * Session is used to group multiple file uploads before importing them.
   *
   * @endpoint POST /import/staging/session
   * @param request - Optional session ID and metadata
   * @returns Session ID and confirmation
   * @throws {AxiosError} 400 if session_id conflicts
   */
  async createStagingSession(
    request?: StagingSessionCreateRequest
  ): Promise<StagingSessionResponse> {
    console.info('[CaseImporterService] Creating staging session:', { request });
    try {
      const res = await gatewayClient.post<StagingSessionResponse>(
        '/import/staging/session',
        request || {}
      );
      console.info('[CaseImporterService] Staging session created:', {
        session_id: res.data.session_id,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Staging session creation failed:', {
        request,
        error,
      });
      throw error;
    }
  },

  /**
   * Get status of a staging session including all registered files.
   *
   * @endpoint GET /import/staging/{session_id}/status
   * @param sessionId - Staging session ID
   * @returns Session status with file list
   * @throws {AxiosError} 404 if session not found
   */
  async getStagingSessionStatus(
    sessionId: string
  ): Promise<StagingSessionStatusResponse> {
    console.info('[CaseImporterService] Fetching staging session status:', {
      sessionId,
    });
    try {
      const res = await gatewayClient.get<StagingSessionStatusResponse>(
        `/import/staging/${sessionId}/status`
      );
      const raw = res.data;
      const files = raw.files ?? [];
      const totalFiles = raw.file_count ?? raw.total_files ?? files.length;
      const completedFiles =
        raw.all_complete === true
          ? totalFiles
          : (raw.completed_files ??
            files.filter((file) => file.complete === true).length);
      const normalized: StagingSessionStatusResponse = {
        ...raw,
        files,
        total_files: totalFiles,
        completed_files: completedFiles,
        all_complete: raw.all_complete ?? (totalFiles > 0 && completedFiles >= totalFiles),
      };
      console.info('[CaseImporterService] Staging session status loaded:', {
        sessionId,
        total_files: normalized.total_files,
        completed_files: normalized.completed_files,
        all_complete: normalized.all_complete,
      });
      return normalized;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Staging session status failed:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  /**
   * Register a file in the staging session before uploading chunks.
   * This is similar to TUS "Create" operation.
   *
   * @endpoint POST /import/staging/{session_id}/files
   * @param sessionId - Staging session ID
   * @param request - File metadata (file_id, filename, file_size, etc.)
   * @returns File registration confirmation with current offset
   * @throws {AxiosError} 400 if file_id already exists
   */
  async registerStagingFile(
    sessionId: string,
    request: StagingRegisterFileRequest
  ): Promise<StagingFileResponse> {
    console.info('[CaseImporterService] Registering staging file:', {
      sessionId,
      relative_path: request.relative_path,
      upload_length: request.upload_length,
    });
    try {
      const res = await gatewayClient.post<StagingFileResponse>(
        `/import/staging/${sessionId}/files`,
        request
      );
      console.info('[CaseImporterService] Staging file registered:', {
        sessionId,
        relative_path: request.relative_path,
        offset: res.data.offset,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Staging file registration failed:', {
        sessionId,
        relative_path: request.relative_path,
        error,
      });
      throw error;
    }
  },

  /**
   * Get current upload offset for a file (for resume support).
   * Use HEAD method for lightweight check, GET for full file info.
   *
   * @endpoint HEAD /import/staging/{session_id}/files/{file_id}
   * @endpoint GET /import/staging/{session_id}/files/{file_id}
   * @param sessionId - Staging session ID
   * @param fileId - File ID
   * @param useHead - If true, uses HEAD request (default: true for resume check)
   * @returns Current offset in Upload-Offset header or response body
   * @throws {AxiosError} 404 if file not found
   */
  async getStagingFileInfo(
    sessionId: string,
    fileId: string,
    useHead: boolean = true
  ): Promise<{ offset: number; complete?: boolean }> {
    console.info('[CaseImporterService] Fetching staging file info:', {
      sessionId,
      fileId,
      method: useHead ? 'HEAD' : 'GET',
    });
    try {
      if (useHead) {
        // HEAD request â€” offset is in Upload-Offset header
        const res = await gatewayClient.head(
          `/import/staging/${sessionId}/files/${fileId}`
        );
        const offset = parseInt(res.headers['upload-offset'] || '0', 10);
        console.info('[CaseImporterService] Staging file offset (HEAD):', {
          sessionId,
          fileId,
          offset,
        });
        return { offset };
      } else {
        // GET request â€” full file info in body
        const res = await gatewayClient.get<{
          offset: number;
          complete: boolean;
          [key: string]: unknown;
        }>(`/import/staging/${sessionId}/files/${fileId}`);
        console.info('[CaseImporterService] Staging file info (GET):', {
          sessionId,
          fileId,
          offset: res.data.offset,
          complete: res.data.complete,
        });
        return {
          offset: res.data.offset,
          complete: res.data.complete,
        };
      }
    } catch (error: unknown) {
      console.error('[CaseImporterService] Staging file info failed:', {
        sessionId,
        fileId,
        error,
      });
      throw error;
    }
  },

  /**
   * Upload a chunk of file data.
   * Uses PUT method with Upload-Offset header (TUS protocol).
   *
   * @endpoint PUT /import/staging/{session_id}/files/{file_id}
   * @param sessionId - Staging session ID
   * @param fileId - File ID
   * @param offset - Byte offset where this chunk starts
   * @param chunk - Chunk data (Blob or ArrayBuffer)
   * @param onProgress - Progress callback (optional)
   * @returns Updated offset after chunk upload
   * @throws {AxiosError} 409 if offset mismatch
   */
  async uploadFileChunk(
    sessionId: string,
    fileId: string,
    offset: number,
    chunk: Blob | ArrayBuffer,
    onProgress?: (progress: number) => void
  ): Promise<{ offset: number }> {
    console.info('[CaseImporterService] Uploading file chunk:', {
      sessionId,
      fileId,
      offset,
      chunk_size: chunk instanceof Blob ? chunk.size : chunk.byteLength,
    });
    try {
      const res = await gatewayClient.put(
        `/import/staging/${sessionId}/files/${fileId}`,
        chunk,
        {
          headers: {
            'Upload-Offset': offset.toString(),
            'Content-Type': 'application/offset+octet-stream',
          },
          timeout: this.UPLOAD_TIMEOUT,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total && onProgress) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(percent);
            }
          },
        }
      );
      const newOffset = parseInt(res.headers['upload-offset'] || '0', 10);
      console.info('[CaseImporterService] Chunk uploaded:', {
        sessionId,
        fileId,
        old_offset: offset,
        new_offset: newOffset,
      });
      return { offset: newOffset };
    } catch (error: unknown) {
      console.error('[CaseImporterService] Chunk upload failed:', {
        sessionId,
        fileId,
        offset,
        error,
      });
      throw error;
    }
  },

  /**
   * Delete a staging session and all its files.
   * Use this to clean up after successful import or to cancel upload.
   *
   * @endpoint DELETE /import/staging/{session_id}
   * @param sessionId - Staging session ID to delete
   * @returns Deletion confirmation
   * @throws {AxiosError} 404 if session not found
   */
  async deleteStagingSession(
    sessionId: string
  ): Promise<Record<string, unknown>> {
    console.info('[CaseImporterService] Deleting staging session:', { sessionId });
    try {
      const res = await gatewayClient.delete<Record<string, unknown>>(
        `/import/staging/${sessionId}`
      );
      console.info('[CaseImporterService] Staging session deleted:', { sessionId });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Staging session deletion failed:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  /**
   * Import files from a completed staging session.
   * This creates a new case from the uploaded files.
   *
   * @endpoint POST /import/from-staging
   * @param request - Import configuration (session_id, case_name, optional root_path)
   * @returns Import response with case_id
   * @throws {AxiosError} 404 if session not found
   * @throws {AxiosError} 400 if files not complete
   */
  async importFromStaging(
    request: FromStagingImportRequest
  ): Promise<ImportResponse> {
    const body = mapRequestToolAllowlist({ ...request });
    // âš ï¸ Gateway requires group_id when user belongs to multiple groups
    if (!body.group_id) {
      body.group_id = await getSessionGroupId();
    }
    console.info('[CaseImporterService] Importing from staging:', {
      staging_id: body.staging_id,
      case_name: body.case_name,
      group_id: body.group_id,
    });
    try {
      const res = await gatewayClient.post<ImportResponse>(
        '/import/from-staging',
        body
      );
      console.info('[CaseImporterService] Import from staging queued:', {
        case_id: res.data.case_id,
        message: res.data.message,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Import from staging failed:', {
        staging_id: request.staging_id,
        error,
      });
      throw error;
    }
  },

  /**
   * Batch import multiple root paths from the same staging session.
   * Each root path becomes a separate case.
   *
   * @endpoint POST /import/from-staging/batch
   * @param request - Batch configuration (staging_id, roots array)
   * @returns Batch import result with case IDs
   * @throws {AxiosError} 404 if session not found
   */
  async importFromStagingBatch(
    request: FromStagingBatchRequest
  ): Promise<Record<string, unknown>> {
    const body = mapRequestToolAllowlist({ ...request });
    // âš ï¸ Gateway requires group_id when user belongs to multiple groups
    if (!body.group_id) {
      body.group_id = await getSessionGroupId();
    }
    console.info('[CaseImporterService] Batch import from staging:', {
      staging_id: body.staging_id,
      root_count: body.roots.length,
      group_id: body.group_id,
    });
    try {
      const res = await gatewayClient.post<Record<string, unknown>>(
        '/import/from-staging/batch',
        body
      );
      console.info('[CaseImporterService] Batch import from staging completed:', {
        staging_id: request.staging_id,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Batch import from staging failed:', {
        staging_id: request.staging_id,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Preferences & Tools (Case Importer â€” /import/tools, /import/preferences)
  // ==========================================

  /**
   * Get list of all available import tools.
   * This is the backend's catalog of processing tools/plugins.
   *
   * **Backend Format**: Returns tools as object dictionary, not array.
   * This method transforms it to array format for consistency.
   *
   * @endpoint GET /import/tools
   * @returns List of all import tools (transformed to array)
   * @throws {AxiosError} 401 if unauthorized
   */
  async getImportTools(): Promise<ImportToolsResponse> {
    console.info('[CaseImporterService] Fetching import tools...');
    try {
      const res = await gatewayClient.get<ImportToolsResponse>('/import/tools');
      
      // Log raw response structure for debugging
      console.info('[CaseImporterService] Raw tools response:', {
        ok: res.data.ok,
        count: res.data.count,
        toolsType: Array.isArray(res.data.tools) ? 'array' : typeof res.data.tools,
        toolsKeys: Array.isArray(res.data.tools) 
          ? `${res.data.tools.length} items` 
          : Object.keys(res.data.tools || {}).length + ' keys',
      });

      // Transform object dictionary to array; map backend IDs â†’ UI IDs for component state
      if (res.data.tools && !Array.isArray(res.data.tools)) {
        const toolsArray: ImportToolInfo[] = Object.entries(
          res.data.tools as Record<string, BackendToolInfo>
        ).map(([backendId, info]) => ({
          tool_id: toUiToolId(backendId),
          backend_tool_id: backendId,
          name: backendId.replace(/_/g, ' '),
          description: info.description,
          category: info.category,
          default_enabled: info.enabled,
          version: info.version,
          channels: info.channels,
        }));

        console.info('[CaseImporterService] Transformed tools object to array:', {
          originalKeys: Object.keys(res.data.tools).length,
          transformedCount: toolsArray.length,
        });

        return {
          ok: res.data.ok,
          count: res.data.count || toolsArray.length,
          tools: toolsArray,
        };
      }

      if (Array.isArray(res.data.tools)) {
        const toolsArray = res.data.tools.map((tool: ImportToolInfo) => ({
          ...tool,
          tool_id: toUiToolId(tool.tool_id),
          backend_tool_id: tool.backend_tool_id ?? toBackendToolId(tool.tool_id),
        }));
        return { ...res.data, tools: toolsArray };
      }

      console.info('[CaseImporterService] Import tools loaded:', {
        count: res.data.count ?? res.data.total ?? 0,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[CaseImporterService] Import tools fetch failed:', error);
      throw error;
    }
  },

  /**
   * Get current user's import tool preferences.
   * Returns which tools are enabled/disabled for this user.
   *
   * @endpoint GET /import/preferences
   * @returns User preferences with tool allowlist
   * @throws {AxiosError} 401 if unauthorized
   */
  async getUserPreferences(): Promise<CaseImporterPrefsResponse> {
    console.info('[CaseImporterService] Fetching user preferences...');
    try {
      const res = await gatewayClient.get<CaseImporterPrefsResponse>(
        '/import/preferences'
      );
      const normalized = normalizePrefsResponse(res.data);
      console.info('[CaseImporterService] User preferences loaded:', {
        user_id: normalized.user_id,
        tool_allowlist: normalized.tool_allowlist,
      });
      return normalized;
    } catch (error: unknown) {
      console.error('[CaseImporterService] User preferences fetch failed:', error);
      throw error;
    }
  },

  /**
   * Update current user's import tool preferences.
   * Sets which tools should run during import.
   *
   * @endpoint PUT /import/preferences
   * @param body - Preferences update (tool_allowlist: null = defaults, [] = none, ["id"] = specific)
   * @returns Updated preferences
   * @throws {AxiosError} 422 if validation fails
   */
  async updateUserPreferences(
    body: CaseImporterPrefsBody
  ): Promise<CaseImporterPrefsResponse> {
    console.info('[CaseImporterService] Updating user preferences:', {
      tool_allowlist: body.tool_allowlist,
    });
    try {
      const payload: CaseImporterPrefsBody = {
        tool_allowlist: toBackendToolAllowlist(body.tool_allowlist) ?? null,
      };
      const res = await gatewayClient.put<CaseImporterPrefsResponse>(
        '/import/preferences',
        payload
      );
      const normalized = normalizePrefsResponse(res.data);
      console.info('[CaseImporterService] User preferences updated:', {
        user_id: normalized.user_id,
        tool_allowlist: normalized.tool_allowlist,
      });
      return normalized;
    } catch (error: unknown) {
      console.error('[CaseImporterService] User preferences update failed:', {
        body,
        error,
      });
      throw error;
    }
  },
};

