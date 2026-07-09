// ============================================
// QueueStatusDashboard — Real-time queue status display
// Shows active and queued import jobs (WebSocket + poll fallback)
// ============================================

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Empty, Loader, Text, Title } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  PiQueueDuotone,
  PiArrowClockwiseBold,
  PiRocketLaunchDuotone,
  PiWifiHighBold,
  PiWifiSlashBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { caseImporterService } from '@/services/case-importer.service';
import type { QueueStatusResponse, QueueJob } from '@/types/case-importer.types';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { useImportQueueWebSocket } from '@/hooks/use-import-queue-websocket';
import { classifyApiError, getApiErrorMessage } from '@/lib/api-errors';
import { usePageVisible } from '@/hooks/use-page-visible';

interface QueueStatusDashboardProps {
  className?: string;
  /** Poll fallback interval when WS disconnected (default: 5000) */
  refreshInterval?: number;
  /** Poll interval when WS connected (default: 30000) */
  slowRefreshInterval?: number;
}

const MAX_BACKOFF_MS = 30000;
const STALE_AFTER_MS = 60000;
const WS_HEALTH_TIMEOUT_MS = 45000;
/** Slow safety poll while WebSocket is connected and fresh (defensive only). */
const WS_SAFETY_POLL_MS = 60000;
/** Display clock tick for stale detection (does not trigger network). */
const CLOCK_TICK_MS = 10000;

/** Backoff with capped exponential growth + jitter to reduce thundering-herd retries. */
function computeBackoffDelay(baseMs: number, failures: number): number {
  const safeFailures = Math.max(0, Math.min(failures, 5));
  const exponential = Math.min(MAX_BACKOFF_MS, baseMs * 2 ** safeFailures);
  const jitter = Math.floor(Math.random() * Math.max(250, Math.floor(baseMs * 0.2)));
  return Math.min(MAX_BACKOFF_MS, exponential + jitter);
}

