// ============================================
// CaseList — Table view for listing all imported cases
// Includes status filter, sorting, pagination, multi-select, and navigation to detail
// ============================================

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Loader, Empty, Input, Select, Badge, Button, ActionIcon } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  PiMagnifyingGlassBold,
  PiArrowClockwiseBold,
  PiFunnelBold,
  PiCaretUpBold,
  PiCaretDownBold,
  PiTrashBold,
  PiEyeBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import IndeterminateCheckbox from '@core/components/table/indeterminate-checkbox';
import { routes } from '@/config/routes';
import { caseImporterService } from '@/services/case-importer.service';
import CaseStatusBadge from '@/app/shared/case-importer/case-status-badge';
import CaseGhostBadge from '@/app/shared/case-importer/case-ghost-badge';
import ConfirmDeleteModal from '@/app/shared/cases/confirm-delete-modal';
import { formatEpochSeconds, isCaseImportActive } from '@/app/shared/cases/case-import-ui-mappers';
import { useCaseImportList } from '@/hooks/use-case-import-list';
import { useActiveCasesProgress } from '@/hooks/use-active-cases-progress';
import ApiErrorBanner from '@/components/api-error-banner';
import WorkspaceScopeBanner from '@/app/shared/workspace/components/workspace-scope-banner';
import { TableRowSkeleton } from '@/components/table-skeleton';
import type {
  CaseStatusFilter,
  CaseSortField,
  SortDirection,
  CaseStatus,
} from '@/types/case-importer.types';

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

type DeleteModalState =
  | { mode: 'single'; caseId: string; caseName: string }
  | { mode: 'bulk' }
  | null;

/**
 * Format progress to percentage string.
 */
