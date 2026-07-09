// ============================================
// Import WebSocket utilities — URL building, auth, message parsing
// ============================================

import type { QueueStatusResponse } from '@/types/case-importer.types';

export type ImportWsPath = 'queue' | 'case' | 'staging';

export interface ImportWsInfo {
  websocket_base?: string;
  paths?: {
    case_progress?: string;
    queue?: string;
    staging_upload?: string;
  };
  auth?: {
    header?: string;
    query?: string;
  };
}

export interface CaseProgressUpdate {
  case_id: string;
  overall: number;
  phase: string;
  phase_label_fa?: string;
  steps?: unknown[];
  current_file?: string;
  control?: unknown;
  status?: string;
  files_processed?: number;
  files_total?: number;
}

export interface StagingUploadUpdate {
  session_id: string;
  overall: number;
  phase?: string;
  current_file?: string;
  files_uploaded?: number;
  files_total?: number;
}

import { getImportWsBaseUrl } from '@/lib/service-urls';

function normalizeProgressFraction(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value > 1 && value <= 100) return value / 100;
  if (value > 100) return 1;
  return value;
}

/** Resolve WebSocket base URL for import endpoints. */
export function resolveImportWsBaseUrl(): string {
  return getImportWsBaseUrl();
}

/** Build authenticated WebSocket URL for import channels. */
export function buildImportWsUrl(
  path: ImportWsPath,
  options?: { id?: string; accessToken?: string }
): string {
  const base = resolveImportWsBaseUrl();
  let url: string;

  switch (path) {
    case 'queue':
      url = `${base}/import/ws/queue`;
      break;
    case 'case':
      if (!options?.id) throw new Error('case id required for case progress WebSocket');
      url = `${base}/import/ws/${encodeURIComponent(options.id)}`;
      break;
    case 'staging':
      if (!options?.id) throw new Error('staging session id required');
      url = `${base}/import/ws/staging/${encodeURIComponent(options.id)}`;
      break;
    default:
      throw new Error(`Unknown import ws path: ${path}`);
  }

  if (options?.accessToken) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}access_token=${encodeURIComponent(options.accessToken)}`;
  }

  return url;
}

/** Parse raw WebSocket message into queue status if possible. */
export function parseQueueStatusMessage(raw: string): QueueStatusResponse | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof data.queue_size === 'number' &&
      Array.isArray(data.active_jobs) &&
      Array.isArray(data.queued_jobs)
    ) {
      return data as unknown as QueueStatusResponse;
    }
    if (data.type === 'queue_update' && data.payload) {
      return parseQueueStatusMessage(JSON.stringify(data.payload));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns true when a queue WS event suggests state changed but no full snapshot was provided.
 * Used to trigger a throttled REST fallback refresh.
 */
export function shouldRefreshQueueFromWsMessage(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const type = String(data.type ?? '').toLowerCase();
    if (!type) return false;
    return [
      'queue_update',
      'queue_invalidated',
      'job_started',
      'job_finished',
      'job_failed',
      'job_cancelled',
      'job_retried',
    ].includes(type);
  } catch {
    return false;
  }
}

/** Parse import_progress event from WebSocket message. */
export function parseCaseProgressMessage(
  raw: string,
  fallbackCaseId?: string
): CaseProgressUpdate | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const payload =
      data.type === 'import_progress'
        ? data
        : typeof data.payload === 'object' && data.payload
          ? (data.payload as Record<string, unknown>)
          : data;

    const caseId =
      (payload.case_id as string) ||
      (payload.caseId as string) ||
      fallbackCaseId;
    if (!caseId) return null;

    return {
      case_id: caseId,
      overall: normalizeProgressFraction(payload.overall ?? payload.progress),
      phase: String(payload.phase ?? payload.status ?? ''),
      phase_label_fa: payload.phase_label_fa as string | undefined,
      steps: payload.steps as unknown[] | undefined,
      current_file: payload.current_file as string | undefined,
      control: payload.control,
      status: payload.status as string | undefined,
      files_processed: payload.files_processed as number | undefined,
      files_total: payload.files_total as number | undefined,
    };
  } catch {
    return null;
  }
}

/** Parse staging upload progress from WebSocket message. */
export function parseStagingUploadMessage(
  raw: string,
  fallbackSessionId?: string
): StagingUploadUpdate | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const payload =
      data.type === 'staging_progress' ||
      data.type === 'upload_progress' ||
      data.type === 'import_progress'
        ? data
        : typeof data.payload === 'object' && data.payload
          ? (data.payload as Record<string, unknown>)
          : data;

    const sessionId =
      (payload.session_id as string) ||
      (payload.staging_id as string) ||
      (payload.staging_session_id as string) ||
      fallbackSessionId;
    if (!sessionId) return null;

    return {
      session_id: sessionId,
      overall: normalizeProgressFraction(
        payload.overall ?? payload.progress ?? payload.upload_progress
      ),
      phase: payload.phase as string | undefined,
      current_file: payload.current_file as string | undefined,
      files_uploaded: payload.files_uploaded as number | undefined,
      files_total: payload.files_total as number | undefined,
    };
  } catch {
    return null;
  }
}

/** Exponential backoff delays for reconnect (ms). */
export function getReconnectDelay(attempt: number, maxMs = 30000): number {
  return Math.min(1000 * 2 ** attempt, maxMs);
}
