// ============================================
// Holand Chat Service
// API calls for AI Chat (Gateway :8000)
// Endpoints: /chat, /chat/stream, /chat/sessions
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { resolveActiveGroupId } from '@/lib/workspace-group-id';
import { debugLog } from '@/utils/debug-logger';
import {
  classifyStorageHttpStatus,
  logStorageFetchFailure,
  supportsStorageThumbnailEndpoint,
} from '@/utils/storage-media-url';
import { inferMimeForUpload, inferMimeForUpload as inferMimeType } from '@/utils/mime-utils';
import { normalizeStorageToolRun as normalizeStorageToolRunUtil, normalizeToolCallsToRuns, normalizeDoneEventToolRuns } from '@/utils/normalize-tool-run';
import {
  findChatOrchestratorRoute,
  parseAdminLlmModelsPayload,
  parseAdminLlmRoutesPayload,
  resolveChatPluginModel,
  mergeChatModelLists,
  parseGatewayModelsList,
  CHAT_ORCHESTRATOR_ROUTE_KEY,
} from '@/utils/chat-models-resolve';
import type {
  ChatRequest,
  ChatResponse,
  ChatSession,
  ChatMessage,
  SessionCreateRequest,
  SessionUpdateRequest,
  StreamEvent,
  ModelInfo,
  ChatModelsSnapshot,
  UploadResponse,
  FeedbackRequest,
  ArtifactInput,
  ToolInfo,
  MemoryEntry,
  StorageArtifact,
  FileUploadProgress,
  ExportFormat,
  ShareSessionResponse,
  ShareExpiryHours,
  ShareSessionWithUsersRequest,
  ShareSessionWithUsersResponse,
  SessionShareRecipient,
  SharedWithMeSession,
  PublicShareResolveResponse,
  PublicShareMessage,
  ChatSessionFolder,
  ChatSearchRequest,
  ChatSearchHit,
  ForkSessionResponse,
  ChatProject,
  ChatImportResult,
  StorageQuota,
  FileMetadata,
  FileAnalysisResult,
  FilePreviewData,
  PresignedUrlResponse,
  ChunkedUploadInitRequest,
  ChunkedUploadInitResponse,
  ChunkedUploadChunkResponse,
  ChunkedUploadCompleteResponse,
  ChunkedUploadStatusResponse,
  StorageToolRun,
  MessagesWithToolRunsResponse,
  ToolRunInfo,
  ToolCallItem,
  ToolResultItem,
  ThinkingStep,
  SuggestionItem,
  WarningItem,
  ExecutionPlan,
  OrchestratorNodeName,
} from '@/types/chat.types';
import { getSession } from 'next-auth/react';

const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL || process.env.API_GATEWAY_URL || '';

// ⚠️ Browser requests MUST go through the Next.js proxy (/api/gateway)
// to avoid CORS issues and ensure cookies/headers are forwarded correctly.
// Server-side can call the backend directly (no CORS in server-to-server).
// Exception: SSE streaming (/chat/stream) bypasses the proxy because the
// proxy cannot handle long-lived streaming responses efficiently.
const STORAGE_BASE_URL =
  typeof window !== 'undefined'
    ? '/api/gateway' // Browser: same-origin proxy
    : API_GATEWAY_URL; // Server: direct

// ============================================
// In-session blob URL cache
// Prevents re-fetching the same authenticated file multiple times
// within the same browser session. Key = remote URL, Value = blob URL.
// Note: blob URLs remain valid until page unload — no manual revocation.
// ============================================
const blobUrlCache = new Map<string, string>();
const failedBlobUrlCache = new Set<string>();
const inflightBlobFetches = new Map<string, Promise<string | null>>();

// NOTE: EXT_MIME_MAP and inferMimeForUpload are now imported from @/utils/mime-utils
// to maintain a single source of truth for MIME type inference across the app.
// normalizeStorageToolRun is imported from @/utils/normalize-tool-run.

/**
 * Sanitize a filename for safe upload to backend.
 * Replaces fullwidth Unicode characters (：, ／, ＼) and other
 * problematic characters that can cause 500 errors on storage backends.
 * If the filename stem (without extension) contains NO Latin/ASCII letters or digits,
 * generates a safe fallback like "upload_<timestamp>.<ext>" to prevent backend 500.
 *
 * @param name - Original filename
 * @returns Safe filename for upload
 */
function sanitizeFilename(name: string): string {
  // Split into stem + extension
  const lastDot = name.lastIndexOf('.');
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  const stem = lastDot > 0 ? name.slice(0, lastDot) : name;

  // WHY: Backend returns 500 for filenames with only non-Latin characters
  // (Persian/Arabic/CJK). If the stem has no ASCII letters/digits at all,
  // generate a safe fallback to prevent server errors.
  const hasLatinOrDigit = /[a-zA-Z0-9]/.test(stem);

  let safeStem: string;
  if (!hasLatinOrDigit) {
    // Generate a predictable safe name: "upload_<timestamp>"
    safeStem = `upload_${Date.now()}`;
    console.warn('[ChatService] Non-Latin filename detected, using safe fallback:', {
      original: name,
      safeName: `${safeStem}${ext}`,
    });
  } else {
    safeStem = stem
      // Replace fullwidth colons, slashes, backslashes with ASCII equivalents
      .replace(/\uff1a/g, '_')  // ： → _
      .replace(/\uff0f/g, '_')  // ／ → _
      .replace(/\uff3c/g, '_')  // ＼ → _
      // Replace any remaining characters problematic for filesystems
      .replace(/[<>"|?*]/g, '_')
      // Collapse consecutive underscores
      .replace(/_+/g, '_');
  }

  return `${safeStem}${ext}`;
}

/** Coerce message `metadata` to a plain object (gateway may use opaque JSON). */
function asMetadataRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Parse persisted reasoning timeline steps from DB / gateway.
 * Accepts array, or JSON string of an array (some ORMs double-encode).
 */
function parsePersistedThinkingSteps(raw: unknown): ThinkingStep[] | undefined {
  if (raw == null) return undefined;
  let arr: unknown[] | undefined;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return undefined;
    }
  }
  if (!arr?.length) return undefined;
  const looksLikeStep = (item: unknown) =>
    !!item &&
    typeof item === 'object' &&
    'type' in (item as object) &&
    typeof (item as { type?: unknown }).type === 'string';
  if (!arr.every(looksLikeStep)) return undefined;
  return arr as ThinkingStep[];
}

function parseSuggestionItems(raw: unknown): SuggestionItem[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const items: SuggestionItem[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      items.push({ text: item.trim() });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const text =
        (typeof o.text === 'string' && o.text) ||
        (typeof o.content === 'string' && o.content) ||
        (typeof o.value === 'string' && o.value) ||
        (typeof o.message === 'string' && o.message) ||
        '';
      if (text) items.push({ ...(o as Partial<SuggestionItem>), text } as SuggestionItem);
    }
  }
  return items.length ? items : undefined;
}

function parseWarningItems(raw: unknown): WarningItem[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const items: WarningItem[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      items.push({ message: item.trim(), level: 'warning' });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const message =
        (typeof o.message === 'string' && o.message) ||
        (typeof o.text === 'string' && o.text) ||
        (typeof o.content === 'string' && o.content) ||
        '';
      if (message) {
        const rawLevel = o.level ?? o.severity;
        const level: WarningItem['level'] =
          rawLevel === 'info' || rawLevel === 'warning' || rawLevel === 'error'
            ? rawLevel
            : 'warning';
        items.push({
          message,
          level,
          code: (typeof o.code === 'string' ? o.code : null) ?? null,
        });
      }
    }
  }
  return items.length ? items : undefined;
}

/** Build minimal tool_runs from a tools_used name list when detailed runs are missing. */
function toolRunsFromToolsUsed(names: unknown): ToolRunInfo[] | undefined {
  if (!Array.isArray(names) || names.length === 0) return undefined;
  const runs: ToolRunInfo[] = [];
  for (const name of names) {
    if (typeof name === 'string' && name.trim()) {
      runs.push({ tool_id: name.trim(), status: 'success' });
    }
  }
  return runs.length ? runs : undefined;
}

/**
 * Normalize `artifacts` / `attachments` from ChatResponse, SSE `final`, or DB rows
 * into `ArtifactInput[]` for UI cards (aligned with `listMessages` attachment mapping).
 */
export function normalizeArtifactsFromPayload(raw: unknown): ArtifactInput[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ArtifactInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : undefined;
    const pathRaw =
      (typeof o.path === 'string' && o.path) ||
      (typeof o.storage_path === 'string' && o.storage_path) ||
      id ||
      '';
    if (!pathRaw && !id) continue;
    const name =
      (typeof o.name === 'string' && o.name) ||
      (typeof o.original_filename === 'string' && o.original_filename) ||
      undefined;
    const mime =
      (typeof o.mime_type === 'string' && o.mime_type) ||
      (typeof o.content_type === 'string' && o.content_type) ||
      (name ? inferMimeType(name, '') : null);
    const size =
      (typeof o.size === 'number' ? o.size : undefined) ??
      (typeof o.file_size_bytes === 'number' ? o.file_size_bytes : undefined) ??
      null;
    out.push({
      id: id ?? null,
      path: typeof pathRaw === 'string' ? pathRaw : String(pathRaw),
      name: name ?? null,
      mime_type: mime,
      size,
    });
  }
  return out.length ? out : undefined;
}

