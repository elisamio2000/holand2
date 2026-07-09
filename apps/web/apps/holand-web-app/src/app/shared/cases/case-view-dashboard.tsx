// ============================================
// CaseViewDashboard — Tabbed case viewing dashboard (/cases/{id})
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Title, Text, Badge, Loader, Button, ActionIcon } from 'rizzui';
import {
  PiArrowLeftBold,
  PiArrowClockwiseBold,
  PiTrashBold,
  PiTreeStructureBold,
  PiGearSixBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { caseImporterService } from '@/services/case-importer.service';
import { useCaseViewData } from '@/hooks/use-case-view-data';
import ConfirmDeleteModal from '@/app/shared/cases/confirm-delete-modal';
import CaseGhostBadge from '@/app/shared/case-importer/case-ghost-badge';
import CaseActions from '@/app/shared/case-importer/case-actions';
import {
  isListOnlyCase,
  readCasesListCache,
} from '@/app/shared/cases/case-import-ui-mappers';
import type { CaseStatus } from '@/types/case-importer.types';

type TabId =
  | 'glance'
  | 'ai-summary'
  | 'statistics'
  | 'analysis'
  | 'expert-notes'
  | 'files'
  | 'timeline';

const TAB_IDS: TabId[] = [
  'glance',
  'ai-summary',
  'statistics',
  'analysis',
  'expert-notes',
  'files',
  'timeline',
];

function panelFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <Loader variant="spinner" size="lg" />
    </div>
  );
}

const CaseViewAtAGlancePanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-at-a-glance'),
  { loading: panelFallback }
);
const CaseViewAiSummaryPanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-ai-summary'),
  { loading: panelFallback }
);
const CaseViewStatisticsPanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-statistics'),
  { loading: panelFallback }
);
const CaseViewAnalysisPanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-analysis'),
  { loading: panelFallback }
);
const CaseViewExpertNotesPanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-expert-notes'),
  { loading: panelFallback }
);
const CaseViewFilesPanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-files'),
  { loading: panelFallback }
);
const CaseViewTimelinePanel = dynamic(
  () => import('@/app/shared/cases/panels/case-view-timeline'),
  { loading: panelFallback }
);

function tabLabel(t: (k: string) => string, id: TabId): string {
  const map: Record<TabId, string> = {
    glance: t('cases.view.tabs.glance'),
    'ai-summary': t('cases.view.tabs.aiSummary'),
    statistics: t('cases.view.tabs.statistics'),
    analysis: t('cases.view.tabs.analysis'),
    'expert-notes': t('cases.view.tabs.expertNotes'),
    files: t('cases.view.tabs.files'),
    timeline: t('cases.view.tabs.timeline'),
  };
  return map[id];
}

export default function CaseViewDashboard({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('glance');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const viewData = useCaseViewData(caseId);
  const { detail, importStatus, loading, error, isPartialDetail, refetch } = viewData;

  const statusForBadge = importStatus?.status ?? detail?.status ?? 'unknown';
  const cachedListRow = readCasesListCache(caseId);
  const showGhostBadge =
    isPartialDetail ||
    (cachedListRow ? isListOnlyCase(cachedListRow) : false);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await caseImporterService.deleteCase(caseId);
      toast.success(t('toast.caseDeleted'));
      window.location.href = routes.cases.list;
    } catch {
      toast.error(t('toast.failedDeleteCase'));
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link href={routes.cases.list}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <PiArrowLeftBold className="h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-12 text-center dark:border-red-800 dark:bg-red-950/30">
          <PiWarningCircleBold className="mx-auto h-12 w-12 text-red-500" />
          <Title as="h5" className="mt-3 text-red-600 dark:text-red-400">
            {error || t('cases.detail.loadError')}
          </Title>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="mt-4">
            {t('common.refresh')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={routes.cases.list}>
            <ActionIcon variant="outline">
              <PiArrowLeftBold className="h-4 w-4" />
            </ActionIcon>
          </Link>
          <div>
            <Title as="h4" className="text-lg font-semibold">
              {detail.case_name}
            </Title>
            <Text className="font-mono text-xs text-gray-400">{detail.case_id}</Text>
          </div>
          <Badge variant="flat" className="capitalize">
            {t(`cases.status.${statusForBadge?.toLowerCase()}`) || statusForBadge}
          </Badge>
          {showGhostBadge ? (
            <CaseGhostBadge
              item={
                cachedListRow ?? {
                  case_id: caseId,
                  detail_available: false,
                }
              }
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content={t('common.refresh')}>
            <ActionIcon variant="outline" onClick={() => void refetch()}>
              <PiArrowClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Link href={routes.graphExplorer}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <PiTreeStructureBold className="h-4 w-4" />
              {t('cases.detail.openGraphExplorer')}
            </Button>
          </Link>
          <Link href={routes.caseImporter.detail(caseId)}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <PiGearSixBold className="h-4 w-4" />
              {t('cases.view.manageProcessing')}
            </Button>
          </Link>
          <CaseActions
            caseId={caseId}
            caseName={detail.case_name}
            caseRoot={detail.case_root}
            status={(statusForBadge as CaseStatus) || 'pending'}
            onActionComplete={() => void refetch()}
            onDelete={() => {
              window.location.href = routes.cases.list;
            }}
          />
          <Button
            variant="outline"
            color="danger"
            size="sm"
            className="gap-1.5"
            onClick={() => setDeleteOpen(true)}
          >
            <PiTrashBold className="h-4 w-4" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {isPartialDetail ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Text className="text-sm text-amber-900 dark:text-amber-100">
            {t('cases.detail.partialBanner')}
          </Text>
        </div>
      ) : null}

      <div className="border-b border-muted">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto" aria-label="Case view tabs">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tabLabel(t, id)}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[320px]">
        {activeTab === 'glance' && <CaseViewAtAGlancePanel data={viewData} />}
        {activeTab === 'ai-summary' && <CaseViewAiSummaryPanel data={viewData} />}
        {activeTab === 'statistics' && <CaseViewStatisticsPanel data={viewData} />}
        {activeTab === 'analysis' && <CaseViewAnalysisPanel data={viewData} />}
        {activeTab === 'expert-notes' && <CaseViewExpertNotesPanel caseId={caseId} />}
        {activeTab === 'files' && <CaseViewFilesPanel data={viewData} />}
        {activeTab === 'timeline' && <CaseViewTimelinePanel data={viewData} />}
      </div>

      <ConfirmDeleteModal
        isOpen={deleteOpen}
        onClose={() => !deleteLoading && setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('cases.list.deleteConfirmTitle')}
        message={t('cases.list.deleteConfirmMessage', { name: detail.case_name })}
        loading={deleteLoading}
      />
    </div>
  );
}
