// Helpers to map Case Import API payloads â†’ UI (GET /import/list, queue, detail).
// Backend shapes: @/types/case-importer.types (snake_case, epoch seconds on list/detail).

import type { CaseDetail, CaseListItem, CaseStatus } from '@/types/case-importer.types';
import { scopedWorkspaceCacheKey } from '@/lib/workspace-cache';
import { readStoredWorkspaceId } from '@/lib/workspace-group-id';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parseEpochSeconds(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (!Number.isNaN(n) && n !== 0) return parseEpochSeconds(n);
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}

/** Extract case rows from GET /import/list body (handles legacy/wrapped shapes). */
export function extractCasesFromListPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.cases)) return o.cases;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.results)) return o.results;
  }
  return [];
}

/** Normalize one list row to CaseListItem. */
export function normalizeCaseListItem(raw: unknown): CaseListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const stats = isRecord(r.stats) ? r.stats : null;

  const case_id = String(
    r.case_id ?? r.caseId ?? r.id ?? r.caseID ?? ''
  ).trim();
  if (!case_id) return null;

  const case_name = String(
    r.case_name ?? 
    r.caseName ?? 
    r.name ??
    r.title ?? 
    case_id
  ).trim();

  const filesFromArray = Array.isArray(r.files) ? r.files.length : 0;

  let metadata_files_count = 0;
  if (typeof r.metadata === 'string' && r.metadata.trim()) {
    try {
      const metaObj: unknown = JSON.parse(r.metadata);
      if (isRecord(metaObj) && typeof metaObj.files_count === 'number') {
        metadata_files_count = metaObj.files_count;
      }
    } catch {
      // Invalid JSON, ignore
    }
  } else if (isRecord(r.metadata) && typeof r.metadata.files_count === 'number') {
    metadata_files_count = r.metadata.files_count;
  }

  let files_total =
    Number(
      r.files_total ??
        r.total_files ??
        stats?.files_total ??
        r.file_count ??
        r.fileCount ??
        metadata_files_count ??
        (filesFromArray > 0 ? filesFromArray : 0)
    ) || 0;

  let files_processed =
    Number(
      r.files_processed ??
        r.files_done ??
        r.processed_files ??
        stats?.files_processed ??
        r.filesProcessed ??
        0
    ) || 0;

  if (files_total === 0 && filesFromArray > 0) files_total = filesFromArray;
  if (
    files_processed === 0 &&
    files_total > 0 &&
    String(r.status ?? '').toLowerCase() === 'completed'
  ) {
    files_processed = files_total;
  }

  const status = String(r.status ?? 'pending') as CaseStatus;
  const progressRaw =
    typeof r.progress === 'number' && !Number.isNaN(r.progress)
      ? r.progress
      : Number(r.progress) || 0;
  let progress = progressRaw;
  if (progressRaw > 1 && progressRaw <= 100) {
    progress = progressRaw / 100;
  } else if (progressRaw > 100) {
    progress = 1;
  }

  const user_id = String(r.user_id ?? r.owner_id ?? r.userId ?? '');
  const group_id = String(r.group_id ?? r.groupId ?? '');
  const updated_at =
    parseEpochSeconds(r.updated_at) ||
    parseEpochSeconds(r.updatedAt) ||
    parseEpochSeconds(r.modified_at);
  const last_error = String(r.last_error ?? r.lastError ?? r.error ?? '').trim();

  let detail_available: boolean | undefined;
  if (typeof r.detail_available === 'boolean') {
    detail_available = r.detail_available;
  } else if (typeof r.detailAvailable === 'boolean') {
    detail_available = r.detailAvailable;
  } else if (r.has_detail === false || r.hasDetail === false) {
    detail_available = false;
  }

  return {
    case_id,
    case_name: case_name || case_id,
    status,
    progress,
    files_total,
    files_processed,
    user_id,
    group_id,
    updated_at,
    last_error,
    detail_available,
  };
}

export function normalizeCaseList(data: unknown): CaseListItem[] {
  const rows = extractCasesFromListPayload(data)
    .map(normalizeCaseListItem)
    .filter((x): x is CaseListItem => x != null);

  const byId = new Map<string, CaseListItem>();
  for (const row of rows) {
    const prev = byId.get(row.case_id);
    if (!prev || row.updated_at >= prev.updated_at) {
      byId.set(row.case_id, row);
    }
  }
  return Array.from(byId.values());
}

/** sessionStorage snapshot so case detail can recover when /import/detail returns 404. */
export const CASE_IMPORT_LIST_CACHE_KEY = 'Holand:casesImportList:v1';

/** Workspace-scoped sessionStorage key for case list cache. */
export function casesListCacheKey(groupId?: string | null): string {
  return scopedWorkspaceCacheKey('casesImportList:v1', groupId);
}

function resolveCasesListCacheKey(groupId?: string | null): string {
  if (groupId !== undefined) return casesListCacheKey(groupId);
  return casesListCacheKey(readStoredWorkspaceId());
}

