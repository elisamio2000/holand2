// ============================================
// useCaseImportList — Shared hook for fetching and managing case import list
// Used by both /case-importer and /cases domains
// ============================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { caseImporterService } from '@/services/case-importer.service';
import {
  normalizeCaseList,
  writeCasesListCache,
  isCaseImportActive,
  applyGhostFlags,
} from '@/app/shared/cases/case-import-ui-mappers';
import type { CaseListItem, CaseListQueryParams } from '@/types/case-importer.types';
import { applyCaseListQuery } from '@/utils/case-list-query';
import { classifyApiError, type ClassifiedApiError } from '@/lib/api-errors';
import { usePageVisible } from '@/hooks/use-page-visible';
import { useOnWorkspaceChanged, useWorkspaceScope } from '@/hooks/use-workspace-scope';

/**
 * Options for useCaseImportList hook.
 */
export interface UseCaseImportListOptions {
  /** Auto-refresh interval in milliseconds (default: 5000) */
  autoRefreshInterval?: number;
  /** Slower interval when WebSocket realtime is connected (default: 30000) */
  slowRefreshInterval?: number;
  /** When true, use slowRefreshInterval instead of autoRefreshInterval */
  realtimeConnected?: boolean;
  /** Enable auto-refresh when active cases exist (default: true) */
  enableAutoRefresh?: boolean;
  /** Show error toast on fetch failure (default: true) */
  showErrorToast?: boolean;
  /** Skip global loading spinner on background refresh (default: true) */
  silentRefresh?: boolean;
  /** Client-side query (until BR-1); when set, `cases` is the paginated slice */
  query?: CaseListQueryParams;
  /** Full normalized list (for metrics); only when query is set */
  exposeAllCases?: boolean;
}

/**
 * Return type for useCaseImportList hook.
 */
export interface UseCaseImportListReturn {
  /** Normalized case list (paginated when query is set) */
  cases: CaseListItem[];
  /** All cases after normalize (when exposeAllCases or query) */
  allCases: CaseListItem[];
  /** Pagination meta when query is used */
  pagination: {
    count: number;
    page: number;
    page_size: number;
    total_pages: number;
  } | null;
  /** Loading state (true during initial fetch) */
  loading: boolean;
  /** Classified error from last fetch */
  error: ClassifiedApiError | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Patch a single case row without full reload */
  patchCase: (caseId: string, patch: Partial<CaseListItem>) => void;
  /** Whether any cases are in active state (pending/analyzing/embedding/storing) */
  hasActiveCases: boolean;
}

const MAX_LIST_BACKOFF_MS = 60000;

/** Adaptive delay with capped exponential growth + jitter for retry safety. */
function computeListBackoffDelay(baseMs: number, failures: number): number {
  const safeFailures = Math.max(0, Math.min(failures, 5));
  const exponential = Math.min(MAX_LIST_BACKOFF_MS, baseMs * 2 ** safeFailures);
  const jitter = Math.floor(Math.random() * Math.max(250, Math.floor(baseMs * 0.2)));
  return Math.min(MAX_LIST_BACKOFF_MS, exponential + jitter);
}

/**
 * Shared hook for fetching, normalizing, and caching case import list.
 */
export function useCaseImportList(
  options: UseCaseImportListOptions = {}
): UseCaseImportListReturn {
  const { t } = useTranslation();
  const pageVisible = usePageVisible();
  const { activeGroupId } = useWorkspaceScope();
  const {
    autoRefreshInterval = 5000,
    slowRefreshInterval = 30000,
    realtimeConnected = false,
    enableAutoRefresh = true,
    showErrorToast = true,
    silentRefresh = true,
    query,
    exposeAllCases = Boolean(query),
  } = options;

  const effectiveInterval = realtimeConnected ? slowRefreshInterval : autoRefreshInterval;

  const [allCases, setAllCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedApiError | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchCases = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? silentRefresh;
      if (!pageVisible && silent) return;

      if (inFlightRef.current) {
        return inFlightRef.current;
      }

      const task = (async () => {
        try {
          if (!silent) setLoading(true);
          setError(null);
          const data = await caseImporterService.listCases(
            query?.page != null ? query : undefined
          );
          const normalized = applyGhostFlags(normalizeCaseList(data));
          setAllCases(normalized);
          writeCasesListCache(normalized, activeGroupId);
          setConsecutiveFailures(0);
        } catch (err: unknown) {
          const classified = classifyApiError(err);
          setError(classified);
          setConsecutiveFailures((prev) => prev + 1);
          if (showErrorToast && !silent) {
            toast.error(t('toast.failedLoadCases'));
          }
        } finally {
          if (!silent) setLoading(false);
          if (inFlightRef.current === task) {
            inFlightRef.current = null;
          }
        }
      })();

      inFlightRef.current = task;
      return task;
    },
    [t, showErrorToast, silentRefresh, pageVisible, query, activeGroupId]
  );

  const patchCase = useCallback((caseId: string, patch: Partial<CaseListItem>) => {
    setAllCases((prev) => {
      const next = prev.map((c) =>
        c.case_id === caseId ? { ...c, ...patch } : c
      );
      writeCasesListCache(next, activeGroupId);
      return next;
    });
  }, [activeGroupId]);

  const paginated = useMemo(() => {
    if (!query) return null;
    return applyCaseListQuery(allCases, query);
  }, [allCases, query]);

  const cases = query ? (paginated?.cases ?? []) : allCases;

  useEffect(() => {
    void fetchCases({ silent: false });
  }, [fetchCases]);

  useOnWorkspaceChanged(() => {
    void fetchCases({ silent: false });
  });

  const hasActiveCases = allCases.some((c) => isCaseImportActive(c.status));

  // Refs keep the self-scheduling refresh loop stable (created once per active window).
  const consecutiveFailuresRef = useRef(consecutiveFailures);
  consecutiveFailuresRef.current = consecutiveFailures;
  const realtimeConnectedRef = useRef(realtimeConnected);
  realtimeConnectedRef.current = realtimeConnected;
  const effectiveIntervalRef = useRef(effectiveInterval);
  effectiveIntervalRef.current = effectiveInterval;

  // Auto-refresh only while there is active work; realtime connection widens the interval.
  // Loop is created once (not re-created on each failure) and reads live values from refs.
  useEffect(() => {
    if (!enableAutoRefresh || !hasActiveCases || !pageVisible) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const computeNext = () =>
      realtimeConnectedRef.current
        ? slowRefreshInterval
        : Math.max(
            1500,
            computeListBackoffDelay(effectiveIntervalRef.current, consecutiveFailuresRef.current)
          );

    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchCases({ silent: true });
        if (!cancelled) schedule();
      }, computeNext());
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    enableAutoRefresh,
    fetchCases,
    hasActiveCases,
    pageVisible,
    slowRefreshInterval,
  ]);

  return {
    cases,
    allCases,
    pagination: paginated
      ? {
          count: paginated.count,
          page: paginated.page,
          page_size: paginated.page_size,
          total_pages: paginated.total_pages,
        }
      : null,
    loading,
    error,
    refetch: () => fetchCases({ silent: false }),
    patchCase,
    hasActiveCases,
  };
}
