// ============================================
// CasesListView — Cases listing with real API integration
// Uses GET /import/list, GET /import/queue/status, DELETE /import/{case_id}
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Title, Text, Badge, Loader, Button, Input, ActionIcon } from 'rizzui';
import {
  PiFolderOpenDuotone,
  PiPlusBold,
  PiMagnifyingGlassBold,
  PiArrowClockwiseBold,
  PiTrashBold,
  PiEyeBold,
  PiQueueBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiSpinnerGapBold,
  PiFilesBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { caseImporterService } from '@/services/case-importer.service';
import type { QueueStatusResponse } from '@/types/case-importer.types';
import {
  formatEpochSeconds,
  isCaseImportActive,
  summarizeQueueStatus,
} from '@/app/shared/cases/case-import-ui-mappers';
import { useCaseImportList } from '@/hooks/use-case-import-list';
import { useImportQueueWebSocket } from '@/hooks/use-import-queue-websocket';
import ConfirmDeleteModal from '@/app/shared/cases/confirm-delete-modal';
import ApiErrorBanner from '@/components/api-error-banner';
import CaseGhostBadge from '@/app/shared/case-importer/case-ghost-badge';
import WorkspaceScopeBanner from '@/app/shared/workspace/components/workspace-scope-banner';

/**
 * CasesListView — Main cases listing with real API data.
 *
 * Fetches data from:
 * - GET /import/list — list all cases
 * - GET /import/queue/status — queue info
 * - DELETE /import/{case_id} — delete case (via caseImporterService)
 *
 * Features:
 * - MetricCard stat cards (total, active, completed, failed)
 * - Search/filter
 * - Queue status banner
 * - Table with status badges and actions
 *
 * @requires caseImporterService
 * @version 0.21.0
 */
export default function CasesListView() {
  const { t } = useTranslation();
  const { cases, allCases, loading, error: casesError, refetch } = useCaseImportList({
    realtimeConnected: false,
  });

  const { queueStatus: wsQueue, connected: queueWsConnected } = useImportQueueWebSocket({
    enabled: true,
  });

  const [queue, setQueue] = useState<QueueStatusResponse | null>(null);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ caseId: string; caseName: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ==========================================
  // Queue Status Fetching
  // ==========================================

  /**
   * Fetch queue status separately.
   * @endpoint GET /import/queue/status
   */
  const fetchQueue = useCallback(async () => {
    console.info('[CasesListView] Fetching queue status...');
    try {
      const queueRes = await caseImporterService.getQueueStatus();
      console.info('[CasesListView] Queue status loaded:', queueRes);
      setQueue(queueRes);
    } catch (err: unknown) {
      console.warn('[CasesListView] Queue status unavailable:', err);
    }
  }, []);

  useEffect(() => {
    if (!queueWsConnected) void fetchQueue();
  }, [fetchQueue, queueWsConnected]);

  useEffect(() => {
    if (wsQueue) setQueue(wsQueue);
  }, [wsQueue]);

  /**
   * Delete a case with optimistic UI update.
   * @endpoint DELETE /import/{case_id}
   */
  const executeDelete = useCallback(async () => {
    if (!deleteModal) return;
    const { caseId, caseName } = deleteModal;

    console.info('[CasesListView] Deleting case:', { caseId });
    setDeleteLoading(true);
    try {
      await caseImporterService.deleteCase(caseId);
      console.info('[CasesListView] Case deleted:', { caseId });
      toast.success(`${caseName} deleted`);
      await refetch();
      setDeleteModal(null);
    } catch (err: unknown) {
      console.error('[CasesListView] Delete failed:', { caseId, err });
      toast.error(t('toast.failedDeleteCase'));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteModal, t, refetch]);

  // ==========================================
  // Computed Values
  // ==========================================

  const stats = useMemo(() => {
    const source = allCases.length ? allCases : cases;
    const total = source.length;
    const active = source.filter((c) => isCaseImportActive(c.status)).length;
    const completed = source.filter(
      (c) => c.status?.toLowerCase() === 'completed'
    ).length;
    const failed = source.filter(
      (c) => c.status?.toLowerCase() === 'failed'
    ).length;
    return { total, active, completed, failed };
  }, [allCases, cases]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(
      (c) =>
        c.case_name?.toLowerCase().includes(q) ||
        c.case_id?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.last_error?.toLowerCase().includes(q)
    );
  }, [cases, search]);

  /** Get status badge color based on case status string. */
  const getStatusColor = (
    status: string
  ): 'success' | 'danger' | 'warning' | 'info' | 'secondary' => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'embedding':
      case 'storing':
      case 'processing':
      case 'analyzing':
        return 'warning';
      case 'reviewing':
      case 'queued':
      case 'pending':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const progressPercent = (progress: number): number => {
    if (progress == null || Number.isNaN(progress)) return 0;
    if (progress > 1) return Math.min(100, Math.round(progress));
    return Math.round(progress * 100);
  };

  const queueSummary = queue ? summarizeQueueStatus(queue) : null;

  // ==========================================
  // Render
  // ==========================================

  const metricPlaceholder = loading && allCases.length === 0 ? '—' : undefined;

  return (
    <div className="space-y-6">
      <WorkspaceScopeBanner />
      {casesError ? (
        <ApiErrorBanner error={casesError} onRetry={() => void refetch()} />
      ) : null}
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 @container sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('cases.stats.totalCases')}
          metric={metricPlaceholder ?? stats.total}
          icon={<PiFolderOpenDuotone className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
        />
        <MetricCard
          title={t('cases.stats.activeCases')}
          metric={metricPlaceholder ?? stats.active}
          icon={<PiSpinnerGapBold className="h-6 w-6 text-amber-500" />}
          iconClassName="bg-amber-100 dark:bg-amber-900/30"
        />
        <MetricCard
          title={t('cases.stats.completedCases')}
          metric={metricPlaceholder ?? stats.completed}
          icon={<PiCheckCircleBold className="h-6 w-6 text-green-500" />}
          iconClassName="bg-green-100 dark:bg-green-900/30"
        />
        <MetricCard
          title={t('cases.stats.failedCases')}
          metric={metricPlaceholder ?? stats.failed}
          icon={<PiWarningCircleBold className="h-6 w-6 text-red-500" />}
          iconClassName="bg-red-100 dark:bg-red-900/30"
        />
      </div>

      {/* Queue Status Banner */}
      {queueSummary?.show && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <PiQueueBold className="h-5 w-5 text-blue-500" />
            <Text className="text-sm text-blue-700 dark:text-blue-300">
              {t('cases.tracking.queueStatus')}:
              {` ${queueSummary.active} ${t('cases.stats.processingJobs')}`}
              {` · ${queueSummary.queued} ${t('cases.stats.queuedJobs')}`}
              {queueSummary.capacity != null &&
                ` · ${t('gpu.queue.capacity')}: ${queueSummary.capacity}`}
            </Text>
          </div>
        )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        <div className="relative flex-1">
          <Input
            placeholder={t('cases.list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md"
            prefix={
              <PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t('common.refresh')}>
            <ActionIcon variant="outline" onClick={() => { refetch(); fetchQueue(); }}>
              <PiArrowClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Link href={routes.cases.create}>
            <Button className="gap-1.5">
              <PiPlusBold className="h-4 w-4" />
              {t('cases.list.createNew')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Table / Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size="lg" />
        </div>
      ) : casesError && filtered.length === 0 ? (
        <ApiErrorBanner
          error={casesError}
          onRetry={() => {
            void refetch();
            void fetchQueue();
          }}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center dark:border-gray-600">
          <PiFolderOpenDuotone className="mx-auto h-14 w-14 text-gray-300 dark:text-gray-500" />
          <Title as="h5" className="mt-4 text-gray-500">
            {search ? t('common.noResults') : t('common.noData')}
          </Title>
          <Text className="mt-1 text-sm text-gray-400">
            {t('cases.list.description')}
          </Text>
          {!search && (
            <Link href={routes.cases.create}>
              <Button className="mt-4 gap-1.5">
                <PiPlusBold className="h-4 w-4" />
                {t('cases.list.createNew')}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-muted">
          <div className="max-h-[min(75vh,920px)] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-100">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('cases.detail.caseName')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('common.status')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                  {t('cases.list.columnFilesDone')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                  {t('cases.list.columnProgress')}
                </th>
                <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 sm:table-cell">
                  {t('cases.list.columnUpdated')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {filtered.map((c) => (
                <tr
                  key={c.case_id}
                  className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={routes.cases.detail(c.case_id)}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.case_name || c.case_id}
                    </Link>
                    <Text
                      className="mt-0.5 truncate font-mono text-xs text-gray-400"
                      title={c.case_id}
                    >
                      {c.case_id}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="flat"
                        color={getStatusColor(c.status)}
                        size="sm"
                        className="capitalize"
                      >
                        {t(`cases.status.${c.status?.toLowerCase()}`) || c.status}
                      </Badge>
                      <CaseGhostBadge item={c} />
                      {c.last_error ? (
                        <Tooltip content={c.last_error}>
                          <PiWarningCircleBold className="h-4 w-4 shrink-0 text-amber-500" />
                        </Tooltip>
                      ) : null}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <PiFilesBold className="h-4 w-4 text-gray-400" />
                      <Text className="text-gray-600 dark:text-gray-400">
                        {c.files_processed} / {c.files_total}
                      </Text>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Text className="text-gray-600 dark:text-gray-400">
                      {progressPercent(c.progress)}%
                    </Text>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Text className="text-xs text-gray-500">
                      {formatEpochSeconds(c.updated_at)}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content={t('common.viewDetails')}>
                        <Link href={routes.cases.detail(c.case_id)}>
                          <ActionIcon variant="outline" size="sm">
                            <PiEyeBold className="h-4 w-4" />
                          </ActionIcon>
                        </Link>
                      </Tooltip>
                      <Tooltip content={t('common.delete')}>
                        <ActionIcon
                          variant="outline"
                          color="danger"
                          size="sm"
                          onClick={() =>
                            setDeleteModal({
                              caseId: c.case_id,
                              caseName: c.case_name || c.case_id
                            })
                          }
                        >
                          <PiTrashBold className="h-4 w-4" />
                        </ActionIcon>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between border-t border-muted bg-gray-50 px-4 py-3 dark:bg-gray-100">
            <Text className="text-xs text-gray-500">
              {filtered.length} {t('common.of')} {cases.length}{' '}
              {t('common.items')}
            </Text>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal != null}
        onClose={() => !deleteLoading && setDeleteModal(null)}
        onConfirm={executeDelete}
        title={t('cases.list.deleteConfirmTitle')}
        message={t('cases.list.deleteConfirmMessage', {
          name: deleteModal?.caseName || '',
        })}
        loading={deleteLoading}
      />
    </div>
  );
}