/** Case IDs where GET /import/detail returned 404 but list row exists. */
export const GHOST_CASE_IDS_CACHE_KEY = 'Holand:ghostCaseIds:v1';

function readGhostCaseIdSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(GHOST_CASE_IDS_CACHE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { ids?: string[] };
    return new Set(Array.isArray(parsed.ids) ? parsed.ids : []);
  } catch {
    return new Set();
  }
}

function writeGhostCaseIdSet(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      GHOST_CASE_IDS_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), ids: Array.from(ids) })
    );
  } catch {
    /* quota / private mode */
  }
}

/** Mark a case as list-only after import detail 404. */
export function markCaseAsGhost(caseId: string): void {
  if (!caseId) return;
  const ids = readGhostCaseIdSet();
  if (ids.has(caseId)) return;
  ids.add(caseId);
  writeGhostCaseIdSet(ids);
}

/** Clear ghost flag when detail loads successfully. */
export function clearGhostCase(caseId: string): void {
  if (!caseId) return;
  const ids = readGhostCaseIdSet();
  if (!ids.has(caseId)) return;
  ids.delete(caseId);
  writeGhostCaseIdSet(ids);
}

/** True when list row exists but import detail is unavailable. */
export function isListOnlyCase(item: Pick<CaseListItem, 'case_id' | 'detail_available'>): boolean {
  if (item.detail_available === false) return true;
  return readGhostCaseIdSet().has(item.case_id);
}

/** Merge backend + client ghost flags onto normalized list rows. */
export function applyGhostFlags(cases: CaseListItem[]): CaseListItem[] {
  const ghostIds = readGhostCaseIdSet();
  return cases.map((c) => {
    if (c.detail_available === false || ghostIds.has(c.case_id)) {
      return { ...c, detail_available: false };
    }
    return c;
  });
}

export function writeCasesListCache(
  cases: CaseListItem[],
  groupId?: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      resolveCasesListCacheKey(groupId),
      JSON.stringify({ savedAt: Date.now(), cases })
    );
  } catch {
    /* quota / private mode */
  }
}

export function readCasesListCache(
  caseId: string,
  groupId?: string | null
): CaseListItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(resolveCasesListCacheKey(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cases?: CaseListItem[] };
    return parsed.cases?.find((c) => c.case_id === caseId) ?? null;
  } catch {
    return null;
  }
}

/** Minimal CaseDetail when import service has no detail row but list cache exists. */
export function partialCaseDetailFromListItem(c: CaseListItem): CaseDetail {
  return {
    case_id: c.case_id,
    case_name: c.case_name,
    case_root: '',
    status: c.status,
    ok: c.status !== 'failed',
    progress: c.progress,
    session_id: '',
    user_id: c.user_id,
    group_id: c.group_id,
    files_total: c.files_total,
    files_done: c.files_processed,
    files_error: 0,
    qdrant_vectors_count: 0,
    error: c.last_error || '',
    created_at: 0,
    updated_at: c.updated_at,
    files: [],
    logs: [],
  };
}

/** True while import is not terminal. */
export function isCaseImportActive(status?: string): boolean {
  const s = status?.toLowerCase() ?? '';
  return (
    s === 'pending' ||
    s === 'analyzing' ||
    s === 'reviewing' ||
    s === 'embedding' ||
    s === 'storing' ||
    s === 'security' ||
    s === 'paused' ||
    s === 'processing' ||
    s === 'queued'
  );
}

export function formatEpochSeconds(ts?: number): string {
  if (ts == null || Number.isNaN(ts) || ts === 0) return 'â€”';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return 'â€”';
  }
}

/** Queue banner: supports QueueStatusResponse and older flat keys. */
export function summarizeQueueStatus(data: unknown): {
  show: boolean;
  active: number;
  queued: number;
  capacity?: number;
} {
  if (!data || typeof data !== 'object') {
    return { show: false, active: 0, queued: 0 };
  }
  const o = data as Record<string, unknown>;

  if ('queue_size' in o || 'active_count' in o) {
    const active = Number(o.active_count ?? 0) || 0;
    const queued = Number(o.queue_size ?? 0) || 0;
    const capacity =
      o.max_concurrent != null ? Number(o.max_concurrent) : undefined;
    return {
      show: active > 0 || queued > 0,
      active,
      queued,
      capacity: Number.isFinite(capacity) ? capacity : undefined,
    };
  }

  const activeJobsLen = Array.isArray(o.active_jobs) ? o.active_jobs.length : 0;
  const queuedJobsLen = Array.isArray(o.queued_jobs) ? o.queued_jobs.length : 0;
  const active =
    Number(o.processing ?? o.active ?? 0) || activeJobsLen || 0;
  const queued =
    Number(o.queued ?? o.pending ?? 0) || queuedJobsLen || 0;
  const capacity = o.capacity != null ? Number(o.capacity) : undefined;
  return {
    show: active > 0 || queued > 0,
    active,
    queued,
    capacity: Number.isFinite(capacity) ? capacity : undefined,
  };
}