function formatProgress(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

/**
 * CaseList — Main table component for the case list page.
 */
export default function CaseList({ className }: { className?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [realtimeMode, setRealtimeMode] = useState(false);

  const { cases, allCases, loading, error, refetch, patchCase } = useCaseImportList({
    // realtimeConnected reflects ACTUAL WebSocket connectivity (set below), so when
    // WS is unavailable the list falls back to fast REST polling to keep progress live.
    realtimeConnected: realtimeMode,
    autoRefreshInterval: 3000,
    slowRefreshInterval: 30000,
    enableAutoRefresh: true,
    showErrorToast: true,
  });

  const activeCaseIds = useMemo(
    () => allCases.filter((c) => isCaseImportActive(c.status)).map((c) => c.case_id),
    [allCases]
  );

  // Flag-based reconcile: when a row reaches a terminal state via WS, refetch once
  // (debounced) to finalize the row and surface any follow-up changes in the table.
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconcile = useCallback(() => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = setTimeout(() => {
      void refetch();
    }, 800);
  }, [refetch]);

  useEffect(
    () => () => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    },
    []
  );

  const { anyConnected } = useActiveCasesProgress({
    caseIds: activeCaseIds,
    enabled: activeCaseIds.length > 0,
    onProgress: (update) => {
      const patch: Parameters<typeof patchCase>[1] = {
        progress: update.overall,
      };
      if (update.files_processed != null) patch.files_processed = update.files_processed;
      if (update.files_total != null) patch.files_total = update.files_total;
      const phase = update.phase || update.status;
      if (
        phase &&
        ['pending', 'analyzing', 'embedding', 'storing', 'completed', 'failed'].includes(phase)
      ) {
        patch.status = phase as CaseStatus;
        // Terminal transition → reconcile the table with authoritative server state.
        if (phase === 'completed' || phase === 'failed') {
          scheduleReconcile();
        }
      }
      patchCase(update.case_id, patch);
    },
  });

  // Drive refresh strategy from REAL realtime connectivity, not merely the presence
  // of active rows. WS connected → slow reconciliation; WS down → fast live polling.
  useEffect(() => {
    setRealtimeMode(anyConnected);
  }, [anyConnected]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatusFilter>('all');
  const [sortField, setSortField] = useState<CaseSortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const statusOptions = useMemo(
    () =>
      [
        { label: t('caseImporter.list.filterAll'), value: 'all' as CaseStatusFilter },
        { label: t('caseImporter.list.filterPending'), value: 'pending' as CaseStatusFilter },
        { label: t('caseImporter.list.filterAnalyzing'), value: 'analyzing' as CaseStatusFilter },
        { label: t('caseImporter.list.filterEmbedding'), value: 'embedding' as CaseStatusFilter },
        { label: t('caseImporter.list.filterStoring'), value: 'storing' as CaseStatusFilter },
        { label: t('caseImporter.list.filterCompleted'), value: 'completed' as CaseStatusFilter },
        { label: t('caseImporter.list.filterFailed'), value: 'failed' as CaseStatusFilter },
      ],
    [t]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, statusFilter, pageSize]);

  // Prune invalid IDs from selection when cases list changes
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(cases.map((c) => c.case_id));
      const nextSelection = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          nextSelection.add(id);
        }
      });
      return nextSelection;
    });
  }, [cases]);

  /** Filtered and sorted cases */
  const filteredCases = useMemo(() => {
    let result = [...cases];

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.case_name?.toLowerCase().includes(q) ||
          c.case_id?.toLowerCase().includes(q) ||
          c.status?.toLowerCase().includes(q) ||
          c.last_error?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [cases, statusFilter, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  const paginatedCases = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, pageIndex, pageSize]);

  const allPageSelected =
    paginatedCases.length > 0 &&
    paginatedCases.every((c) => selectedIds.has(c.case_id));
  const somePageSelected =
    paginatedCases.some((c) => selectedIds.has(c.case_id)) && !allPageSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedCases.forEach((c) => next.delete(c.case_id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedCases.forEach((c) => next.add(c.case_id));
        return next;
      });
    }
  };

  /** Toggle sort direction or set new sort field */
  const handleSort = (field: CaseSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  /** Navigate to case detail page */
  const handleRowClick = (caseId: string) => {
    console.info('[CaseList] Navigating to detail:', { caseId });
    router.push(routes.caseImporter.detail(caseId));
  };

  const executeDelete = async () => {
    if (!deleteModal) return;

    setDeleteLoading(true);
    try {
      if (deleteModal.mode === 'single') {
        const { caseId, caseName } = deleteModal;
        console.info('[CaseList] Deleting case:', { caseId, caseName });
        await caseImporterService.deleteCase(caseId);
        toast.success(t('toast.caseDeleted'));
        await refetch();
      } else {
        const ids = Array.from(selectedIds);
        let success = 0;
        let failed = 0;
        for (const id of ids) {
          try {
            await caseImporterService.deleteCase(id);
            success += 1;
          } catch (err: unknown) {
            failed += 1;
            console.error('[CaseList] Bulk delete failed for case:', { id, err });
          }
        }
        setSelectedIds(new Set());
        if (failed === 0) {
          toast.success(t('caseImporter.list.bulkDeleteSuccess', { count: success }));
        } else {
          toast.error(
            t('caseImporter.list.bulkDeletePartial', { success, failed })
          );
        }
        await refetch();
      }
      setDeleteModal(null);
    } catch (err: unknown) {
      console.error('[CaseList] Delete failed:', err);
      toast.error(t('toast.failedDeleteCase'));
      await refetch();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    caseId: string,
    caseName: string
  ) => {
    e.stopPropagation();
    setDeleteModal({ mode: 'single', caseId, caseName });
  };

  const deleteModalTitle =
    deleteModal?.mode === 'bulk'
      ? t('caseImporter.list.bulkDeleteTitle')
      : t('caseImporter.list.deleteConfirmTitle');

  const deleteModalMessage =
    deleteModal?.mode === 'bulk'
      ? t('caseImporter.list.bulkDeleteMessage', { count: selectedIds.size })
      : deleteModal?.mode === 'single'
        ? t('caseImporter.list.deleteConfirmMessage', {
            name: deleteModal.caseName,
          })
        : '';

  /** Render sort indicator */
  const SortIcon = ({ field }: { field: CaseSortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <PiCaretUpBold className="h-3 w-3" />
    ) : (
      <PiCaretDownBold className="h-3 w-3" />
    );
  };

  if (loading && allCases.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <TableRowSkeleton rows={10} cols={6} />
      </div>
    );
  }

  if (error && allCases.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <ApiErrorBanner error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <WorkspaceScopeBanner />
      {error && <ApiErrorBanner error={error} onRetry={() => void refetch()} />}
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-primary/10 p-3">
          <Text className="text-sm font-medium">
            {t('caseImporter.list.selectedCount', { count: selectedIds.size })}
          </Text>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            onClick={() => setDeleteModal({ mode: 'bulk' })}
          >
            <PiTrashBold className="me-1 h-4 w-4" />
            {t('common.delete')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds(new Set())}
          >
            {t('common.clear')}
          </Button>
        </div>
      )}

      {/* Toolbar: Search + Filter + Refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <Input
            placeholder={t('caseImporter.list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />}
            className="max-w-xs"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(val: CaseStatusFilter) => setStatusFilter(val)}
            prefix={<PiFunnelBold className="h-4 w-4 text-gray-400" />}
            className="w-44"
            displayValue={(val: CaseStatusFilter) =>
              statusOptions.find((o) => o.value === val)?.label ??
              t('caseImporter.list.filterAll')
            }
          />
        </div>

        <div className="flex items-center gap-2">
          {loading && <Loader variant="spinner" size="sm" />}
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-muted px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-100"
          >
            <PiArrowClockwiseBold
              className={cn('h-4 w-4', loading && 'animate-spin')}
            />
            {t('common.refresh')}
          </button>
          <Badge variant="flat" className="text-xs">
            {t('caseImporter.list.filteredCount', {
              filtered: filteredCases.length,
              total: cases.length,
            })}
          </Badge>
        </div>
      </div>

      {/* Empty state */}
      {cases.length === 0 && (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-muted p-10">
          <Empty
            text={t('caseImporter.list.emptyState')}
            textClassName="text-gray-500 dark:text-gray-400"
          />
          <Text className="mt-2 text-sm text-gray-400">
            {t('caseImporter.list.emptyHint')}
          </Text>
        </div>
      )}

      {/* Table */}
      {cases.length > 0 && filteredCases.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-muted">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-muted bg-gray-50 dark:bg-gray-100">
                  <th className="w-10 px-2 py-3">
                    <IndeterminateCheckbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={toggleSelectAllPage}
                      aria-label={t('common.all')}
                    />
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"
                    onClick={() => handleSort('case_name')}
                  >
                    <span className="flex items-center gap-1">
                      {t('caseImporter.list.columnCaseName')}{' '}
                      <SortIcon field="case_name" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"
                    onClick={() => handleSort('status')}
                  >
                    <span className="flex items-center gap-1">
                      {t('caseImporter.list.columnStatus')}{' '}
                      <SortIcon field="status" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"
                    onClick={() => handleSort('progress')}
                  >
                    <span className="flex items-center gap-1">
                      {t('caseImporter.list.columnProgress')}{' '}
                      <SortIcon field="progress" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"
                    onClick={() => handleSort('files_total')}
                  >
                    <span className="flex items-center gap-1">
                      {t('caseImporter.list.columnFiles')}{' '}
                      <SortIcon field="files_total" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"
                    onClick={() => handleSort('updated_at')}
                  >
                    <span className="flex items-center gap-1">
                      {t('caseImporter.list.columnUpdated')}{' '}
                      <SortIcon field="updated_at" />
                    </span>
                  </th>
                  <th className="w-24 px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    {t('caseImporter.list.columnActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCases.map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => handleRowClick(c.case_id)}
                    className="cursor-pointer border-b border-muted transition-colors last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-100/50"
                  >
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <IndeterminateCheckbox
                        checked={selectedIds.has(c.case_id)}
                        onChange={() => toggleSelect(c.case_id)}
                        aria-label={c.case_name}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <Text className="font-medium text-gray-900 dark:text-gray-700">
                          {c.case_name}
                        </Text>
                        <Text className="text-xs text-gray-400">{c.case_id}</Text>
                        {c.status === 'failed' && c.last_error ? (
                          <Text
                            className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400"
                            title={c.last_error}
                          >
                            {c.last_error}
                          </Text>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CaseStatusBadge status={c.status} />
                        <CaseGhostBadge item={c} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              c.status === 'failed' ? 'bg-red' : 'bg-primary'
                            )}
                            style={{ width: `${Math.min(c.progress * 100, 100)}%` }}
                          />
                        </div>
                        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {formatProgress(c.progress)}
                        </Text>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Text className="text-gray-600 dark:text-gray-400">
                        {c.files_processed}/{c.files_total}
                      </Text>
                    </td>
                    <td className="px-4 py-3">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">
                        {formatEpochSeconds(c.updated_at)}
                      </Text>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(c.case_id);
                          }}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-200"
                          title={t('caseImporter.list.viewDetails')}
                        >
                          <PiEyeBold className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, c.case_id, c.case_name)}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-lighter hover:text-red"
                          title={t('caseImporter.list.deleteCase')}
                        >
                          <PiTrashBold className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Text className="text-xs text-gray-500">{t('caseImporter.list.rowsPerPage')}</Text>
              <Select
                size="sm"
                options={PAGE_SIZE_OPTIONS}
                value={pageSize}
                onChange={(val: number) => {
                  setPageSize(Number(val));
                  setPageIndex(0);
                }}
                className="w-16"
              />
            </div>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {t('caseImporter.list.pageOf', {
                page: pageIndex + 1,
                total: totalPages,
              })}
            </Text>
            <div className="flex gap-1">
              <ActionIcon
                size="sm"
                variant="outline"
                aria-label={t('common.previous')}
                disabled={pageIndex === 0}
                onClick={() => setPageIndex(0)}
              >
                <PiCaretDoubleLeftBold className="h-4 w-4" />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="outline"
                aria-label={t('common.previous')}
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                <PiCaretLeftBold className="h-4 w-4" />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="outline"
                aria-label={t('common.next')}
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
              >
                <PiCaretRightBold className="h-4 w-4" />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="outline"
                aria-label={t('common.next')}
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex(totalPages - 1)}
              >
                <PiCaretDoubleRightBold className="h-4 w-4" />
              </ActionIcon>
            </div>
          </div>
        </>
      )}

      {/* No results from filter */}
      {cases.length > 0 && filteredCases.length === 0 && (
        <div className="flex min-h-[200px] flex-col items-center justify-center">
          <Text className="text-gray-400">{t('caseImporter.list.noResults')}</Text>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal != null}
        onClose={() => !deleteLoading && setDeleteModal(null)}
        onConfirm={executeDelete}
        title={deleteModalTitle}
        message={deleteModalMessage}
        loading={deleteLoading}
      />
    </div>
  );
}