export default function QueueStatusDashboard({
  className,
  refreshInterval = 5000,
  slowRefreshInterval = 30000,
}: QueueStatusDashboardProps) {
  const { t } = useTranslation();
  const pageVisible = usePageVisible();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localQueueStatus, setLocalQueueStatus] = useState<QueueStatusResponse | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const lastErrorToastKeyRef = useRef<string | null>(null);

  const {
    connected,
    reconnecting,
    queueStatus: wsQueueStatus,
    lastUpdate: wsLastUpdate,
    refreshQueue,
  } = useImportQueueWebSocket({
    enabled: true,
    onQueueUpdate: (status) => {
      setLocalQueueStatus(status);
      setError(null);
      setConsecutiveFailures(0);
      setLastSuccessAt(Date.now());
    },
  });

  const queueStatus = wsQueueStatus ?? localQueueStatus;
  const isStale = useMemo(() => {
    if (!queueStatus || !lastSuccessAt) return false;
    return nowTs - lastSuccessAt >= STALE_AFTER_MS;
  }, [lastSuccessAt, nowTs, queueStatus]);

  const hasActiveWork = Boolean(
    queueStatus && (queueStatus.active_count > 0 || queueStatus.queue_size > 0)
  );

  // ==========================================
  // Hybrid request coordinator — refs mirror latest values so the polling loop
  // and fetch callback keep STABLE identities (no re-create → no request storms).
  // ==========================================
  const tRef = useRef(t);
  tRef.current = t;
  const queueStatusRef = useRef(queueStatus);
  queueStatusRef.current = queueStatus;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const wsLastUpdateRef = useRef(wsLastUpdate);
  wsLastUpdateRef.current = wsLastUpdate;
  const consecutiveFailuresRef = useRef(consecutiveFailures);
  consecutiveFailuresRef.current = consecutiveFailures;
  const hasActiveWorkRef = useRef(hasActiveWork);
  hasActiveWorkRef.current = hasActiveWork;

  /**
   * Stable REST fetch for queue status.
   * Reads live values from refs; identity never changes to avoid effect churn.
   */
  const fetchQueueStatus = useCallback(
    async (options?: { silent?: boolean; manual?: boolean; force?: boolean }) => {
      const silent = options?.silent ?? false;
      const manual = options?.manual ?? false;
      const force = options?.force ?? false;

      if (force && fetchAbortRef.current) {
        try {
          fetchAbortRef.current.abort();
        } catch {
          /* ignore */
        }
      } else if (fetchInFlightRef.current) {
        return fetchInFlightRef.current;
      }

      console.info('[QueueStatusDashboard] Fetching queue status (REST):', { manual, silent });

      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      const controller = new AbortController();
      fetchAbortRef.current = controller;

      const task = (async () => {
        try {
          const data = await caseImporterService.getQueueStatus({
            signal: controller.signal,
          });
          setLocalQueueStatus(data);
          setConsecutiveFailures(0);
          setLastSuccessAt(Date.now());
          lastErrorToastKeyRef.current = null;
        } catch (err: unknown) {
          if ((err as { name?: string })?.name === 'CanceledError') {
            return;
          }

          const classified = classifyApiError(err);
          const errorMsg = getApiErrorMessage(err);
          const toastKey = `${classified.category}:${classified.status ?? 'na'}`;

          console.error('[QueueStatusDashboard] Failed to fetch queue status:', {
            category: classified.category,
            status: classified.status,
            retryable: classified.retryable,
            err,
          });

          setConsecutiveFailures((prev) => prev + 1);

          if (queueStatusRef.current) {
            setError(
              tRef.current(
                'caseImporter.queue.statusStale',
                'Queue endpoint is temporarily unavailable. Showing last known snapshot.'
              )
            );
          } else {
            setError(errorMsg);
          }

          // Avoid toast spam during background polling; keep user feedback on manual refresh.
          if (manual || (!silent && lastErrorToastKeyRef.current !== toastKey)) {
            toast.error(
              `${tRef.current('caseImporter.queue.loadFailed', 'Failed to load queue status')}: ${errorMsg}`
            );
            lastErrorToastKeyRef.current = toastKey;
          }
        } finally {
          if (!silent) {
            setIsLoading(false);
          }
          if (fetchInFlightRef.current === task) {
            fetchInFlightRef.current = null;
          }
          if (fetchAbortRef.current === controller) {
            fetchAbortRef.current = null;
          }
        }
      })();

      fetchInFlightRef.current = task;
      return task;
    },
    []
  );

  // Initial load — exactly once on mount.
  useEffect(() => {
    void fetchQueueStatus({ silent: false, manual: false });
  }, [fetchQueueStatus]);

  // ==========================================
  // Single self-scheduling hybrid loop (created once while page is visible).
  // Decision each tick (all read from refs):
  //   - WS connected + fresh snapshot  → skip REST entirely (pure realtime).
  //   - WS connected + stale snapshot  → deduped REST refresh via WS hook.
  //   - WS disconnected + active work  → fast adaptive poll with backoff.
  //   - WS disconnected + idle         → slow safety poll with backoff.
  // ==========================================
  useEffect(() => {
    if (!pageVisible) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const isWsFresh = () =>
      connectedRef.current &&
      wsLastUpdateRef.current > 0 &&
      Date.now() - wsLastUpdateRef.current < WS_HEALTH_TIMEOUT_MS;

    const computeNextDelay = (): number => {
      if (isWsFresh()) {
        return WS_SAFETY_POLL_MS;
      }
      const base = hasActiveWorkRef.current ? refreshInterval : slowRefreshInterval;
      return Math.max(1000, computeBackoffDelay(base, consecutiveFailuresRef.current));
    };

    const tick = async () => {
      if (cancelled) return;
      if (isWsFresh()) {
        // Realtime channel is authoritative and fresh — no REST needed.
      } else if (connectedRef.current) {
        // Connected but snapshot went stale — deduped REST refresh via WS hook.
        await refreshQueue({ silent: true });
      } else {
        // No realtime channel — adaptive REST polling.
        await fetchQueueStatus({ silent: true, manual: false });
      }
      if (!cancelled) schedule();
    };

    const schedule = () => {
      timer = setTimeout(() => void tick(), computeNextDelay());
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [pageVisible, fetchQueueStatus, refreshQueue, refreshInterval, slowRefreshInterval]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (fetchAbortRef.current) {
        try {
          fetchAbortRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const connectionLabel = connected
    ? t('caseImporter.websocket.connected')
    : reconnecting
      ? t('caseImporter.websocket.reconnecting')
      : t('caseImporter.websocket.disconnected');

  const renderJob = (job: QueueJob, isActive: boolean) => (
    <div
      key={job.case_id}
      className="flex items-center justify-between rounded-md border border-muted bg-white p-3 dark:bg-gray-100"
    >
      <div className="flex-1">
        <Link
          href={routes.caseImporter.detail(job.case_id)}
          className="font-medium hover:underline"
        >
          {job.case_name || job.case_id}
        </Link>
        <Text className="mt-1 text-xs text-gray-500">
          Case ID: <code className="font-mono text-xs">{job.case_id}</code>
        </Text>
      </div>
      <Badge variant="flat" color={isActive ? 'success' : 'warning'} className="ml-3">
        {isActive ? (
          <>
            <PiRocketLaunchDuotone className="mr-1 h-3 w-3" />
            {t('caseImporter.queue.active', 'Active')}
          </>
        ) : (
          <>
            <PiQueueDuotone className="mr-1 h-3 w-3" />
            {t('caseImporter.queue.queued', 'Queued')}
          </>
        )}
      </Badge>
    </div>
  );

  return (
    <div className={cn('rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50', className)}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Title as="h3" className="mb-2 text-lg">
            <PiQueueDuotone className="mr-2 inline h-6 w-6" />
            {t('caseImporter.queue.title', 'Import Queue Status')}
          </Title>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {t('caseImporter.queue.description', 'Real-time status of active and queued import jobs')}
          </Text>
          <div className="mt-2 flex items-center gap-1.5">
            {connected ? (
              <PiWifiHighBold className="h-4 w-4 text-green-600" />
            ) : (
              <PiWifiSlashBold className="h-4 w-4 text-amber-500" />
            )}
            <Text className="text-xs text-gray-500">{connectionLabel}</Text>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            connected
              ? void refreshQueue({ silent: false, force: true })
              : void fetchQueueStatus({ manual: true, silent: false, force: true })
          }
          disabled={isLoading}
        >
          <PiArrowClockwiseBold className="mr-1 h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {queueStatus && isStale && (
        <div className="mb-4 rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <Text className="text-xs text-amber-700 dark:text-amber-300">
            {t(
              'caseImporter.queue.staleWarning',
              'Showing a stale queue snapshot while reconnecting to backend.'
            )}
          </Text>
        </div>
      )}

      {isLoading && !queueStatus && (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" variant="spinner" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-dashed border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => void fetchQueueStatus({ manual: true, silent: false, force: true })}
          >
            {t('caseImporter.list.retry')}
          </Button>
        </div>
      )}

      {queueStatus && (queueStatus.active_count > 0 || queueStatus.queue_size > 0) && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-100">
              <Text className="text-xs text-gray-500">{t('caseImporter.queue.activeJobs', 'Active Jobs')}</Text>
              <Text className="mt-1 text-2xl font-bold">{queueStatus.active_count}</Text>
            </div>
            <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-100">
              <Text className="text-xs text-gray-500">{t('caseImporter.queue.queuedJobs', 'Queued Jobs')}</Text>
              <Text className="mt-1 text-2xl font-bold">{queueStatus.queue_size}</Text>
            </div>
            <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-100">
              <Text className="text-xs text-gray-500">{t('caseImporter.queue.maxConcurrent', 'Max Concurrent')}</Text>
              <Text className="mt-1 text-2xl font-bold">{queueStatus.max_concurrent}</Text>
            </div>
            <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-100">
              <Text className="text-xs text-gray-500">{t('caseImporter.queue.totalProcessed', 'Total Processed')}</Text>
              <Text className="mt-1 text-2xl font-bold">{queueStatus.total_processed}</Text>
            </div>
          </div>

          {queueStatus.active_jobs && queueStatus.active_jobs.length > 0 && (
            <div className="mb-6">
              <Text className="mb-3 font-medium">
                {t('caseImporter.queue.activeJobsCount', {
                  defaultValue: 'Active Jobs ({{count}})',
                  count: queueStatus.active_jobs.length,
                })}
              </Text>
              <div className="space-y-2">
                {queueStatus.active_jobs.map((job) => renderJob(job, true))}
              </div>
            </div>
          )}

          {queueStatus.queued_jobs && queueStatus.queued_jobs.length > 0 && (
            <div>
              <Text className="mb-3 font-medium">
                {t('caseImporter.queue.queuedJobsCount', {
                  defaultValue: 'Queued Jobs ({{count}})',
                  count: queueStatus.queued_jobs.length,
                })}
              </Text>
              <div className="space-y-2">
                {queueStatus.queued_jobs.map((job, index) => (
                  <div key={job.case_id} className="relative">
                    {renderJob(job, false)}
                    <Badge
                      size="sm"
                      variant="flat"
                      color="secondary"
                      className="absolute right-3 top-3"
                    >
                      {t('caseImporter.queue.position', {
                        defaultValue: 'Position: {{position}}',
                        position: index + 1,
                      })}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {queueStatus && queueStatus.active_count === 0 && queueStatus.queue_size === 0 && (
        <div className="rounded-md bg-green-50 p-6 dark:bg-green-950/20">
          <Text className="text-sm font-medium text-green-700 dark:text-green-300">
            {t('caseImporter.queue.clear', 'No active imports. Queue is clear.')}
          </Text>
          {queueStatus.total_processed > 0 && (
            <Text className="mt-2 text-xs text-green-600 dark:text-green-400">
              {t('caseImporter.queue.totalProcessedValue', {
                defaultValue: 'Total processed: {{count}}',
                count: queueStatus.total_processed,
              })}
            </Text>
          )}
        </div>
      )}

      {!queueStatus && !isLoading && !error && (
        <Empty text={t('caseImporter.queue.unavailable', 'Queue status unavailable')} />
      )}
    </div>
  );
}
