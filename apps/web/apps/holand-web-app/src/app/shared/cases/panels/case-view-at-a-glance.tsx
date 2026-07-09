// ============================================
// Case View — At a Glance panel (live data)
// ============================================

'use client';

import { Badge, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import MetricCard from '@core/components/cards/metric-card';
import {
  PiFilesBold,
  PiWrenchBold,
  PiGraphBold,
  PiWarningCircleBold,
  PiQueueBold,
} from 'react-icons/pi';
import { formatEpochSeconds } from '@/app/shared/cases/case-import-ui-mappers';
import type { CaseViewDataContext } from '@/hooks/use-case-view-data';

function countUniqueTools(detail: CaseViewDataContext['detail']): number {
  if (!detail?.files) return 0;
  const ids = new Set<string>();
  for (const f of detail.files) {
    if (!Array.isArray(f.tools)) continue;
    for (const tr of f.tools) {
      if (tr.tool_id) ids.add(tr.tool_id);
    }
  }
  return ids.size;
}

export default function CaseViewAtAGlancePanel({ data }: { data: CaseViewDataContext }) {
  const { t } = useTranslation();
  const { detail, importStatus, graphStats } = data;

  if (!detail) return null;

  const toolsCount = countUniqueTools(detail);
  const progressPct = Math.round((importStatus?.progress ?? detail.progress ?? 0) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          title={t('cases.detail.fileCount')}
          metric={`${detail.files_done} / ${detail.files_total}`}
          icon={<PiFilesBold className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
        />
        <MetricCard
          title={t('cases.view.glance.failedFiles')}
          metric={detail.files_error}
          icon={<PiWarningCircleBold className="h-6 w-6 text-red-500" />}
          iconClassName="bg-red-100 dark:bg-red-900/30"
        />
        <MetricCard
          title={t('cases.view.glance.toolsRun')}
          metric={toolsCount}
          icon={<PiWrenchBold className="h-6 w-6 text-violet-500" />}
          iconClassName="bg-violet-100 dark:bg-violet-900/30"
        />
        <MetricCard
          title={t('cases.detail.vectorCount')}
          metric={detail.qdrant_vectors_count ?? '—'}
          icon={<PiGraphBold className="h-6 w-6 text-blue-500" />}
          iconClassName="bg-blue-100 dark:bg-blue-900/30"
        />
        {graphStats ? (
          <>
            <MetricCard
              title={t('cases.view.glance.graphNodes')}
              metric={graphStats.nodeCount}
              icon={<PiGraphBold className="h-6 w-6 text-indigo-500" />}
              iconClassName="bg-indigo-100 dark:bg-indigo-900/30"
            />
            <MetricCard
              title={t('cases.view.glance.graphRelations')}
              metric={graphStats.relationCount}
              icon={<PiGraphBold className="h-6 w-6 text-indigo-400" />}
              iconClassName="bg-indigo-50 dark:bg-indigo-900/20"
            />
          </>
        ) : null}
        {importStatus ? (
          <MetricCard
            title={t('cases.tracking.queueStatus')}
            metric={`${progressPct}%`}
            icon={<PiQueueBold className="h-6 w-6 text-amber-500" />}
            iconClassName="bg-amber-100 dark:bg-amber-900/30"
          />
        ) : null}
      </div>

      {detail.files_error > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Text className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {t('cases.view.glance.needsAttention')}: {detail.files_error}{' '}
            {t('cases.view.glance.failedFiles').toLowerCase()}
          </Text>
        </div>
      ) : null}

      {Array.isArray(detail.logs) && detail.logs.length > 0 ? (
        <div className="rounded-lg border border-muted p-4">
          <Title as="h6" className="mb-3 text-sm font-semibold">
            {t('cases.view.glance.recentEvents')}
          </Title>
          <ul className="space-y-2">
            {[...detail.logs]
              .slice(-5)
              .reverse()
              .map((log, i) => (
                <li key={`${log.ts}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <Text className="text-xs text-gray-500">{formatEpochSeconds(log.ts)}</Text>
                  <Badge variant="outline" size="sm">
                    {log.level}
                  </Badge>
                  <Text className="text-gray-700 dark:text-gray-300">{log.message}</Text>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