export const chatService = {
  // ==========================================
  // Utility — URL / Download helpers
  // ==========================================

  /**
   * Construct a download URL for an artifact.
   *
   * ⚠️ BACKEND CHANGE (v0.15.0): Files are now stored in MinIO.
   * The `storage_path` and `path` fields on artifacts now contain
   * `minio://bucket/object/path` URIs — NOT valid HTTP routes.
   * Always prefer passing artifact.id (UUID) to this function.
   *
   * Routing logic:
   * 1. Already a full HTTP/HTTPS URL → return as-is
   * 2. UUID (artifact ID) → /storage/artifacts/{id}/download (PREFERRED)
   * 3. minio:// URI → NOT routable via HTTP — log warning, return empty string
   * 4. Legacy local filesystem path (e.g. /data/uploads/...) → gateway proxy
   *    NOTE: local paths may no longer exist after MinIO migration
   *
   * @param pathOrStoragePath - Artifact UUID (preferred), storage_path, or full URL
   * @returns Fully-qualified HTTP URL for the file, or empty string for minio:// URIs
   */
  getArtifactUrl(pathOrStoragePath: string): string {
    // If it's already a full URL, return as-is
    if (pathOrStoragePath.startsWith('http://') || pathOrStoragePath.startsWith('https://')) {
      return pathOrStoragePath;
    }
    // ⚠️ minio:// URIs are INTERNAL storage addresses — not HTTP-routable.
    // After v0.15.0 backend change, storage_path may be "minio://bucket/user/.../file.pdf".
    // These cannot be served via Gateway proxy — always use artifact ID instead.
    if (pathOrStoragePath.startsWith('minio://')) {
      console.warn(
        '[ChatService] minio:// URI passed to getArtifactUrl — this is an internal MinIO path,',
        'not an HTTP endpoint. Use artifact.id (UUID) instead of storage_path.',
        { path: pathOrStoragePath }
      );
      return '';
    }
    // If it looks like a UUID (artifact ID), use the stable download endpoint
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(pathOrStoragePath)) {
      return `${STORAGE_BASE_URL}/storage/artifacts/${pathOrStoragePath}/download`;
    }
    // Legacy: local filesystem path (e.g. /data/uploads/...) — proxy via Gateway.
    // NOTE: After v0.15.0 MinIO migration, most files won't be here anymore.
    const cleanPath = pathOrStoragePath.startsWith('/') ? pathOrStoragePath : `/${pathOrStoragePath}`;
    return `${STORAGE_BASE_URL}${cleanPath}`;
  },

  /**
   * Get authorization + group headers for native fetch requests.
   * Needed for endpoints that require JWT auth but can't use axios interceptors
   * (e.g., streaming SSE, file downloads, image loading via blob URLs).
   *
   * Mirrors the gatewayClient interceptor behaviour:
   *   - Attaches `Authorization: Bearer <token>`
   *   - Attaches `X-Group-Id` (first available group) — required by the backend
   *     for multi-group users; without it, /chat/stream returns AUTH_REQUIRED.
   *   - Throws (returns empty + logs) when `RefreshTokenExpired` is detected so
   *     the caller can surface a proper "session expired" error instead of sending
   *     a stale token that the backend will reject with 401.
   *
   * @returns Object with Authorization (and optionally X-Group-Id) headers,
   *          or empty object if no token is available.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      let session = await getSession();
      // ⚠️ After page refresh, NextAuth may not be initialized yet.
      // Retry with exponential backoff to match gatewayClient interceptor.
      if (!session?.user?.accessToken) {
        const retryDelays = [300, 600, 1100];
        for (const delay of retryDelays) {
          debugLog.thumbnail(`getAuthHeaders: no token, retrying in ${delay}ms (attempt ${retryDelays.indexOf(delay) + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          session = await getSession();
          if (session?.user?.accessToken) break;
        }
      }

      const token = session?.user?.accessToken;
      if (!token) {
        console.warn('[ChatService] No auth token available after retries');
        return {};
      }

      // ⚠️ Consistent with gatewayClient interceptor: do NOT send an expired token.
      // When NextAuth fails to refresh (RefreshTokenExpired), the session still holds
      // the OLD accessToken. Sending it will always get 401 from the backend.
      if ((session?.user as Record<string, unknown>)?.error === 'RefreshTokenExpired') {
        console.warn('[ChatService] Token refresh expired — cannot attach auth headers.');
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
      console.warn('[ChatService] Failed to get auth token:', error);
      return {};
    }
  },

  /**
   * Download a file from storage by constructing a hidden anchor element.
   * Fetches the file as blob with auth headers to force download instead of navigation.
   *
   * @param url - Full URL of the file to download
   * @param filename - Suggested filename for the download
   */
  async downloadFile(url: string, filename: string): Promise<void> {
    console.info('[ChatService] Downloading file:', { url, filename });
    try {
      // ⚠️ Storage endpoints require JWT auth — include Authorization header
      const authHeaders = await this.getAuthHeaders();
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      console.info('[ChatService] File downloaded:', { filename });
    } catch (error: unknown) {
      console.error('[ChatService] Download failed:', { url, filename, error });
      throw error;
    }
  },

  /**
   * Fetch a file from storage as a blob URL with auth headers.
   * Used for loading images that require JWT authentication.
   * Returns null if the fetch fails.
   *
   * @param url - Full URL of the file to fetch
   * @returns Blob URL string that can be used as img src, or null on failure
   */
  async fetchAuthenticatedBlobUrl(url: string): Promise<string | null> {
    debugLog.preview('fetchAuthenticatedBlobUrl called', { url });
    const cached = blobUrlCache.get(url);
    if (cached) {
      debugLog.preview('Blob URL cache HIT', { url, cached });
      return cached;
    }
    if (failedBlobUrlCache.has(url)) return null;

    const inflight = inflightBlobFetches.get(url);
    if (inflight) return inflight;

    const promise = this.fetchAuthenticatedBlobUrlOnce(url);
    inflightBlobFetches.set(url, promise);
    try {
      return await promise;
    } finally {
      inflightBlobFetches.delete(url);
    }
  },

  async fetchAuthenticatedBlobUrlOnce(url: string): Promise<string | null> {
    try {
      const authHeaders = await this.getAuthHeaders();
      debugLog.preview('Fetching blob with auth', { url, hasAuth: !!authHeaders.Authorization });
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) {
        const kind = classifyStorageHttpStatus(response.status);
        logStorageFetchFailure('ChatService', url, kind, response.status);
        debugLog.error('Authenticated fetch FAILED', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
        failedBlobUrlCache.add(url);
        return null;
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      debugLog.preview('Blob URL created', {
        url,
        blobUrl,
        blobSize: blob.size,
        blobType: blob.type,
      });
      blobUrlCache.set(url, blobUrl);
      return blobUrl;
    } catch (error: unknown) {
      logStorageFetchFailure('ChatService', url, 'network');
      debugLog.error('Authenticated blob fetch EXCEPTION', { url, error });
      failedBlobUrlCache.add(url);
      return null;
    }
  },

  /**
   * Derive a file type category from a MIME type string.
   *
   * Used to populate the `type` field in ArtifactInput so the backend
   * orchestrator knows which processing tools to invoke (e.g., image analysis).
   *
   * @param mimeType - The MIME type string (e.g., "image/png", "application/pdf")
   * @returns Category string: "image" | "video" | "audio" | "document" | "file"
   */
  getFileTypeFromMime(mimeType: string): string {
    if (!mimeType) return 'file';
    const lower = mimeType.toLowerCase();
    if (lower.startsWith('image/')) return 'image';
    if (lower.startsWith('video/')) return 'video';
    if (lower.startsWith('audio/')) return 'audio';
    if (
      lower.startsWith('text/') ||
      lower === 'application/pdf' ||
      lower.includes('word') ||
      lower.includes('spreadsheet') ||
      lower.includes('presentation') ||
      lower.includes('document')
    ) {
      return 'document';
    }
    return 'file';
  },

  // ==========================================
  // Chat Messages (Gateway — /chat/)
  // ==========================================

  /**
   * Send a chat message and receive a full response (non-streaming).
   *
   * @endpoint POST /chat
   * @param request - Chat request with message and optional session_id
   * @returns Full chat response with answer, thinking, suggestions, etc.
   * @throws {AxiosError} 401 if token invalid, 500 if orchestrator fails
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    console.info('[ChatService] Sending message:', {
      session_id: request.session_id,
      messageLength: request.message.length,
      model: request.model,
    });
    try {
      const res = await gatewayClient.post<ChatResponse>('/chat', {
        ...request,
        stream: false,
      });
      console.info('[ChatService] Message response received:', {
        session_id: res.data.session_id,
        answerLength: res.data.answer.length,
        steps: res.data.steps,
        tools: res.data.tool_runs?.length ?? 0,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to send message:', {
        session_id: request.session_id,
        error,
      });
      throw error;
    }
  },

  /**
   * Send a chat message and receive a streaming response via SSE.
   * Uses native fetch (not axios) for proper SSE stream handling.
   *
   * @endpoint POST /chat/stream
   * @param request - Chat request payload
   * @param onEvent - Callback for each stream event (token, thinking, tool_start, etc.)
   * @param signal - AbortSignal to cancel the stream
   * @returns Promise that resolves when stream completes
   * @throws {Error} If stream fails or is aborted
   */
  async sendMessageStream(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    console.info('[ChatService] Starting stream:', {
      session_id: request.session_id,
      messageLength: request.message.length,
      model: request.model,
      // Log artifact info for debugging file upload issues
      artifacts: request.artifacts?.map((a) => ({
        id: a.id,
        path: a.path,
        name: a.name,
        mime_type: a.mime_type,
        size: a.size,
      })),
    });

    // WHY: Use getAuthHeaders() (which includes a 500ms retry) rather than
    // calling getSession() directly. After a page refresh, NextAuth may not
    // have restored the session yet, causing getSession() to return null on
    // the first call and resulting in a missing Authorization header → 401
    // AUTH_REQUIRED from the API Gateway RBAC middleware.
    // NOTE: getAuthHeaders() now also returns X-Group-Id — required by the
    // backend gateway for multi-group users (absence causes AUTH_REQUIRED on
    // text-only messages that have no prior upload to establish group context).
    const authHeaders = await chatService.getAuthHeaders();

    if (!authHeaders.Authorization) {
      // Fail fast with a clear error rather than letting the stream request
      // proceed without a token and returning a confusing 401 from the backend.
      console.error('[ChatService] Cannot start stream — no auth token available after retry');
      throw new Error('Not authenticated. Please reload the page and try again.');
    }

    console.info('[ChatService] Stream auth headers ready:', {
      hasAuth: !!authHeaders.Authorization,
      hasGroupId: !!authHeaders['X-Group-Id'],
      groupId: authHeaders['X-Group-Id'] ?? '(none — user may be in no group)',
    });

    const response = await fetch(`${STORAGE_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        ...request,
        // Strip localPreviewUrl from artifacts — it's a frontend-only blob URL
        // that the backend doesn't understand and shouldn't receive
        artifacts: request.artifacts?.map(({ localPreviewUrl, ...rest }) => rest),
        stream: true,
        streaming: true,
        show_thinking: true,
        include_suggestions: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[ChatService] Stream request failed:', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Stream failed: ${response.status} — ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.info('[ChatService] Stream completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events: "data: {...}\n\n"
        const lines = buffer.split('\n');
        buffer = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);

            // Handle [DONE] marker
            if (jsonStr === '[DONE]') {
              onEvent({ type: 'done', data: '' });
              continue;
            }

            try {
              const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

              // Map backend SSE event types to our StreamEvent format.
              // Backend orchestrator guide v2.1 events:
              //   status, node, plan, progress, thinking, tool_start,
              //   tool_progress, tool_result, evaluation, answer,
              //   suggestion, warning, final, done, error
              const backendType = parsed.type as string | undefined;
              debugLog.stream('SSE event received', {
                backendType,
                parsedKeys: Object.keys(parsed),
                hasContent: 'content' in parsed,
                hasToolName: 'tool_name' in parsed,
                hasTraceId: 'trace_id' in parsed,
                hasToolRuns: 'tool_runs' in parsed,
                rawData: parsed,
              });

              switch (backendType) {
                case 'status':
                  // Processing started — includes trace_id, message
                  onEvent({ type: 'status', data: parsed });
                  break;

                case 'node':
                  // Orchestrator node transition — e.g. assess_complexity → planner
                  onEvent({ type: 'node', data: parsed });
                  break;

                case 'plan':
                  // Execution plan from planner — plan.tasks[], plan.complexity
                  onEvent({ type: 'plan', data: parsed });
                  break;

                case 'progress':
                  // Task progress update — message, task_id, status
                  onEvent({ type: 'progress', data: parsed });
                  break;

                case 'thinking':
                  // Thinking token — backend uses "content" field
                  onEvent({ type: 'thinking', data: (parsed.content as string) || '' });
                  break;

                case 'answer':
                  // Answer token — backend uses "content" field (streaming)
                  onEvent({ type: 'token', data: (parsed.content as string) || '' });
                  break;

                case 'tool_start':
                  // Tool starting — tool_name, tool_id, args, step
                  onEvent({ type: 'tool_start', data: parsed });
                  break;

                case 'tool_progress':
                  // Tool progress — tool_id, progress (0-1), message
                  onEvent({ type: 'tool_progress', data: parsed });
                  break;

                case 'tool_result':
                  // Tool completed — tool_id, tool_name, ok, data, error, execution_time
                  onEvent({ type: 'tool_result', data: parsed });
                  break;

                case 'tool_end':
                  // Legacy alias for tool_result — keep for backward compat
                  onEvent({ type: 'tool_result', data: parsed });
                  break;

                case 'evaluation':
                  // Critic evaluation — overall_confidence (0-1), evaluation details
                  onEvent({ type: 'evaluation', data: parsed });
                  break;

                case 'suggestion':
                  onEvent({ type: 'suggestion', data: parsed });
                  break;

                case 'warning':
                  onEvent({ type: 'warning', data: parsed });
                  break;

                case 'final':
                  // Complete final state — answer, tool_runs[], suggestions[],
                  // trace_id, steps, processing_time, thinking
                  debugLog.stream('>>> FINAL event', {
                    hasTraceId: 'trace_id' in parsed,
                    traceId: parsed.trace_id,
                    hasAnswer: 'answer' in parsed,
                    answerLength: typeof parsed.answer === 'string' ? parsed.answer.length : 0,
                    hasToolRuns: 'tool_runs' in parsed,
                    toolRunsCount: Array.isArray(parsed.tool_runs) ? parsed.tool_runs.length : 0,
                    allKeys: Object.keys(parsed),
                  });
                  onEvent({ type: 'final', data: parsed });
                  break;

                case 'final_answer':
                  // Legacy alias — backend may still send this in some flows
                  // Map to 'final' to maintain compatibility
                  onEvent({ type: 'final', data: parsed });
                  break;

                case 'done':
                  // Stream completed — only includes trace_id + elapsed
                  debugLog.stream('>>> DONE event', {
                    traceId: parsed.trace_id,
                    elapsed: parsed.elapsed,
                    allKeys: Object.keys(parsed),
                  });
                  onEvent({ type: 'done', data: parsed });
                  break;

                case 'error':
                  onEvent({ type: 'error', data: parsed });
                  break;

                default:
                  // Unknown lifecycle events — log and pass as status
                  debugLog.stream('Unknown SSE event type', { backendType, parsed });
                  onEvent({ type: 'status', data: parsed });
                  break;
              }
            } catch {
              // Not valid JSON — might be a partial line, keep in buffer
              if (i === lines.length - 1) {
                buffer = line;
              }
            }
          } else if (line === '') {
            // Empty line = event boundary, continue
            continue;
          } else {
            // Non-data line, might be partial — buffer it
            if (i === lines.length - 1 && line !== '') {
              buffer = line;
            }
          }
        }
      }
    } catch (error: unknown) {
      if (signal?.aborted) {
        console.info('[ChatService] Stream aborted by user');
        return;
      }
      console.error('[ChatService] Stream error:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  },

  // ==========================================
  // Sessions (Gateway — /chat/sessions/)
  // ==========================================

  /**
   * Create a new chat session.
   *
   * @endpoint POST /chat/sessions
   * @param data - Session creation data (title, model, system_prompt)
   * @returns Created session object
   * @throws {AxiosError} 401 if unauthorized
   */
  async createSession(data?: SessionCreateRequest): Promise<ChatSession> {
    console.info('[ChatService] Creating session:', { data });
    try {
      const res = await gatewayClient.post<ChatSession>(
        '/chat/sessions',
        data ?? {}
      );
      console.info('[ChatService] Session created:', {
        id: res.data.id,
        title: res.data.title,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to create session:', { data, error });
      throw error;
    }
  },

  /**
   * List user's chat sessions.
   *
   * @endpoint GET /chat/sessions
   * @param params.limit - Max sessions to return (default: 50)
   * @param params.offset - Pagination offset (default: 0)
   * @param params.include_archived - Include archived sessions (default: false)
   * @returns Array of session objects
   * @throws {AxiosError} 401 if unauthorized
   */
  async listSessions(params?: {
    limit?: number;
    offset?: number;
    include_archived?: boolean;
  }): Promise<ChatSession[]> {
    console.info('[ChatService] Listing sessions:', { params });
    try {
      const res = await gatewayClient.get<ChatSession[]>('/chat/sessions', {
        params,
      });
      const sessions = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] Sessions fetched:', {
        count: sessions.length,
      });
      return sessions;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to list sessions:', {
        params,
        error,
      });
      throw error;
    }
  },

  /**
   * Get a specific session with optional messages.
   *
   * @endpoint GET /chat/sessions/{session_id}
   * @param sessionId - Session ID
   * @param includeMessages - Whether to include messages in response
   * @returns Session object (with messages if requested)
   * @throws {AxiosError} 404 if session not found
   */
  async getSession(
    sessionId: string,
    includeMessages = false
  ): Promise<ChatSession> {
    console.info('[ChatService] Getting session:', {
      sessionId,
      includeMessages,
    });
    try {
      const res = await gatewayClient.get<ChatSession>(
        `/chat/sessions/${sessionId}`,
        { params: { include_messages: includeMessages } }
      );
      console.info('[ChatService] Session fetched:', {
        id: res.data.id,
        title: res.data.title,
        messageCount: res.data.messages?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to get session:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  /**
   * Update a session (rename, archive, pin).
   *
   * @endpoint PATCH /chat/sessions/{session_id}
   * **OpenAPI `SessionUpdate`:** only `title`, `is_archived`, `is_pinned`.
   * Chat-session foldering is not part of this contract (folders exist for
   * storage artifacts via `plugin.file_manager.*`, not for `/chat/sessions`).
   * @param sessionId - Session ID
   * @param data - Fields to update
   * @returns Updated session object
   * @throws {AxiosError} 404 if session not found
   */
  async updateSession(
    sessionId: string,
    data: SessionUpdateRequest
  ): Promise<ChatSession> {
    console.info('[ChatService] Updating session:', { sessionId, data });
    try {
      const res = await gatewayClient.patch<ChatSession>(
        `/chat/sessions/${sessionId}`,
        data
      );
      console.info('[ChatService] Session updated:', {
        id: res.data.id,
        title: res.data.title,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to update session:', {
        sessionId,
        data,
        error,
      });
      throw error;
    }
  },

  /**
   * Delete a chat session.
   *
   * @endpoint DELETE /chat/sessions/{session_id}
   * @param sessionId - Session ID to delete
   * @throws {AxiosError} 404 if session not found
   */
  async deleteSession(sessionId: string): Promise<void> {
    console.info('[ChatService] Deleting session:', { sessionId });
    try {
      await gatewayClient.delete(`/chat/sessions/${sessionId}`);
      console.info('[ChatService] Session deleted:', { sessionId });
    } catch (error: unknown) {
      console.error('[ChatService] Failed to delete session:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Messages (Gateway — /chat/sessions/{id}/messages)
  // ==========================================

  /**
   * List messages in a session.
   *
   * Backend returns MessageResponse[] with tool_calls and tool_results
   * embedded in each assistant message. We normalize these to ToolRunInfo[]
   * for backward compatibility with UI components that render tool runs.
   *
   * @endpoint GET /chat/sessions/{session_id}/messages
   * @param sessionId - Session ID
   * @param params.limit - Max messages (default: 100)
   * @param params.offset - Pagination offset
   * @returns Array of chat messages with tool_runs built from tool_calls/tool_results
   * @throws {AxiosError} 404 if session not found
   */
  async listMessages(
    sessionId: string,
    params?: { limit?: number; offset?: number; include_tool_runs?: boolean }
  ): Promise<ChatMessage[]> {
    console.info('[ChatService] Listing messages:', { sessionId, params });

    try {
      // WHY: Backend now returns a flat array of MessageResponse objects.
      // Each assistant message may contain tool_calls[] and tool_results[].
      const res = await gatewayClient.get<Array<Record<string, unknown>>>(
        `/chat/sessions/${sessionId}/messages`,
        { params }
      );

      const rawMessages: Array<Record<string, unknown>> = Array.isArray(res.data)
        ? res.data
        : [];

      // ⚠️ Backend stores file attachments under `attachments` (NOT `artifacts`).
      // Our ChatMessage type uses `artifacts`, so we normalize here.
      // Backend attachment shape: { id, name, path (=uuid), mime_type }
      const messages: ChatMessage[] = rawMessages.map((msg) => {
        const rawArtifacts = msg['artifacts'] as ArtifactInput[] | undefined;
        const rawAttachments = msg['attachments'] as ArtifactInput[] | undefined;

        // Prefer `artifacts` if backend ever adds it; fall back to `attachments`
        const artifacts: ArtifactInput[] | undefined =
          rawArtifacts?.length
            ? rawArtifacts.map((att) => ({
                ...att,
                // WHY: Backend sometimes doesn't return mime_type — infer from filename
                // extension so video/audio/image files are categorized correctly for preview.
                mime_type: att.mime_type || (att.name ? inferMimeType(att.name, '') : null),
              }))
            : rawAttachments?.length
              ? rawAttachments.map((att) => ({
                  id: att.id,
                  // Backend stores path as artifact UUID — getArtifactUrl() handles UUIDs
                  // as /storage/artifacts/{id}/download which works correctly
                  path: (att.path ?? att.id ?? '') as string,
                  name: att.name,
                  // WHY: Backend sometimes doesn't return mime_type — infer from filename
                  mime_type: att.mime_type || (att.name ? inferMimeType(att.name, '') : null),
                  size: att.size,
                }))
              : undefined;

        // ⚠️ Backend may persist agent thinking/reasoning in different formats:
        // 1. `thinking` (string) — simple thinking text
        // 2. `reasoning` (array of { content: string }) — structured reasoning steps
        // 3. `reasoning` (string) — plain reasoning text
        // We normalize to a `thinking` string for display, AND preserve
        // the structured `reasoningSegments` array for timeline interleaving.
        const metadata = asMetadataRecord(msg['metadata']);

        const rawThinking = msg['thinking'] as string | null | undefined;
        const rawReasoning = (msg['reasoning'] ??
          metadata?.reasoning ??
          metadata?.reasoning_segments) as
          | Array<{ content?: string; text?: string }>
          | string
          | null
          | undefined;

        let thinking: string | null = rawThinking ?? null;
        // WHY: Preserve reasoning array structure so buildStepsFromHistory()
        // can create separate thinking steps for each segment and interleave
        // them with tool_runs — matching the original streaming timeline order.
        let reasoningSegments: string[] | undefined;

        if (!thinking && rawReasoning) {
          if (typeof rawReasoning === 'string') {
            thinking = rawReasoning;
          } else if (Array.isArray(rawReasoning)) {
            // Extract individual segments for timeline reconstruction
            reasoningSegments = rawReasoning
              .map((step) => step.content ?? step.text ?? '')
              .filter(Boolean);
            // Also create joined string for summary/fallback display
            thinking = reasoningSegments.join('\n\n');
          }
        }

        // ─── Parse tool_calls & tool_results from MessageResponse ───
        // WHY: Backend embeds these directly in each assistant message.
        // We convert them to ToolRunInfo[] for backward compat with UI.
        const rawToolCalls = (msg['tool_calls'] ?? []) as ToolCallItem[];
        const rawToolResults = (msg['tool_results'] ?? []) as ToolResultItem[];
        let toolRunsFromMsg: ToolRunInfo[] =
          rawToolCalls.length > 0 || rawToolResults.length > 0
            ? normalizeToolCallsToRuns(rawToolCalls, rawToolResults)
            : [];

        // Fallback: persisted tool_runs array on the message row
        if (toolRunsFromMsg.length === 0) {
          const rawToolRuns = msg['tool_runs'];
          if (Array.isArray(rawToolRuns) && rawToolRuns.length > 0) {
            toolRunsFromMsg = normalizeDoneEventToolRuns(
              rawToolRuns as Array<Record<string, unknown>>
            );
          }
        }

        // Fallback: metadata.tool_runs or tools_used name list
        if (toolRunsFromMsg.length === 0 && metadata?.tool_runs) {
          if (Array.isArray(metadata.tool_runs)) {
            toolRunsFromMsg = normalizeDoneEventToolRuns(
              metadata.tool_runs as Array<Record<string, unknown>>
            );
          }
        }
        if (toolRunsFromMsg.length === 0) {
          const fromUsed =
            toolRunsFromToolsUsed(msg['tools_used']) ??
            toolRunsFromToolsUsed(metadata?.tools_used);
          if (fromUsed) toolRunsFromMsg = fromUsed;
        }

        const suggestions =
          parseSuggestionItems(msg['suggestions']) ??
          parseSuggestionItems(metadata?.suggestions);

        const warnings =
          parseWarningItems(msg['warnings']) ??
          parseWarningItems(metadata?.warnings);

        // ─── Parse token usage from MessageResponse ───
        const tokens_prompt = (msg['tokens_prompt'] as number | undefined) ?? undefined;
        const tokens_completion = (msg['tokens_completion'] as number | undefined) ?? undefined;

        // ─── Extract trace_id for orchestrator messages ───
        // WHY: OpenAPI `MessageResponse` may omit trace_id; gateways often stash it in `metadata`.
        const trace_id =
          (msg['trace_id'] as string | undefined) ??
          (msg['traceId'] as string | undefined) ??
          (typeof metadata?.trace_id === 'string' ? metadata.trace_id : undefined) ??
          (typeof metadata?.traceId === 'string' ? metadata.traceId : undefined);

        // ─── Parse orchestrator step data if backend provides it ───
        // WHY: Backend might persist timeline as `thinking_steps` (snake_case) or inside metadata.
        const persistedSteps =
          parsePersistedThinkingSteps(msg['thinkingSteps']) ??
          parsePersistedThinkingSteps(msg['thinking_steps']) ??
          parsePersistedThinkingSteps(msg['orchestrator_steps']) ??
          parsePersistedThinkingSteps(msg['reasoning_timeline']) ??
          parsePersistedThinkingSteps(metadata?.thinking_steps) ??
          parsePersistedThinkingSteps(metadata?.thinkingSteps) ??
          parsePersistedThinkingSteps(metadata?.orchestrator_steps) ??
          parsePersistedThinkingSteps(metadata?.stream_steps);

        const rawStreamSteps =
          parsePersistedThinkingSteps(msg['streamSteps']) ??
          parsePersistedThinkingSteps(msg['stream_steps']) ??
          parsePersistedThinkingSteps(metadata?.streamSteps) ??
          parsePersistedThinkingSteps(metadata?.stream_steps);

        return {
          ...(msg as unknown as ChatMessage),
          artifacts,
          thinking,
          reasoningSegments,
          // WHY: Preserve original arrays for components that need them,
          // AND provide normalized tool_runs for legacy display components.
          tool_calls: rawToolCalls.length > 0 ? rawToolCalls : undefined,
          tool_results: rawToolResults.length > 0 ? rawToolResults : undefined,
          tool_runs: toolRunsFromMsg.length > 0 ? toolRunsFromMsg : (msg as unknown as ChatMessage).tool_runs,
          tools_used: (msg['tools_used'] as string[] | undefined) ?? (metadata?.tools_used as string[] | undefined),
          suggestions,
          warnings,
          tokens_prompt,
          tokens_completion,
          metadata,
          // ─── Trace & orchestrator fields ───
          trace_id,
          // WHY: Only include if backend actually returned these arrays
          // to avoid overwriting potential default/reconstructed values.
          ...(persistedSteps?.length ? { thinkingSteps: persistedSteps } : {}),
          ...(rawStreamSteps?.length ? { streamSteps: rawStreamSteps } : {}),
          ...(metadata?.execution_plan
            ? { executionPlan: metadata.execution_plan as ExecutionPlan }
            : {}),
          ...(metadata?.current_node
            ? { currentNode: metadata.current_node as OrchestratorNodeName }
            : {}),
          ...(typeof metadata?.overall_confidence === 'number'
            ? { overallConfidence: metadata.overall_confidence as number }
            : {}),
          ...(typeof metadata?.replan_count === 'number'
            ? { replanCount: metadata.replan_count as number }
            : {}),
          ...(typeof metadata?.thinking_duration === 'number'
            ? { thinkingDuration: metadata.thinking_duration as number }
            : {}),
        };
      });

      console.info('[ChatService] Messages fetched:', {
        sessionId,
        count: messages.length,
        withAttachments: messages.filter((m) => m.artifacts?.length).length,
        withToolRuns: messages.filter((m) => m.tool_runs?.length).length,
        withToolCalls: messages.filter((m) => m.tool_calls?.length).length,
        withToolsUsed: messages.filter((m) => m.tools_used?.length).length,
        withTraceId: messages.filter((m) => (m as unknown as { trace_id?: string }).trace_id).length,
        withThinkingSteps: messages.filter(
          (m) => (m as ChatMessage & { thinkingSteps?: ThinkingStep[] }).thinkingSteps?.length
        ).length,
        withReasoning: messages.filter((m) => m.reasoningSegments?.length).length,
      });
      return messages;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to list messages:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  /**
   * Clear all messages in a session.
   *
   * @endpoint DELETE /chat/sessions/{session_id}/messages
   * @param sessionId - Session ID
   * @throws {AxiosError} 404 if session not found
   */
  async clearMessages(sessionId: string): Promise<void> {
    console.info('[ChatService] Clearing messages:', { sessionId });
    try {
      await gatewayClient.delete(`/chat/sessions/${sessionId}/messages`);
      console.info('[ChatService] Messages cleared:', { sessionId });
    } catch (error: unknown) {
      console.error('[ChatService] Failed to clear messages:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Context (Gateway — /chat/sessions/{id}/context)
  // ==========================================

  /**
   * Get recent message context for a session.
   *
   * @endpoint GET /chat/sessions/{session_id}/context
   * @param sessionId - Session ID
   * @param maxMessages - Max messages to include in context
   * @returns Context messages
   * @throws {AxiosError} 404 if session not found
   */
  async getContext(
    sessionId: string,
    maxMessages?: number
  ): Promise<ChatMessage[]> {
    console.info('[ChatService] Getting context:', { sessionId, maxMessages });
    try {
      const res = await gatewayClient.get<ChatMessage[]>(
        `/chat/sessions/${sessionId}/context`,
        { params: { max_messages: maxMessages } }
      );
      const messages = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] Context fetched:', {
        sessionId,
        count: messages.length,
      });
      return messages;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to get context:', {
        sessionId,
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Models (LLM Proxy — /v1/models)
  // ==========================================

  /**
   * Resolve chat models: GET /chat/models (preferred) → admin route → /v1/models + /gpu/models merge.
   */
  async loadChatModels(): Promise<ChatModelsSnapshot> {
    console.info('[ChatService] Resolving chat models...');

    const chatModelsResult = await gatewayClient
      .get<unknown>('/chat/models')
      .then((r) => ({ ok: true as const, data: r.data }))
      .catch(() => ({ ok: false as const, data: null }));

    if (chatModelsResult.ok && chatModelsResult.data) {
      const payload = chatModelsResult.data as Record<string, unknown>;
      const list = Array.isArray(payload.models) ? payload.models : [];
      const models: ModelInfo[] = [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const o = raw as Record<string, unknown>;
        const id = typeof o.id === 'string' ? o.id : '';
        if (!id) continue;
        models.push({
          id,
          object: 'model',
          owned_by: 'platform',
          display_name: typeof o.display_name === 'string' ? o.display_name : id,
        });
      }
      const defaultModel =
        (typeof payload.default_model === 'string' && payload.default_model) ||
        models.find((m) => (list as Record<string, unknown>[]).find(
          (r) => r && typeof r === 'object' && (r as Record<string, unknown>).id === m.id && (r as Record<string, unknown>).is_default
        ))?.id ||
        models[0]?.id ||
        '';
      if (models.length > 0 && defaultModel) {
        return { models, defaultModel, resolved: true };
      }
    }

    const [routesResult, modelsResult, v1Result, gpuResult] = await Promise.all([
      gatewayClient
        .get<unknown>('/admin/llm/routes')
        .then((r) => ({ ok: true as const, data: r.data }))
        .catch(() => ({ ok: false as const, data: null })),
      gatewayClient
        .get<unknown>('/admin/llm/models')
        .then((r) => ({ ok: true as const, data: r.data }))
        .catch(() => ({ ok: false as const, data: null })),
      gatewayClient
        .get<unknown>('/v1/models')
        .then((r) => ({ ok: true as const, data: r.data }))
        .catch(() => ({ ok: false as const, data: null })),
      gatewayClient
        .get<unknown>('/gpu/models')
        .then((r) => ({ ok: true as const, data: r.data }))
        .catch(() => ({ ok: false as const, data: null })),
    ]);

    const routes = routesResult.ok
      ? parseAdminLlmRoutesPayload(routesResult.data)
      : [];
    const chatRoute = findChatOrchestratorRoute(routes);
    const registeredModels = modelsResult.ok
      ? parseAdminLlmModelsPayload(modelsResult.data)
      : [];

    const adminSnapshot = resolveChatPluginModel({
      chatRoute,
      registeredModels,
    });

    const v1Models = v1Result.ok ? parseGatewayModelsList(v1Result.data) : [];
    const gpuModels = gpuResult.ok ? parseGatewayModelsList(gpuResult.data) : [];
    const merged = mergeChatModelLists(adminSnapshot.models, v1Models, gpuModels);

    const snapshot: ChatModelsSnapshot = {
      models: merged.length > 0 ? merged : adminSnapshot.models,
      defaultModel: adminSnapshot.defaultModel || merged[0]?.id || '',
      resolved: adminSnapshot.resolved || merged.length > 0,
    };

    console.info('[ChatService] Chat models resolved:', {
      resolved: snapshot.resolved,
      count: snapshot.models.length,
      defaultModel: snapshot.defaultModel,
      sourceChatModels: chatModelsResult.ok,
    });

    return snapshot;
  },

  async listModels(): Promise<ModelInfo[]> {
    const snapshot = await this.loadChatModels();
    return snapshot.models;
  },

  // ==========================================
  // File Upload (Gateway — /upload)
  // ==========================================

  /** Upload timeout: 5 minutes for large files */
  UPLOAD_TIMEOUT: 5 * 60 * 1000,

  /**
   * Upload a single file to storage via the API Gateway.
   * Reports progress via onProgress callback for UI progress bars.
   *
   * Upload flow:
   * 1. Frontend sends file with session_id
   * 2. Gateway adds user_id from auth token
   * 3. Storage saves file and registers artifact in DB
   * 4. Returns artifact info with id, path, type
   *
   * @endpoint POST /upload
   * @param file - Single File object to upload
   * @param sessionId - Session ID to associate the file with
   * @param onProgress - Progress callback (0-100 percentage)
   * @returns Artifact input from the uploaded file
   * @throws {AxiosError} 401 if unauthorized, 413 if file too large, timeout
   */
  async uploadSingleFile(
    file: File,
    sessionId: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<ArtifactInput> {
    console.info('[ChatService] Uploading single file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      sessionId,
    });

    debugLog.upload('>>> uploadSingleFile START', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      sessionId,
    });

    const formData = new FormData();
    // When browser can't detect MIME type (empty string), infer from extension
    // so backend receives a correct Content-Type in the multipart boundary
    const inferredType = inferMimeType(file.name, file.type);
    // Sanitize filename to avoid backend 500 errors from problematic Unicode chars
    const safeName = sanitizeFilename(file.name);
    const needsNewFile = (!file.type && inferredType !== 'application/octet-stream') || safeName !== file.name;
    const uploadFile = needsNewFile
      ? new File([file], safeName, { type: inferredType })
      : file;
    formData.append('files', uploadFile);
    formData.append('session_id', sessionId);

    const res = await gatewayClient.post<UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: this.UPLOAD_TIMEOUT,
      signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    // Log full response for debugging
    console.debug('[ChatService] Upload raw response:', JSON.stringify(res.data));
    debugLog.upload('<<< Upload raw response shape', {
      status: res.status,
      hasArtifacts: !!(res.data.artifacts && Array.isArray(res.data.artifacts)),
      hasSaved: !!(res.data.saved && Array.isArray(res.data.saved)),
      hasPath: !!(res.data.path || res.data.storage_path),
      responseKeys: Object.keys(res.data),
      rawData: res.data,
    });

    // Normalize response — backend may return different shapes:
    // 1. { artifacts: [{ id, path, name, mime_type }] }
    // 2. { saved: [{ id, storage_path, original_filename, mime_type, ... }], count: N }
    // 3. { id, path, name, mime_type }
    let artifact: ArtifactInput;

    if (res.data.artifacts && Array.isArray(res.data.artifacts) && res.data.artifacts.length > 0) {
      // Shape 1: standard { artifacts: [...] }
      artifact = res.data.artifacts[0];
    } else if (res.data.saved && Array.isArray(res.data.saved) && res.data.saved.length > 0) {
      // Shape 2: backend returns { saved: [...], count: N }
      const saved = res.data.saved[0];
      console.info('[ChatService] Parsing saved artifact:', saved);
      artifact = {
        id: saved.id,
        // Use actual storage path from backend (minio:// URI) — the orchestrator
        // needs this to locate the file internally. For frontend display/download,
        // getArtifactUrl() converts UUID to /storage/artifacts/{id}/download.
        path: (saved.path as string | undefined) ?? (saved.storage_path as string | undefined) ?? (saved.id as string | undefined) ?? file.name,
        name: (saved.original_filename as string | undefined) ?? (saved.filename as string | undefined) ?? (saved.name as string | undefined) ?? file.name,
        mime_type: (saved.mime_type as string | undefined) ?? (saved.media_type as string | undefined) ?? file.type,
        size: (saved.file_size_bytes as number | undefined) ?? (saved.size as number | undefined) ?? file.size,
        // File type category — backend returns "image", "video", "audio", "document"
        // Required by orchestrator for tool selection (e.g., image.meta, file.read)
        type: (saved.type as string | undefined) ?? this.getFileTypeFromMime(file.type),
      };
    } else if (res.data.path || res.data.storage_path) {
      // Shape 3: flat single artifact object
      artifact = {
        id: res.data.id as string | undefined,
        path: (res.data.path ?? res.data.storage_path) as string,
        name: (res.data.original_filename ?? res.data.name ?? file.name) as string,
        mime_type: (res.data.mime_type ?? file.type) as string,
        size: (res.data.file_size_bytes ?? file.size) as number,
        type: (res.data.type as string | undefined) ?? this.getFileTypeFromMime(file.type),
      };
    } else {
      // ⚠️ Unknown shape — log full response and create best-effort artifact
      console.warn('[ChatService] Unknown upload response shape:', res.data);
      console.warn('[ChatService] Response keys:', Object.keys(res.data));
      artifact = {
        path: file.name,
        name: file.name,
        mime_type: file.type,
        size: file.size,
        type: this.getFileTypeFromMime(file.type),
      };
    }

    console.info('[ChatService] File uploaded successfully:', {
      name: file.name,
      artifactId: artifact.id,
      artifactPath: artifact.path,
      artifactMimeType: artifact.mime_type,
    });
    debugLog.upload('<<< uploadSingleFile RESULT', {
      artifactId: artifact.id,
      artifactPath: artifact.path,
      artifactName: artifact.name,
      artifactMimeType: artifact.mime_type,
      artifactSize: artifact.size,
      artifactType: artifact.type,
      hasId: !!artifact.id,
      thumbnailUrl: artifact.id ? this.getArtifactThumbnailUrl(artifact.id, 200, 200) : 'NO ID — thumbnail unavailable!',
      downloadUrl: artifact.id ? this.getArtifactUrl(artifact.id) : 'NO ID — using path fallback',
    });
    return artifact;
  },

  /**
   * Upload multiple files to storage, one at a time with per-file progress.
   * Each file is uploaded individually to enable granular progress tracking.
   *
   * @endpoint POST /upload (called once per file)
   * @param files - Array of File objects to upload
   * @param sessionId - Session ID to associate files with
   * @param onFileProgress - Callback for per-file progress updates
   * @returns Array of successfully uploaded artifact inputs
   */
  async uploadFilesWithProgress(
    files: File[],
    sessionId: string,
    onFileProgress?: (fileIndex: number, progress: FileUploadProgress) => void,
    signal?: AbortSignal
  ): Promise<ArtifactInput[]> {
    console.info('[ChatService] Uploading files with progress:', {
      count: files.length,
      names: files.map((f) => f.name),
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      sessionId,
    });

    const artifacts: ArtifactInput[] = [];

    // ── Parallel upload strategy ──
    // Files <= 20MB: upload up to PARALLEL_LIMIT simultaneously
    // Files > 20MB: upload sequentially to avoid server timeout
    const PARALLEL_LIMIT = 3;
    const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20MB
    const allLarge = files.every((f) => f.size > LARGE_FILE_THRESHOLD);
    const useParallel = files.length > 1 && !allLarge;

    if (useParallel) {
      console.info('[ChatService] Using parallel upload strategy:', {
        files: files.length,
        parallelLimit: PARALLEL_LIMIT,
      });
      // Initialize all files as 'pending'
      files.forEach((file, i) => {
        onFileProgress?.(i, { file, status: 'uploading', progress: 0 });
      });

      // Upload in batches of PARALLEL_LIMIT
      for (let batchStart = 0; batchStart < files.length; batchStart += PARALLEL_LIMIT) {
        if (signal?.aborted) {
          console.info('[ChatService] Upload cancelled, stopping batch:', { batchStart });
          break;
        }
        const batch = files.slice(batchStart, batchStart + PARALLEL_LIMIT);
        const batchResults = await Promise.allSettled(
          batch.map((file, batchIdx) => {
            const globalIdx = batchStart + batchIdx;
            // Route through smartUpload: uses chunked upload for large files (>20MB)
            return this.smartUpload(
              file,
              sessionId,
              (progress) => {
                onFileProgress?.(globalIdx, { file, status: 'uploading', progress });
              },
              signal
            ).then((artifact) => {
              onFileProgress?.(globalIdx, { file, status: 'success', progress: 100, artifact });
              return artifact;
            });
          })
        );
        batchResults.forEach((result, batchIdx) => {
          const globalIdx = batchStart + batchIdx;
          const file = batch[batchIdx];
          if (result.status === 'fulfilled') {
            artifacts.push(result.value);
          } else {
            const errorMsg = result.reason instanceof Error ? result.reason.message : 'Upload failed';
            console.error('[ChatService] Parallel upload failed for file:', {
              name: file.name,
              index: globalIdx,
              error: result.reason,
            });
            onFileProgress?.(globalIdx, { file, status: 'failed', progress: 0, error: errorMsg });
          }
        });
      }
    } else {
      // Sequential upload — for large files or single file
      for (let i = 0; i < files.length; i++) {
        // Check if upload was cancelled before starting next file
        if (signal?.aborted) {
          console.info('[ChatService] Upload cancelled by user, skipping remaining files:', {
            completed: i,
            remaining: files.length - i,
          });
          break;
        }

        const file = files[i];

        // Signal: uploading started
        onFileProgress?.(i, {
          file,
          status: 'uploading',
          progress: 0,
        });

        try {
          // Route through smartUpload: uses chunked upload for large files (>20MB)
          const artifact = await this.smartUpload(
            file,
            sessionId,
            (progress) => {
              onFileProgress?.(i, {
                file,
                status: 'uploading',
                progress,
              });
            },
            signal
          );

          artifacts.push(artifact);

          // Signal: upload succeeded
          onFileProgress?.(i, {
            file,
            status: 'success',
            progress: 100,
            artifact,
          });
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'Upload failed';
          console.error('[ChatService] Failed to upload file:', {
            name: file.name,
            index: i,
            error,
          });

          // Signal: upload failed for this file
          onFileProgress?.(i, {
            file,
            status: 'failed',
            progress: 0,
            error: errorMsg,
          });
          // Continue uploading remaining files — don't abort everything
        }
      }
    }

    console.info('[ChatService] Upload batch complete:', {
      total: files.length,
      succeeded: artifacts.length,
      failed: files.length - artifacts.length,
      paths: artifacts.map((a) => a.path),
    });

    return artifacts;
  },

  /**
   * Legacy upload method — uploads all files at once without progress.
   * Kept for backwards compatibility. Prefer uploadFilesWithProgress().
   *
   * @endpoint POST /upload
   * @param files - Array of File objects to upload
   * @param sessionId - Optional session ID to associate files with
   * @returns Upload response with artifact details
   * @throws {AxiosError} 401 if unauthorized, 413 if file too large
   */
  async uploadFiles(
    files: File[],
    sessionId?: string
  ): Promise<ArtifactInput[]> {
    console.info('[ChatService] Uploading files (legacy batch):', {
      count: files.length,
      names: files.map((f) => f.name),
      sizes: files.map((f) => f.size),
      sessionId,
    });
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (sessionId) {
        formData.append('session_id', sessionId);
      }

      const res = await gatewayClient.post<UploadResponse>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: this.UPLOAD_TIMEOUT,
      });

      // Normalize response — backend may return { artifacts: [...] } or a single artifact
      let artifacts: ArtifactInput[] = [];
      if (res.data.artifacts && Array.isArray(res.data.artifacts)) {
        artifacts = res.data.artifacts;
      } else if (res.data.path) {
        // Single artifact response
        artifacts = [
          {
            id: res.data.id,
            path: res.data.path,
            name: res.data.name ?? files[0]?.name,
            mime_type: res.data.mime_type,
          },
        ];
      }

      console.info('[ChatService] Files uploaded:', {
        count: artifacts.length,
        paths: artifacts.map((a) => a.path),
      });
      return artifacts;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to upload files:', {
        fileNames: files.map((f) => f.name),
        error,
      });
      throw error;
    }
  },

  // ==========================================
  // Feedback (Storage — /feedback)
  // ==========================================

  /**
   * Submit user feedback (like/dislike) for a chat session.
   * Sends user feedback (like/dislike) for a chat message.
   * Maps frontend like/dislike to backend's 1-5 rating scale.
   *
   * @endpoint POST /feedback
   * @param data - Feedback data with session_id, message_id, and rating
   * @throws {AxiosError} If storage service is unavailable
   */
  async submitFeedback(data: FeedbackRequest): Promise<boolean> {
    console.info('[ChatService] Submitting feedback:', {
      sessionId: data.session_id,
      messageId: data.message_id,
      rating: data.rating,
    });
    try {
      await gatewayClient.post('/feedback', data);
      console.info('[ChatService] Feedback submitted successfully');
      return true;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to submit feedback:', {
        sessionId: data.session_id,
        messageId: data.message_id,
        error,
      });
      return false;
    }
  },

  // ==========================================
  // Tools (Gateway — /tools)
  // ==========================================

  /**
   * List all available tools with their categories and capabilities.
   * Used to show available AI capabilities in the chat UI.
   *
   * @endpoint GET /tools
   * @returns Tools list with id, name, description, category, capabilities
   * @throws {AxiosError} 401 if unauthorized, 403 if missing tools:view permission
   */
  async listTools(): Promise<ToolInfo[]> {
    console.info('[ChatService] Fetching available tools...');
    try {
      const res = await gatewayClient.get<ToolInfo[] | Record<string, unknown>>('/tools');
      // Backend may return array or dict — normalize to array
      const tools = Array.isArray(res.data)
        ? res.data
        : Object.entries(res.data).map(([id, info]) => ({
            id,
            ...(typeof info === 'object' && info !== null ? info : {}),
          }));
      console.info('[ChatService] Tools fetched:', { count: tools.length });
      return tools as ToolInfo[];
    } catch (error: unknown) {
      console.error('[ChatService] Failed to fetch tools:', error);
      throw error;
    }
  },

  /**
   * List tool categories for grouping in the UI.
   *
   * @endpoint GET /tools/categories
   * @returns Array of category names or category objects
   * @throws {AxiosError} 401 if unauthorized
   */
  async listToolCategories(): Promise<string[]> {
    console.info('[ChatService] Fetching tool categories...');
    try {
      const res = await gatewayClient.get<string[] | Record<string, unknown>>('/tools/categories');
      const categories = Array.isArray(res.data) ? res.data : Object.keys(res.data);
      console.info('[ChatService] Tool categories fetched:', { count: categories.length });
      return categories as string[];
    } catch (error: unknown) {
      console.error('[ChatService] Failed to fetch tool categories:', error);
      throw error;
    }
  },

  /**
   * Get detailed info for a specific tool.
   *
   * @endpoint GET /tools/{tool_id}
   * @param toolId - The tool identifier
   * @returns Tool details including args schema, capabilities, version
   * @throws {AxiosError} 404 if tool not found
   */
  async getToolDetail(toolId: string): Promise<ToolInfo> {
    console.info('[ChatService] Getting tool detail:', { toolId });
    try {
      const res = await gatewayClient.get<ToolInfo>(`/tools/${toolId}`);
      console.info('[ChatService] Tool detail fetched:', { id: toolId });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to get tool detail:', { toolId, error });
      throw error;
    }
  },

  // ==========================================
  // Memory (Orchestrator — /memory)
  // Note: These go through Gateway which proxies to Orchestrator
  // ==========================================

  /**
   * Get memories for a specific session.
   *
   * @endpoint GET /memory/session/{session_id}
   * @param sessionId - Session ID to get memories for
   * @param userId - User ID (required by backend)
   * @param limit - Max memories to return (default: 50)
   * @returns Array of memory entries
   * @throws {AxiosError} 401 if unauthorized
   */
  async getSessionMemories(
    sessionId: string,
    userId: string,
    limit = 50
  ): Promise<MemoryEntry[]> {
    console.info('[ChatService] Fetching session memories:', { sessionId, userId, limit });
    try {
      const res = await gatewayClient.get<MemoryEntry[]>(
        `/memory/session/${sessionId}`,
        { params: { user_id: userId, limit } }
      );
      const memories = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] Session memories fetched:', { count: memories.length });
      return memories;
    } catch (error: unknown) {
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;
      if (httpStatus === 404) {
        console.info('[ChatService] Session memories unavailable (404); returning empty list', {
          sessionId,
        });
        return [];
      }
      console.error('[ChatService] Failed to fetch session memories:', { sessionId, error });
      throw error;
    }
  },

  /**
   * Get all memories for the current user.
   *
   * @endpoint GET /memory/user/{user_id}
   * @param userId - User ID
   * @param limit - Max memories to return (default: 100)
   * @returns Array of memory entries
   * @throws {AxiosError} 401 if unauthorized
   */
  async getUserMemories(userId: string, limit = 100): Promise<MemoryEntry[]> {
    console.info('[ChatService] Fetching user memories:', { userId, limit });
    try {
      const res = await gatewayClient.get<MemoryEntry[]>(
        `/memory/user/${userId}`,
        { params: { limit } }
      );
      const memories = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] User memories fetched:', { count: memories.length });
      return memories;
    } catch (error: unknown) {
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;
      if (httpStatus === 404) {
        console.info('[ChatService] User memories unavailable (404); returning empty list', { userId });
        return [];
      }
      console.error('[ChatService] Failed to fetch user memories:', { userId, error });
      throw error;
    }
  },

  /**
   * Search across memories.
   *
   * @endpoint POST /memory/search
   * @param query - Search query text
   * @param userId - User ID
   * @param sessionId - Optional session ID to limit scope
   * @param scope - Search scope: 'session', 'user', or 'combined' (default: 'combined')
   * @param limit - Max results (default: 10)
   * @returns Array of matching memory entries
   * @throws {AxiosError} 401 if unauthorized
   */
  async searchMemories(
    query: string,
    userId: string,
    sessionId?: string,
    scope: 'session' | 'user' | 'combined' = 'combined',
    limit = 10
  ): Promise<MemoryEntry[]> {
    console.info('[ChatService] Searching memories:', { query, userId, scope, limit });
    try {
      const res = await gatewayClient.post<MemoryEntry[]>('/memory/search', null, {
        params: { query, user_id: userId, session_id: sessionId, scope, limit },
      });
      const memories = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] Memory search results:', { count: memories.length });
      return memories;
    } catch (error: unknown) {
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;
      if (httpStatus === 404) {
        console.info('[ChatService] Memory search unavailable (404); returning empty list');
        return [];
      }
      console.error('[ChatService] Failed to search memories:', { query, error });
      throw error;
    }
  },

  /**
   * Clear all memories for a specific session.
   *
   * @endpoint DELETE /memory/session/{session_id}
   * @param sessionId - Session ID to clear memories for
   * @param userId - User ID
   * @throws {AxiosError} 401 if unauthorized
   */
  async clearSessionMemories(sessionId: string, userId: string): Promise<void> {
    console.info('[ChatService] Clearing session memories:', { sessionId, userId });
    try {
      await gatewayClient.delete(`/memory/session/${sessionId}`, {
        params: { user_id: userId },
      });
      console.info('[ChatService] Session memories cleared:', { sessionId });
    } catch (error: unknown) {
      console.error('[ChatService] Failed to clear session memories:', { sessionId, error });
      throw error;
    }
  },

  /**
   * Clear all memories for a user.
   *
   * @endpoint DELETE /memory/user/{user_id}
   * @param userId - User ID
   * @throws {AxiosError} 401 if unauthorized
   */
  async clearUserMemories(userId: string): Promise<void> {
    console.info('[ChatService] Clearing all user memories:', { userId });
    try {
      await gatewayClient.delete(`/memory/user/${userId}`);
      console.info('[ChatService] All user memories cleared:', { userId });
    } catch (error: unknown) {
      console.error('[ChatService] Failed to clear user memories:', { userId, error });
      throw error;
    }
  },

  // ==========================================
  // Session Artifacts (Gateway — /storage/artifacts)
  // ==========================================

  /**
   * Get artifacts (uploaded files) for a specific chat session.
   *
   * @endpoint GET /storage/artifacts
   * @param sessionId - Session ID to get artifacts for
   * @param limit - Max artifacts to return (default: 50)
   * @param offset - Pagination offset (default: 0)
   * @returns Array of artifact objects
   * @throws {AxiosError} 401 if unauthorized
   */
  async getSessionArtifacts(
    sessionId: string,
    limit = 50,
    offset = 0
  ): Promise<StorageArtifact[]> {
    console.info('[ChatService] Fetching session artifacts:', { sessionId, limit, offset });
    try {
      const res = await gatewayClient.get<StorageArtifact[]>('/storage/artifacts', {
        params: { session_id: sessionId, limit, offset },
      });
      const artifacts = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] Session artifacts fetched:', { count: artifacts.length });
      return artifacts;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to fetch session artifacts:', { sessionId, error });
      throw error;
    }
  },

  /**
   * Delete an artifact from storage.
   *
   * @endpoint DELETE /storage/artifacts/{artifact_id}
   * @param artifactId - Artifact ID to delete
   * @throws {AxiosError} 404 if artifact not found
   */
  async deleteArtifact(artifactId: string): Promise<void> {
    console.info('[ChatService] Deleting artifact:', { artifactId });
    try {
      await gatewayClient.delete(`/storage/artifacts/${artifactId}`);
      console.info('[ChatService] Artifact deleted:', { artifactId });
    } catch (error: unknown) {
      console.error('[ChatService] Failed to delete artifact:', { artifactId, error });
      throw error;
    }
  },

  // ==========================================
  // Message Editing (Gateway — /chat/messages)
  // ==========================================

  /**
   * Update/edit a chat message content.
   *
   * @endpoint PATCH /chat/messages/{message_id}
   * @param messageId - Message ID to update
   * @param content - New message content
   * @returns Updated message object
   * @throws {AxiosError} 404 if message not found
   */
  async updateMessage(messageId: string, content: string): Promise<ChatMessage> {
    console.info('[ChatService] Updating message:', { messageId, contentLength: content.length });
    try {
      const res = await gatewayClient.patch<ChatMessage>(
        `/chat/messages/${messageId}`,
        { content }
      );
      console.info('[ChatService] Message updated:', { messageId });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to update message:', { messageId, error });
      throw error;
    }
  },

  /**
   * Persist orchestrator timeline metadata on a message (best-effort).
   * Gateways that do not support metadata PATCH will fail silently.
   *
   * @endpoint PATCH /chat/messages/{message_id}
   */
  async updateMessageTimeline(
    messageId: string,
    payload: {
      thinkingSteps?: ThinkingStep[];
      executionPlan?: ExecutionPlan | null;
      currentNode?: OrchestratorNodeName | null;
      overallConfidence?: number | null;
      replanCount?: number | null;
      thinkingDuration?: number | null;
      warnings?: WarningItem[];
      suggestions?: SuggestionItem[];
    }
  ): Promise<void> {
    console.info('[ChatService] Persisting message timeline metadata:', { messageId });
    try {
      await gatewayClient.patch(`/chat/messages/${messageId}`, {
        metadata: {
          thinking_steps: payload.thinkingSteps,
          execution_plan: payload.executionPlan ?? undefined,
          current_node: payload.currentNode ?? undefined,
          overall_confidence: payload.overallConfidence ?? undefined,
          replan_count: payload.replanCount ?? undefined,
          thinking_duration: payload.thinkingDuration ?? undefined,
          warnings: payload.warnings,
          suggestions: payload.suggestions,
        },
      });
      console.info('[ChatService] Message timeline metadata persisted:', { messageId });
    } catch (error: unknown) {
      // Non-fatal — backend may not accept metadata yet; localStorage cache remains primary.
      console.warn('[ChatService] Timeline metadata persist not supported (non-fatal):', {
        messageId,
        error,
      });
    }
  },

  // ==========================================
  // Session Export & Share (Gateway — /chat/sessions)
  // ==========================================

  /**
   * Export a chat session in the specified format.
   *
   * @endpoint GET /chat/sessions/{session_id}/export
   * @param sessionId - Session ID to export
   * @param format - Export format: json, markdown, txt, pdf
   * @returns Exported content as blob
   * @throws {AxiosError} 404 if session not found
   */
  async exportSession(sessionId: string, format: ExportFormat = 'json'): Promise<Blob> {
    console.info('[ChatService] Exporting session:', { sessionId, format });
    try {
      const res = await gatewayClient.get(
        `/chat/sessions/${sessionId}/export`,
        {
          params: { format },
          responseType: 'blob',
        }
      );
      console.info('[ChatService] Session exported:', { sessionId, format });
      return res.data as Blob;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to export session:', { sessionId, format, error });
      throw error;
    }
  },

  /**
   * Create a shareable link for a chat session.
   * The generated link is time-limited and accessible to anyone who has it.
   *
   * @endpoint POST /storage/chat/sessions/{session_id}/share
   * @param sessionId - Session ID to share
   * @param expiresHours - Link expiry in hours (e.g. 1, 24, 72, 168, 720), or 0/null for no expiration
   * @returns Share response with URL, share_id, and optional expiry timestamp
   * @throws {AxiosError} 404 if session not found
   */
  async shareSession(
    sessionId: string,
    expiresHours: ShareExpiryHours = 24
  ): Promise<ShareSessionResponse> {
    const neverExpires = expiresHours === 0 || expiresHours === null;
    console.info('[ChatService] Sharing session:', { sessionId, expiresHours, neverExpires });
    try {
      const res = await gatewayClient.post<ShareSessionResponse>(
        `/storage/chat/sessions/${sessionId}/share`,
        neverExpires ? { expires_at: null } : null,
        neverExpires
          ? { params: { expires_hours: 0 } }
          : { params: { expires_hours: expiresHours } }
      );
      console.info('[ChatService] Session shared:', {
        sessionId,
        shareUrl: res.data.share_url,
        expiresHours,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to share session:', { sessionId, error });
      throw error;
    }
  },

  /**
   * Share a session with specific users (in-app, read-only).
   * @endpoint POST /chat/sessions/{session_id}/shares
   */
  async shareSessionWithUsers(
    sessionId: string,
    body: ShareSessionWithUsersRequest
  ): Promise<ShareSessionWithUsersResponse> {
    console.info('[ChatService] Sharing session with users:', {
      sessionId,
      count: body.recipient_user_ids.length,
    });
    const res = await gatewayClient.post<ShareSessionWithUsersResponse>(
      `/chat/sessions/${sessionId}/shares`,
      body
    );
    return res.data;
  },

  /**
   * List users a session is shared with.
   * @endpoint GET /chat/sessions/{session_id}/shares
   */
  async listSessionShares(sessionId: string): Promise<SessionShareRecipient[]> {
    try {
      const res = await gatewayClient.get<SessionShareRecipient[]>(
        `/chat/sessions/${sessionId}/shares`
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: unknown) {
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;
      if (httpStatus === 404) {
        console.info('[ChatService] Session shares unavailable (404); returning empty list', {
          sessionId,
        });
        return [];
      }
      console.error('[ChatService] Failed to list session shares:', { sessionId, error });
      throw error;
    }
  },

  /**
   * Revoke a user's access to a shared session.
   * @endpoint DELETE /chat/sessions/{session_id}/shares/{user_id}
   */
  async revokeSessionShare(sessionId: string, userId: string): Promise<void> {
    console.info('[ChatService] Revoking session share:', { sessionId, userId });
    await gatewayClient.delete(`/chat/sessions/${sessionId}/shares/${userId}`);
  },

  /**
   * List sessions shared with the current user.
   * @endpoint GET /chat/sessions/shared-with-me
   */
  async listSharedWithMe(limit = 50): Promise<SharedWithMeSession[]> {
    try {
      const res = await gatewayClient.get<SharedWithMeSession[]>('/chat/sessions/shared-with-me', {
        params: { limit },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: unknown) {
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;
      if (httpStatus === 404) {
        console.info('[ChatService] shared-with-me unavailable (404); returning empty list');
        return [];
      }
      console.error('[ChatService] Failed to list shared-with-me sessions:', error);
      throw error;
    }
  },

  /**
   * Resolve a public share token to session metadata (no auth).
   * @endpoint GET /storage/chat/shares/{token}/resolve
   */
  async resolvePublicShare(token: string): Promise<PublicShareResolveResponse> {
    console.info('[ChatService] Resolving public share token');
    const res = await gatewayClient.get<PublicShareResolveResponse>(
      `/storage/chat/shares/${token}/resolve`
    );
    return res.data;
  },

  /**
   * Fetch read-only messages for a public share token (no auth).
   * @endpoint GET /storage/chat/shares/{token}/messages
   */
  async getPublicShareMessages(token: string, limit = 100): Promise<PublicShareMessage[]> {
    console.info('[ChatService] Fetching public share messages');
    const res = await gatewayClient.get<PublicShareMessage[]>(
      `/storage/chat/shares/${token}/messages`,
      { params: { limit } }
    );
    return Array.isArray(res.data) ? res.data : [];
  },

  // ==========================================
  // Folders, search, fork, projects, import (BE stubs — graceful 404)
  // ==========================================

  async listSessionFolders(): Promise<ChatSessionFolder[]> {
    try {
      const res = await gatewayClient.get<ChatSessionFolder[]>('/chat/sessions/folders');
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return [];
      throw error;
    }
  },

  async createSessionFolder(body: { name: string; color?: string }): Promise<ChatSessionFolder> {
    const res = await gatewayClient.post<ChatSessionFolder>('/chat/sessions/folders', body);
    return res.data;
  },

  async moveSessionToFolder(sessionId: string, folderId: string | null): Promise<void> {
    await gatewayClient.patch(`/chat/sessions/${sessionId}`, { folder_id: folderId });
  },

  async updateSessionFolder(
    id: string,
    body: { name?: string; color?: string }
  ): Promise<ChatSessionFolder> {
    const res = await gatewayClient.patch<ChatSessionFolder>(
      `/chat/sessions/folders/${id}`,
      body
    );
    return res.data;
  },

  async deleteSessionFolder(id: string): Promise<void> {
    await gatewayClient.delete(`/chat/sessions/folders/${id}`);
  },

  async createChatProject(body: Partial<ChatProject> & { name: string }): Promise<ChatProject> {
    const res = await gatewayClient.post<ChatProject>('/chat/projects', body);
    return res.data;
  },

  async updateChatProject(id: string, body: Partial<ChatProject>): Promise<ChatProject> {
    const res = await gatewayClient.patch<ChatProject>(`/chat/projects/${id}`, body);
    return res.data;
  },

  async deleteChatProject(id: string): Promise<void> {
    await gatewayClient.delete(`/chat/projects/${id}`);
  },

  async assignSessionToProject(sessionId: string, projectId: string | null): Promise<void> {
    await gatewayClient.patch(`/chat/sessions/${sessionId}`, { project_id: projectId });
  },

  async exportAllSessions(params?: {
    format?: string;
    include_files?: boolean;
  }): Promise<Blob> {
    const res = await gatewayClient.get('/chat/sessions/export-all', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  async searchChat(body: ChatSearchRequest): Promise<ChatSearchHit[]> {
    try {
      const res = await gatewayClient.post<ChatSearchHit[]>('/chat/search', body);
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return [];
      throw error;
    }
  },

  async forkSession(
    sessionId: string,
    body: { up_to_message_id: string; title?: string }
  ): Promise<ForkSessionResponse> {
    const res = await gatewayClient.post<ForkSessionResponse>(
      `/chat/sessions/${sessionId}/fork`,
      body
    );
    return res.data;
  },

  async listChatProjects(): Promise<ChatProject[]> {
    try {
      const res = await gatewayClient.get<ChatProject[]>('/chat/projects');
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return [];
      throw error;
    }
  },

  async importSessionsBackup(file: File): Promise<ChatImportResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await gatewayClient.post<ChatImportResult>('/chat/sessions/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // ==========================================
  // File Operations (Gateway — /storage/artifacts)
  // ==========================================

  /**
   * Get thumbnail URL for an artifact (images/videos).
   * Backend generates a resized thumbnail for faster loading.
   *
   * Uses WebP format by default for ~47% smaller file size vs JPEG.
   * Backend supports: format=webp|jpeg|png, quality=1-100
   *
   * Response includes cache headers (Cache-Control, ETag) for browser caching.
   *
   * @endpoint GET /storage/files/{artifact_id}/thumbnail
   * @param artifactId - Artifact UUID
   * @param width - Thumbnail width px (32-800, default 200)
   * @param height - Thumbnail height px (32-800, default 200)
   * @param format - Image format: 'webp' | 'jpeg' | 'png' (default 'webp')
   * @param quality - Compression quality 1-100 (default 80)
   * @returns Full URL for the thumbnail endpoint with query params
   */
  getArtifactThumbnailUrl(
    artifactId: string,
    width = 200,
    height = 200,
    format: 'webp' | 'jpeg' | 'png' = 'webp',
    quality = 80,
    mimeType?: string
  ): string | null {
    if (mimeType?.includes('svg')) {
      return `${STORAGE_BASE_URL}/storage/artifacts/${artifactId}/download`;
    }
    if (!supportsStorageThumbnailEndpoint(mimeType)) {
      return null;
    }
    const w = Math.max(32, Math.min(800, Math.round(width)));
    const h = Math.max(32, Math.min(800, Math.round(height)));
    const url = `${STORAGE_BASE_URL}/storage/files/${artifactId}/thumbnail?width=${w}&height=${h}&format=${format}&quality=${quality}`;
    debugLog.thumbnail('Thumbnail URL generated', {
      artifactId,
      width: w,
      height: h,
      format,
      quality,
      url,
    });
    return url;
  },

  /**
   * Get a pre-signed URL for direct MinIO access.
   * Bypasses Gateway proxy — provides native Range request support for
   * video/audio streaming. Dramatically faster than authenticated blob fetch.
   *
   * @endpoint GET /storage/files/{artifact_id}/presigned-url
   * @param artifactId - Artifact UUID
   * @param expiresSeconds - URL validity in seconds (default 3600 = 1h)
   * @returns Pre-signed URL that can be used directly as <video src>
   * @throws {AxiosError} If the artifact is not found
   */
  async getPresignedUrl(
    artifactId: string,
    expiresSeconds = 3600
  ): Promise<PresignedUrlResponse> {
    console.info('[ChatService] Getting presigned URL:', { artifactId, expiresSeconds });
    try {
      const res = await gatewayClient.get<PresignedUrlResponse>(
        `/storage/files/${artifactId}/presigned-url`,
        { params: { expires: expiresSeconds } }
      );
      console.info('[ChatService] Presigned URL obtained:', { artifactId, expiresIn: res.data.expires_in });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to get presigned URL:', { artifactId, error });
      throw error;
    }
  },

  /**
   * Convert a StorageToolRun (backend persistence format) to ToolRunInfo (frontend display format).
   *
   * Field mapping:
   * - `inputs` → `args`
   * - `output` → `result`
   * - `elapsed_ms` (ms) → `execution_time` (seconds)
   * - `created_at` → `started_at` / `completed_at`
   * - missing `status` → derived from `output` presence
   *
   * @param run - Raw tool run from backend storage
   * @returns Normalized tool run for frontend rendering
   */
  normalizeStorageToolRun(run: StorageToolRun): ToolRunInfo {
    // Delegate to centralized normalizer (DRY — same logic used in use-chat.ts)
    return normalizeStorageToolRunUtil(run);
  },

  /**
   * Attach tool runs to their corresponding assistant messages.
   *
   * Tool runs are sorted by created_at and attached to the assistant message
   * that follows them chronologically. If message_id is available in tool runs,
   * it's used for precise matching.
   *
   * StorageToolRun objects are normalized to ToolRunInfo format before attachment.
   *
   * @param messages - Array of chat messages to modify in-place
   * @param toolRuns - Array of tool runs to attach
   */
  attachToolRunsToMessages(
    messages: ChatMessage[],
    toolRuns: StorageToolRun[]
  ): void {
    if (toolRuns.length === 0) return;

    // Sort tool runs by created_at
    const sortedRuns = [...toolRuns].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Group by message_id if available
    const runsByMessageId = new Map<string, StorageToolRun[]>();
    for (const run of sortedRuns) {
      const msgId = run.message_id ?? 'unknown';
      if (!runsByMessageId.has(msgId)) runsByMessageId.set(msgId, []);
      runsByMessageId.get(msgId)!.push(run);
    }

    // If message_id is available, attach precisely (normalized)
    let merged = false;
    for (const msg of messages) {
      if (msg.role === 'assistant' && runsByMessageId.has(msg.id)) {
        const rawRuns = runsByMessageId.get(msg.id)!;
        msg.tool_runs = rawRuns.map((r) => this.normalizeStorageToolRun(r));
        merged = true;
      }
    }

    // Fallback: attach tool runs to assistant messages based on timing
    // Each assistant message gets tool runs that were executed before it
    // but after the previous assistant message.
    if (!merged) {
      const assistantMessages = messages.filter((m) => m.role === 'assistant');
      if (assistantMessages.length === 0) {
        // No assistant messages — nothing to attach to
        return;
      }

      for (let i = 0; i < assistantMessages.length; i++) {
        const msg = assistantMessages[i];
        const msgTime = new Date(msg.created_at || 0).getTime();
        const prevTime =
          i > 0
            ? new Date(assistantMessages[i - 1].created_at || 0).getTime()
            : 0;

        const relatedRuns = sortedRuns.filter((tr) => {
          const trTime = new Date(tr.created_at).getTime();
          return trTime > prevTime && trTime <= msgTime;
        });

        if (relatedRuns.length > 0) {
          msg.tool_runs = relatedRuns.map((r) => this.normalizeStorageToolRun(r));
        }
      }
    }
  },

  /**
   * Get tool runs for a specific session from Storage Service.
   * Backend persists tool_runs separately from messages, so we fetch
   * and merge them client-side.
   *
   * @endpoint GET /storage/tool-runs?session_id={id}
   * @param sessionId - Session ID to get tool runs for
   * @param limit - Max tool runs to return (default 100)
   * @returns Array of tool run records from storage
   */
  async getSessionToolRuns(
    sessionId: string,
    limit = 100
  ): Promise<StorageToolRun[]> {
    console.info('[ChatService] Fetching tool runs for session:', { sessionId });
    try {
      const res = await gatewayClient.get<StorageToolRun[]>(
        '/storage/tool-runs',
        { params: { session_id: sessionId, limit } }
      );
      const runs = Array.isArray(res.data) ? res.data : [];
      console.info('[ChatService] Tool runs fetched:', { sessionId, count: runs.length });
      return runs;
    } catch (error: unknown) {
      // Non-critical: tool runs are best-effort
      console.warn('[ChatService] Tool runs fetch failed:', { sessionId, error });
      return [];
    }
  },

  /**
   * Get preview URL for a non-image file (PDF first page, document excerpt).
   * Backend generates a preview representation.
   *
   * @endpoint GET /storage/files/{artifact_id}/preview
   * @param artifactId - Artifact ID
   * @param page - Page number for multi-page documents (default 1)
   * @returns Preview URL string
   */
  getArtifactPreviewUrl(artifactId: string, page = 1): string {
    return `${STORAGE_BASE_URL}/storage/files/${artifactId}/preview?page=${page}`;
  },

  /**
   * Get detailed metadata for a file/artifact.
   *
   * @endpoint GET /storage/artifacts/{artifact_id}/metadata
   * @param artifactId - Artifact ID
   * @returns Detailed file metadata
   * @throws {AxiosError} 404 if artifact not found
   */
  async getFileMetadata(artifactId: string): Promise<FileMetadata> {
    console.info('[ChatService] Fetching file metadata:', { artifactId });
    try {
      const res = await gatewayClient.get<FileMetadata>(
        `/storage/artifacts/${artifactId}/metadata`
      );
      console.info('[ChatService] File metadata fetched:', { artifactId });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to fetch file metadata:', { artifactId, error });
      throw error;
    }
  },

  /**
   * Trigger analysis on a file (OCR, content extraction, etc.).
   *
   * @endpoint PUT /storage/artifacts/{artifact_id}/analyze
   * @param artifactId - Artifact ID to analyze
   * @returns Analysis result
   * @throws {AxiosError} 404 if artifact not found
   */
  async analyzeFile(artifactId: string): Promise<FileAnalysisResult> {
    console.info('[ChatService] Analyzing file:', { artifactId });
    try {
      const res = await gatewayClient.put<FileAnalysisResult>(
        `/storage/artifacts/${artifactId}/analyze`
      );
      console.info('[ChatService] File analyzed:', { artifactId, status: res.data.status });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to analyze file:', { artifactId, error });
      throw error;
    }
  },

  /**
   * Get preview data for a file (text excerpt, image preview, etc.).
   *
   * @endpoint GET /storage/artifacts/{artifact_id}/preview
   * @param artifactId - Artifact ID
   * @returns Preview data with content and type
   * @throws {AxiosError} 404 if artifact not found
   */
  async getFilePreview(artifactId: string): Promise<FilePreviewData> {
    console.info('[ChatService] Fetching file preview:', { artifactId });
    try {
      const res = await gatewayClient.get<FilePreviewData>(
        `/storage/artifacts/${artifactId}/preview`
      );
      console.info('[ChatService] File preview fetched:', { artifactId, type: res.data.type });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to fetch file preview:', { artifactId, error });
      throw error;
    }
  },

  // ==========================================
  // Storage Quota (Gateway — /storage/quota)
  // ==========================================

  /**
   * Get storage quota info for the current user.
   *
   * @endpoint GET /storage/quota
   * @returns Storage quota with used, total, remaining bytes
   * @throws {AxiosError} 401 if unauthorized
   */
  async getStorageQuota(): Promise<StorageQuota> {
    console.info('[ChatService] Fetching storage quota...');
    try {
      const res = await gatewayClient.get<StorageQuota>('/storage/quota');
      console.info('[ChatService] Storage quota fetched:', {
        usagePercent: res.data.usage_percent,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to fetch storage quota:', error);
      throw error;
    }
  },

  // ==========================================
  // Chunked Upload (Gateway — /storage/upload)
  // ==========================================

  /** Threshold for using chunked upload (20 MB) */
  CHUNKED_UPLOAD_THRESHOLD: 20 * 1024 * 1024,

  /**
   * Initialize a chunked upload session.
   *
   * @endpoint POST /storage/upload/init
   * @param request - Upload metadata (filename, total_size, content_type, session_id)
   * @returns Upload session ID and chunk info
   * @throws {AxiosError} 401 if unauthorized
   */
  async initChunkedUpload(
    request: ChunkedUploadInitRequest
  ): Promise<ChunkedUploadInitResponse> {
    console.info('[ChatService] Initializing chunked upload:', {
      filename: request.filename,
      totalSize: request.total_size,
      totalChunks: request.total_chunks,
      mimeType: request.mime_type,
    });
    try {
      const res = await gatewayClient.post<ChunkedUploadInitResponse>(
        '/storage/upload/init',
        request
      );
      console.info('[ChatService] Chunked upload initialized:', {
        uploadId: res.data.upload_id,
        totalChunks: res.data.total_chunks,
        chunkSize: res.data.chunk_size,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to init chunked upload:', { filename: request.filename, error });
      throw error;
    }
  },

  /**
   * Upload a single chunk of a chunked upload.
   *
   * @endpoint PUT /storage/upload/{upload_id}/chunk/{chunk_index}
   * @param uploadId - Upload session ID from initChunkedUpload
   * @param chunkIndex - Zero-based chunk index
   * @param chunkData - Raw binary data for this chunk
   * @returns Confirmation of chunk receipt
   * @throws {AxiosError} 400 if chunk index invalid, 404 if upload not found
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Blob
  ): Promise<ChunkedUploadChunkResponse> {
    const formData = new FormData();
    // WHY: Backend OpenAPI spec requires the field name to be 'file', not 'chunk'.
    // Using 'chunk' caused 422 Validation Error on PUT /storage/upload/{id}/chunk/{idx}.
    formData.append('file', chunkData);
    const res = await gatewayClient.put<ChunkedUploadChunkResponse>(
      `/storage/upload/${uploadId}/chunk/${chunkIndex}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: this.UPLOAD_TIMEOUT,
      }
    );
    return res.data;
  },

  /**
   * Complete a chunked upload and assemble all chunks.
   *
   * @endpoint POST /storage/upload/{upload_id}/complete
   * @param uploadId - Upload session ID
   * @returns Final artifact info
   * @throws {AxiosError} 400 if chunks are missing
   */
  async completeChunkedUpload(
    uploadId: string
  ): Promise<ChunkedUploadCompleteResponse> {
    console.info('[ChatService] Completing chunked upload:', { uploadId });
    try {
      const res = await gatewayClient.post<ChunkedUploadCompleteResponse>(
        `/storage/upload/${uploadId}/complete`
      );
      console.info('[ChatService] Chunked upload completed:', {
        uploadId,
        artifactId: res.data.artifact_id,
        filename: res.data.filename,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[ChatService] Failed to complete chunked upload:', { uploadId, error });
      throw error;
    }
  },

  /**
   * Get the status of a chunked upload.
   *
   * @endpoint GET /storage/upload/{upload_id}/status
   * @param uploadId - Upload session ID
   * @returns Upload progress info
   */
  async getUploadStatus(
    uploadId: string
  ): Promise<ChunkedUploadStatusResponse> {
    const res = await gatewayClient.get<ChunkedUploadStatusResponse>(
      `/storage/upload/${uploadId}/status`
    );
    return res.data;
  },

  /**
   * Cancel and clean up a chunked upload.
   *
   * @endpoint DELETE /storage/upload/{upload_id}
   * @param uploadId - Upload session ID to cancel
   */
  async cancelChunkedUpload(uploadId: string): Promise<void> {
    console.info('[ChatService] Cancelling chunked upload:', { uploadId });
    await gatewayClient.delete(`/storage/upload/${uploadId}`);
    console.info('[ChatService] Chunked upload cancelled:', { uploadId });
  },

  /**
   * Smart upload: automatically uses chunked upload for large files (>20MB)
   * and regular single-file upload for smaller files.
   *
   * @param file - File to upload
   * @param sessionId - Chat session ID
   * @param onProgress - Progress callback (0-100)
   * @param signal - AbortSignal for cancellation
   * @returns Artifact input from the uploaded file
   */
  async smartUpload(
    file: File,
    sessionId: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<ArtifactInput> {
    // Use regular upload for small files
    if (file.size <= this.CHUNKED_UPLOAD_THRESHOLD) {
      return this.uploadSingleFile(file, sessionId, onProgress, signal);
    }

    // Large file → chunked upload
    console.info('[ChatService] Using chunked upload for large file:', {
      name: file.name,
      size: file.size,
      threshold: this.CHUNKED_UPLOAD_THRESHOLD,
    });

    // Step 1: Initialize
    // Backend requires total_chunks in init request — calculate from default 5MB chunk size
    const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const estimatedTotalChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE);

    const init = await this.initChunkedUpload({
      filename: sanitizeFilename(file.name),
      total_size: file.size,
      total_chunks: estimatedTotalChunks,
      mime_type: inferMimeType(file.name, file.type),
      session_id: sessionId,
    });

    const { upload_id, chunk_size, total_chunks } = init;

    try {
      // Step 2: Upload chunks sequentially
      for (let i = 0; i < total_chunks; i++) {
        if (signal?.aborted) {
          await this.cancelChunkedUpload(upload_id);
          throw new DOMException('Upload cancelled', 'AbortError');
        }

        const start = i * chunk_size;
        const end = Math.min(start + chunk_size, file.size);
        const chunkBlob = file.slice(start, end);

        await this.uploadChunk(upload_id, i, chunkBlob);

        // Report progress
        if (onProgress) {
          const percent = Math.round(((i + 1) / total_chunks) * 100);
          onProgress(percent);
        }
      }

      // Step 3: Complete
      const result = await this.completeChunkedUpload(upload_id);

      return {
        id: result.artifact_id,
        path: result.artifact_id,
        name: result.filename,
        mime_type: result.content_type,
        size: result.total_size,
      };
    } catch (error: unknown) {
      // Clean up on failure (except if already cancelled)
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        try {
          await this.cancelChunkedUpload(upload_id);
        } catch {
          // Best-effort cleanup
        }
      }
      throw error;
    }
  },

  // ==========================================
  // API health probes (route existence vs empty data)
  // ==========================================

  /**
   * Lightweight probes to detect whether optional gateway routes exist.
   * Distinguishes 404 (route missing) from 401/403/400 (route exists).
   */
  async probeApiHealth(): Promise<{
    memory: 'available' | 'unavailable';
    tools: 'available' | 'unavailable';
    feedback: 'available' | 'unavailable';
  }> {
    const PROBE_SESSION = '00000000-0000-0000-0000-000000000000';
    const PROBE_USER = 'probe';

    const httpStatus = (error: unknown): number | undefined =>
      (error as { response?: { status?: number } })?.response?.status;

    const probeTools = async (): Promise<'available' | 'unavailable'> => {
      try {
        await gatewayClient.get('/tools');
        return 'available';
      } catch (error: unknown) {
        const status = httpStatus(error);
        if (status === 404 || (status != null && status >= 500)) return 'unavailable';
        return 'available';
      }
    };

    const probeMemory = async (): Promise<'available' | 'unavailable'> => {
      try {
        await gatewayClient.get(`/memory/session/${PROBE_SESSION}`, {
          params: { user_id: PROBE_USER, limit: 1 },
        });
        return 'available';
      } catch (error: unknown) {
        const status = httpStatus(error);
        if (status === 404 || status === 405) return 'unavailable';
        if (
          status === 401 ||
          status === 403 ||
          status === 400 ||
          status === 422
        ) {
          return 'available';
        }
        if (status != null && status >= 500) return 'unavailable';
        return 'available';
      }
    };

    const probeFeedback = async (): Promise<'available' | 'unavailable'> => {
      try {
        await gatewayClient.post('/feedback', {
          session_id: PROBE_SESSION,
          message_id: PROBE_SESSION,
          rating: 1,
        });
        return 'available';
      } catch (error: unknown) {
        const status = httpStatus(error);
        if (status === 404 || status === 405) return 'unavailable';
        if (
          status === 400 ||
          status === 422 ||
          status === 401 ||
          status === 403
        ) {
          return 'available';
        }
        if (status != null && status >= 500) return 'unavailable';
        return 'available';
      }
    };

    const [memory, tools, feedback] = await Promise.all([
      probeMemory(),
      probeTools(),
      probeFeedback(),
    ]);

    console.info('[ChatService] API health probe:', { memory, tools, feedback });
    return { memory, tools, feedback };
  },

  /**
   * Probe optional feature routes: folders, projects, search, import, export-all.
   */
  async probeFeatureHealth(): Promise<{
    folders: 'available' | 'unavailable';
    projects: 'available' | 'unavailable';
    search: 'available' | 'unavailable';
    import: 'available' | 'unavailable';
    exportAll: 'available' | 'unavailable';
  }> {
    const httpStatus = (error: unknown): number | undefined =>
      (error as { response?: { status?: number } })?.response?.status;

    const probeGet = async (path: string): Promise<'available' | 'unavailable'> => {
      try {
        await gatewayClient.get(path);
        return 'available';
      } catch (error: unknown) {
        const status = httpStatus(error);
        if (status === 404 || (status != null && status >= 500)) return 'unavailable';
        return 'available';
      }
    };

    const probePostEmpty = async (
      path: string,
      body: Record<string, unknown>
    ): Promise<'available' | 'unavailable'> => {
      try {
        await gatewayClient.post(path, body);
        return 'available';
      } catch (error: unknown) {
        const status = httpStatus(error);
        if (status === 404 || status === 405) return 'unavailable';
        if (status === 400 || status === 401 || status === 403 || status === 422) {
          return 'available';
        }
        if (status != null && status >= 500) return 'unavailable';
        return 'available';
      }
    };

    const [folders, projects, search, importFeature, exportAll] = await Promise.all([
      probePostEmpty('/chat/sessions/folders', { name: '__fe_probe__' }),
      probeGet('/chat/projects'),
      probePostEmpty('/chat/search', { query: 'probe', limit: 1 }),
      probePostEmpty('/chat/sessions/import', {}),
      probeGet('/chat/sessions/export-all'),
    ]);

    const result = { folders, projects, search, import: importFeature, exportAll };
    console.info('[ChatService] Feature health probe:', result);
    return result;
  },
};

