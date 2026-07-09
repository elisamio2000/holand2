// ============================================
// CaseDetailView — Main client component for case detail page
// Combines all sub-components: tracker, info, files, logs, actions, queue
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Text, Title, Loader, Empty, Badge } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  PiArrowLeftBold,
  PiArrowClockwiseBold,
  PiFolderDuotone,
  PiCalendarDuotone,
  PiUserDuotone,
  PiUsersDuotone,
  PiHashDuotone,
  PiDatabaseDuotone,
  PiClockDuotone,
  PiListBulletsDuotone,
  PiEyeBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { caseImporterService } from '@/services/case-importer.service';
import CaseStatusBadge from '@/app/shared/case-importer/case-status-badge';
import CaseStatusTracker from '@/app/shared/case-importer/case-status-tracker';
import CaseFilesList from '@/app/shared/case-importer/case-files-list';
import CaseLogsViewer from '@/app/shared/case-importer/case-logs-viewer';
import CaseActions from '@/app/shared/case-importer/case-actions';
import {
  readCasesListCache,
  partialCaseDetailFromListItem,
  markCaseAsGhost,
  clearGhostCase,
  isCaseImportActive,
} from '@/app/shared/cases/case-import-ui-mappers';
import { useCaseProgressWebSocket } from '@/hooks/use-case-progress-websocket';
import type { CaseDetail, CaseStatus, QueuePositionResponse } from '@/types/case-importer.types';

/**
 * Format epoch to readable date/time.
 */
function formatEpoch(epoch: number): string {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
}

/**
 * InfoRow — Key-value pair for case metadata display.
 */
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm text-gray-700 dark:text-gray-300">{value}</div>
      </div>
    </div>
  );
}

/**
 * CaseDetailView — Main detail page client component.
 *
 * Displays complete case information with:
 * 1. Status tracker (progress visualization)
 * 2. Case metadata panel (info, dates, sizes)
 * 3. Action buttons (embed, store, delete, etc.)
 * 4. File list with tool results
 * 5. Processing logs
 * 6. Queue position (when applicable)
 *
 * Includes auto-polling every 3s for active cases.
 *
 * @requires caseImporterService — for API calls
 * @requires CaseStatusTracker — progress steps
 * @requires CaseFilesList — file listing
 * @requires CaseLogsViewer — log viewer
 * @requires CaseActions — action buttons
 *
 * @example
 * ```tsx
 * <CaseDetailView caseId="cas_317ad603d9b6" />
 * ```
 */
