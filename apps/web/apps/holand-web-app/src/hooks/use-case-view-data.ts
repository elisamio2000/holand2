// ============================================
// useCaseViewData — Shared data loader for Case View Dashboard
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { gatewayClient } from '@/lib/api-client';
import { caseImporterService } from '@/services/case-importer.service';
import { transformRawToGraphData } from '@/services/graph-explorer.service';
import { normalizeImportDetailGraphPayload } from '@/services/graph-payload-normalize';
import type { CaseDetail, CaseStatus, CaseStatusResponse } from '@/types/case-importer.types';
import {
  partialCaseDetailFromListItem,
  readCasesListCache,
  markCaseAsGhost,
  clearGhostCase,
  isCaseImportActive,
} from '@/app/shared/cases/case-import-ui-mappers';
import { useCaseProgressWebSocket } from '@/hooks/use-case-progress-websocket';
import { classifyApiError } from '@/lib/api-errors';

const GRAPH_FETCH_TIMEOUT_MS = 8000;

function fetchGraphWithTimeout(caseId: string) {
  return Promise.race([
    gatewayClient.get(`/api/v1/graph/cases/${encodeURIComponent(caseId)}`),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Graph stats timeout')), GRAPH_FETCH_TIMEOUT_MS)
    ),
  ]);
}

export interface CaseViewGraphStats {
  nodeCount: number;
  relationCount: number;
}

export interface UseCaseViewDataReturn {
  detail: CaseDetail | null;
  importStatus: CaseStatusResponse | null;
  graphStats: CaseViewGraphStats | null;
  graphError: string | null;
  loading: boolean;
  error: string | null;
  isPartialDetail: boolean;
  refetch: () => Promise<void>;
}

export function useCaseViewData(caseId: string): UseCaseViewDataReturn {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [importStatus, setImportStatus] = useState<CaseStatusResponse | null>(null);
  const [graphStats, setGraphStats] = useState<CaseViewGraphStats | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPartialDetail, setIsPartialDetail] = useState(false);

  const activeStatus = importStatus?.status ?? detail?.status;
  const wsEnabled = Boolean(activeStatus && isCaseImportActive(activeStatus));

  useCaseProgressWebSocket(caseId, {
    enabled: wsEnabled,
    onProgress: (update) => {
      setImportStatus((prev) => {
        const base = prev ?? {
          case_id: caseId,
          case_name: detail?.case_name ?? caseId,
          user_id: detail?.user_id ?? '',
          group_id: detail?.group_id ?? '',
          status: (detail?.status ?? 'pending') as CaseStatus,
          progress: detail?.progress ?? 0,
          files_total: detail?.files_total ?? 0,
          files_processed: detail?.files_done ?? 0,
          last_error: detail?.error ?? '',
          updated_at: detail?.updated_at ?? 0,
          queue_position: 0,
          estimated_wait_sec: 0,
        };
        const phase = update.phase || update.status;
        const next: CaseStatusResponse = {
          ...base,
          progress: update.overall,
          files_processed: update.files_processed ?? base.files_processed,
          files_total: update.files_total ?? base.files_total,
        };
        if (
          phase &&
          ['pending', 'analyzing', 'embedding', 'storing', 'completed', 'failed'].includes(
            phase
          )
        ) {
          next.status = phase as CaseStatus;
        }
        return next;
      });
      setDetail((prev) => {
        if (!prev) return prev;
        const phase = update.phase || update.status;
        const next = {
          ...prev,
          progress: update.overall,
          files_done: update.files_processed ?? prev.files_done,
          files_total: update.files_total ?? prev.files_total,
        };
        if (
          phase &&
          ['pending', 'analyzing', 'embedding', 'storing', 'completed', 'failed'].includes(
            phase
          )
        ) {
          next.status = phase as CaseStatus;
        }
        return next;
      });
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPartialDetail(false);

    const listRow = readCasesListCache(caseId);
    const is404 = (reason: unknown) =>
      isAxiosError(reason) && reason.response?.status === 404;

    try {
      const [detailRes, statusRes, graphRes] = await Promise.allSettled([
        caseImporterService.getCaseDetail(caseId),
        caseImporterService.getImportStatus(caseId),
        fetchGraphWithTimeout(caseId),
      ]);

      let usedListFallback = false;

      if (detailRes.status === 'fulfilled') {
        setDetail(detailRes.value);
        clearGhostCase(caseId);
      } else if (detailRes.status === 'rejected') {
        if (is404(detailRes.reason) && listRow) {
          markCaseAsGhost(caseId);
          setDetail(partialCaseDetailFromListItem(listRow));
          setIsPartialDetail(true);
          usedListFallback = true;
        } else if (is404(detailRes.reason)) {
          markCaseAsGhost(caseId);
          setDetail(null);
          setError(t('cases.detail.detail404NoCache'));
        } else {
          setDetail(null);
          setError(t('cases.detail.loadError'));
        }
      }

      if (statusRes.status === 'fulfilled') {
        setImportStatus(statusRes.value);
      } else if (
        statusRes.status === 'rejected' &&
        is404(statusRes.reason) &&
        listRow &&
        usedListFallback
      ) {
        setImportStatus({
          case_id: listRow.case_id,
          case_name: listRow.case_name,
          user_id: listRow.user_id,
          group_id: listRow.group_id,
          status: listRow.status,
          progress: listRow.progress,
          files_total: listRow.files_total,
          files_processed: listRow.files_processed,
          last_error: listRow.last_error,
          updated_at: listRow.updated_at,
          queue_position: 0,
          estimated_wait_sec: 0,
        });
      } else {
        setImportStatus(null);
      }

      if (graphRes.status === 'fulfilled') {
        const gd = transformRawToGraphData(
          normalizeImportDetailGraphPayload(graphRes.value.data, caseId)
        );
        setGraphStats({
          nodeCount: gd.nodes.length,
          relationCount: gd.links.length,
        });
        setGraphError(null);
      } else {
        setGraphStats(null);
        const reason = graphRes.reason;
        const msg = classifyApiError(reason).message;
        setGraphError(msg);
        console.warn('[useCaseViewData] Graph stats unavailable:', msg);
      }
    } catch {
      setError(t('cases.detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [caseId, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    detail,
    importStatus,
    graphStats,
    graphError,
    loading,
    error,
    isPartialDetail,
    refetch: fetchData,
  };
}

export type CaseViewDataContext = UseCaseViewDataReturn;
