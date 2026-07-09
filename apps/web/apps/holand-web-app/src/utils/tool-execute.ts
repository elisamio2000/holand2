// ============================================
// Gateway tool execute response helpers
// Payload lives at result.data (see ToolExecuteResponse in storage.types.ts)
// ============================================

import type {
  FileManagerShareResult,
  ToolExecuteResponse,
} from '@/types/storage.types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Unwrap plugin.file_manager.share — token may be on payload or nested `share`. */
export function normalizeFileManagerShareResult(
  raw: unknown
): FileManagerShareResult | null {
  if (!isRecord(raw)) return null;

  const fromShareRow = (row: Record<string, unknown>): FileManagerShareResult | null => {
    const token = typeof row.token === 'string' ? row.token.trim() : '';
    if (!token) return null;
    return {
      token,
      expires_at: typeof row.expires_at === 'string' ? row.expires_at : undefined,
      gateway_download_path:
        typeof row.gateway_download_path === 'string'
          ? row.gateway_download_path
          : undefined,
      gateway_resolve_path:
        typeof row.gateway_resolve_path === 'string'
          ? row.gateway_resolve_path
          : undefined,
      revoked: row.revoked_at != null || row.revoked === true,
    };
  };

  const direct = fromShareRow(raw);
  if (direct) return direct;

  const nested = raw.share;
  if (isRecord(nested)) {
    return fromShareRow(nested);
  }

  if (raw.revoked === true) {
    return { revoked: true };
  }

  return null;
}

/** Unwrap gateway POST /tools/{tool_id}/execute body to inner data payload. */
export function unwrapToolExecuteData<T = unknown>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return null;

  const envelope = raw as ToolExecuteResponse<T> & Record<string, unknown>;

  if (envelope.result?.data !== undefined && envelope.result.data !== null) {
    return envelope.result.data as T;
  }

  if (envelope.data !== undefined && envelope.data !== null) {
    return envelope.data as T;
  }

  // Already-unwrapped inner payload (e.g. smart_search result.data passed directly)
  if (Array.isArray((envelope as Record<string, unknown>).lanes)) {
    return envelope as T;
  }

  return null;
}

/** Read optional metadata.notes map from smart_search result.data. */
export function extractToolMetadataNotes(
  data: Record<string, unknown> | null | undefined
): Record<string, string> | undefined {
  if (!data) return undefined;

  const metadata = data.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;

  const notes = (metadata as Record<string, unknown>).notes;
  if (!notes || typeof notes !== 'object') return undefined;

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(notes as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Read optional result.channels.llm summary from gateway tool execute envelope. */
export function extractToolLlmSummary(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const envelope = raw as ToolExecuteResponse & Record<string, unknown>;
  const result = envelope.result;
  if (!result || typeof result !== 'object') return undefined;

  const channels = (result as Record<string, unknown>).channels;
  if (!channels || typeof channels !== 'object') return undefined;

  const llm = (channels as Record<string, unknown>).llm;
  if (typeof llm !== 'string') return undefined;

  const trimmed = llm.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Read metadata.query_image.artifact_id echoed by smart_search. */
export function extractQueryImageEcho(
  data: Record<string, unknown> | null | undefined
): string | undefined {
  if (!data) return undefined;

  const metadata = data.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;

  const queryImage = (metadata as Record<string, unknown>).query_image;
  if (!queryImage || typeof queryImage !== 'object') return undefined;

  const artifactId = (queryImage as Record<string, unknown>).artifact_id;
  if (typeof artifactId !== 'string') return undefined;

  const trimmed = artifactId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