export default function CaseDetailView({
  caseId,
  className,
}: {
  /** Case ID to display */
  caseId: string;
  /** Additional CSS classes */
  className?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [queueInfo, setQueueInfo] = useState<QueuePositionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isGhostDetail, setIsGhostDetail] = useState(false);

  const isActiveCase = detail ? isCaseImportActive(detail.status) : false;

  const { connected: wsConnected } = useCaseProgressWebSocket(caseId, {
    enabled: isActiveCase,
    onProgress: (update) => {
      setDetail((prev) => {
        if (!prev) return prev;
        const next: CaseDetail = {
          ...prev,
          progress: update.overall,
          files_done: update.files_processed ?? prev.files_done,
          files_total: update.files_total ?? prev.files_total,
        };
        const phase = update.phase || update.status;
        if (
          update.status &&
          [
            'pending',
            'analyzing',
            'embedding',
            'storing',
            'security',
            'paused',
            'cancelled',
            'completed',
            'failed',
          ].includes(update.status)
        ) {
          next.status = update.status as CaseStatus;
        } else if (
          phase &&
          [
            'pending',
            'analyzing',
            'embedding',
            'storing',
            'security',
            'paused',
            'cancelled',
            'completed',
            'failed',
          ].includes(phase)
        ) {
          next.status = phase as CaseStatus;
        }
        return next;
      });
    },
  });

  /**
   * Fetch case detail and queue position.
   */
  const fetchDetail = useCallback(async () => {
    console.info('[CaseDetailView] Fetching detail:', { caseId });
    try {
      setError(null);
      const [detailData, queueData] = await Promise.allSettled([
        caseImporterService.getCaseDetail(caseId),
        caseImporterService.getQueuePosition(caseId),
      ]);

      if (detailData.status === 'fulfilled') {
        setDetail(detailData.value);
        setIsGhostDetail(false);
        clearGhostCase(caseId);
        console.info('[CaseDetailView] Detail loaded:', {
          status: detailData.value.status,
          files: detailData.value.files_total,
        });
      } else {
        const errorMsg = String(detailData.reason?.message || '');
        if (
          errorMsg.includes('404') ||
          errorMsg.includes('403') ||
          errorMsg.includes('not found') ||
          errorMsg.includes('Forbidden')
        ) {
          console.warn('[CaseDetailView] Ghost case detected, checking cache:', { caseId });
          markCaseAsGhost(caseId);

          const cached = readCasesListCache(caseId);
          if (cached) {
            console.info('[CaseDetailView] Recovered from cache');
            setDetail(partialCaseDetailFromListItem(cached));
            setIsGhostDetail(true);
          } else {
            console.warn('[CaseDetailView] Case not accessible, redirecting to list');
            toast.error('This case is no longer accessible');
            router.push(routes.caseImporter.dashboard);
            return;
          }
        } else {
          throw detailData.reason;
        }
      }

      if (queueData.status === 'fulfilled') {
        setQueueInfo(queueData.value);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to load case');
      console.error('[CaseDetailView] Fetch failed:', { caseId, err });
      setError(error);
      toast.error(t('toast.failedLoadCaseDetails'));
    } finally {
      setLoading(false);
    }
  }, [caseId, router, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Poll fallback when WebSocket is disconnected; slower interval when WS is live
  useEffect(() => {
    if (!detail || !isCaseImportActive(detail.status)) return;

    const intervalMs = wsConnected ? 15000 : 3000;
    console.info('[CaseDetailView] Active case refresh:', { wsConnected, intervalMs });
    const interval = setInterval(fetchDetail, intervalMs);
    return () => clearInterval(interval);
  }, [detail, fetchDetail, wsConnected]);

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex min-h-[400px] items-center justify-center', className)}>
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  // Error state
  if (error || !detail) {
    return (
      <div className={cn('flex min-h-[400px] flex-col items-center justify-center gap-4', className)}>
        <Empty
          text="Case not found or failed to load"
          textClassName="text-gray-600 dark:text-gray-400"
        />
        <div className="flex gap-3">
          <button
            onClick={() => router.push(routes.caseImporter.dashboard)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <PiArrowLeftBold className="h-4 w-4" />
            Back to list
          </button>
          <button
            onClick={fetchDetail}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <PiArrowClockwiseBold className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with status and back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(routes.caseImporter.dashboard)}
            className="rounded-lg border border-muted p-2 text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100"
          >
            <PiArrowLeftBold className="h-4 w-4" />
          </button>
          <div>
            <Title as="h4" className="text-lg font-semibold text-gray-900 dark:text-gray-700">
              {detail.case_name}
            </Title>
            <Text className="text-xs text-gray-400">{detail.case_id}</Text>
          </div>
          <CaseStatusBadge status={detail.status} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={routes.cases.detail(caseId)}
            className="flex items-center gap-1.5 rounded-md border border-muted px-3 py-2 text-sm text-primary transition-colors hover:bg-gray-50 dark:hover:bg-gray-100"
          >
            <PiEyeBold className="h-4 w-4" />
            {t('cases.view.viewResults')}
          </Link>
          <button
            onClick={fetchDetail}
            className="flex items-center gap-1.5 rounded-md border border-muted px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100"
          >
            <PiArrowClockwiseBold className="h-4 w-4" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {isGhostDetail && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <Text className="text-sm text-amber-800 dark:text-amber-200">
            {t('cases.detail.partialBanner')}
          </Text>
        </div>
      )}

      {/* Status Tracker */}
      <CaseStatusTracker status={detail.status} progress={detail.progress} />

      {/* Main grid: Info + Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Case metadata panel */}
        <div className="rounded-lg border border-muted p-4 lg:col-span-1">
          <Title as="h5" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-700">
            Case Information
          </Title>
          <div className="space-y-1">
            <InfoRow
              icon={<PiFolderDuotone className="h-4 w-4" />}
              label="Root Path"
              value={
                <Text className="break-all text-xs font-mono">
                  {detail.case_root || '—'}
                </Text>
              }
            />
            <InfoRow
              icon={<PiCalendarDuotone className="h-4 w-4" />}
              label="Created"
              value={formatEpoch(detail.created_at)}
            />
            <InfoRow
              icon={<PiClockDuotone className="h-4 w-4" />}
              label="Updated"
              value={formatEpoch(detail.updated_at)}
            />
            <InfoRow
              icon={<PiUserDuotone className="h-4 w-4" />}
              label="User ID"
              value={detail.user_id || '—'}
            />
            <InfoRow
              icon={<PiUsersDuotone className="h-4 w-4" />}
              label="Group ID"
              value={detail.group_id || '—'}
            />
            <InfoRow
              icon={<PiHashDuotone className="h-4 w-4" />}
              label="Session ID"
              value={detail.session_id || '—'}
            />
            <InfoRow
              icon={<PiDatabaseDuotone className="h-4 w-4" />}
              label="Qdrant Vectors"
              value={detail.qdrant_vectors_count.toLocaleString()}
            />

            {/* File stats */}
            <div className="mt-3 border-t border-muted pt-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-100">
                  <Text className="text-lg font-bold text-primary">{detail.files_total}</Text>
                  <Text className="text-[10px] text-gray-400">Total</Text>
                </div>
                <div className="rounded-md bg-green-50 p-2 dark:bg-green-950/20">
                  <Text className="text-lg font-bold text-green-600">{detail.files_done}</Text>
                  <Text className="text-[10px] text-gray-400">Done</Text>
                </div>
                <div className="rounded-md bg-red-50 p-2 dark:bg-red-950/20">
                  <Text className="text-lg font-bold text-red-500">{detail.files_error}</Text>
                  <Text className="text-[10px] text-gray-400">Errors</Text>
                </div>
              </div>
            </div>

            {/* Queue position info */}
            {queueInfo && queueInfo.position > 0 && (
              <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
                <Text className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                  Queue Position: #{queueInfo.position}
                </Text>
                <Text className="text-xs text-orange-600 dark:text-orange-400">
                  Est. wait: {Math.round(queueInfo.estimated_wait_sec)}s
                </Text>
              </div>
            )}

            {/* Error display */}
            {detail.error && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
                <Text className="text-xs font-semibold text-red-700 dark:text-red-300">
                  Error
                </Text>
                <Text className="mt-1 break-words text-xs text-red-600 dark:text-red-400">
                  {detail.error}
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Actions + Files + Logs */}
        <div className="space-y-6 lg:col-span-2">
          {/* Actions */}
          <CaseActions
            caseId={detail.case_id}
            caseName={detail.case_name}
            caseRoot={detail.case_root}
            status={detail.status}
            queuePosition={queueInfo?.position}
            onActionComplete={fetchDetail}
            onDelete={() => {
              toast.success('Case deleted');
              router.push(routes.caseImporter.dashboard);
            }}
          />

          {/* Files section */}
          <CaseFilesList files={detail.files} />

          {/* Logs section */}
          <CaseLogsViewer logs={detail.logs} />
        </div>
      </div>
    </div>
  );
}
