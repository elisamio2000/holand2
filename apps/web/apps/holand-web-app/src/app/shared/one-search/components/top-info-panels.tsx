'use client';

import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { PiChartBarDuotone, PiSparkle, PiClockDuotone } from 'react-icons/pi';
import type { OneSearchResponse } from '@/types/one-search.types';

interface TopInfoPanelsProps {
  response: OneSearchResponse;
  query: string;
  aiQuestion: string;
  aiSummary: string;
  className?: string;
}

export function TopInfoPanels({ response, query, aiQuestion, aiSummary, className }: TopInfoPanelsProps) {
  const { t } = useTranslation();
  const totalResults = response.lanes.reduce((sum, lane) => sum + (lane.total ?? lane.hits.length), 0);
  const totalLanes = response.lanes.filter((lane) => lane.hits.length > 0).length;
  const searchTime = response.tookMs ?? 0;

  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}>
      <div className="flex flex-col overflow-hidden rounded-lg border border-muted bg-gray-0 p-4 shadow-sm dark:bg-gray-50">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PiChartBarDuotone className="h-4 w-4" />
          </div>
          <Title as="h2" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.statsPanelTitle')}
          </Title>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center rounded-md bg-primary/10 p-2.5 text-center">
            <Text className="text-lg font-bold text-primary">{totalResults.toLocaleString()}</Text>
            <Text className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">{t('searchHub.statsHits')}</Text>
          </div>
          <div className="flex flex-col items-center justify-center rounded-md bg-blue-50 p-2.5 text-center dark:bg-blue-950/30">
            <Text className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalLanes.toLocaleString()}</Text>
            <Text className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">{t('searchHub.statsLanes')}</Text>
          </div>
          <div className="flex flex-col items-center justify-center rounded-md bg-emerald-50 p-2.5 text-center dark:bg-emerald-950/30">
            <div className="flex items-center gap-0.5">
              <PiClockDuotone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <Text className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {Number.isFinite(searchTime) ? Math.round(searchTime) : '—'}
              </Text>
            </div>
            <Text className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">{t('searchHub.statsMs')}</Text>
          </div>
        </div>

        {response.lanes.filter((l) => l.hits.length > 0).length > 0 && (
          <div className="mt-3 space-y-1 border-t border-muted pt-3">
            {response.lanes
              .filter((l) => l.hits.length > 0)
              .slice(0, 6)
              .map((lane) => (
                <div key={lane.lane} className="flex items-center justify-between text-xs">
                  <Text className="truncate text-gray-600 dark:text-gray-400">{t(`searchHub.lanes.${lane.lane}`)}</Text>
                  <Text className="shrink-0 ps-2 font-medium tabular-nums text-gray-900 dark:text-gray-700">
                    {(lane.total ?? lane.hits.length).toLocaleString()}
                  </Text>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border border-muted bg-gradient-to-b from-primary/[0.04] to-gray-0 p-4 shadow-sm dark:from-primary/10 dark:to-gray-50">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <PiSparkle className="h-4 w-4" />
          </div>
          <Title as="h2" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.aiPanelTitle')}
          </Title>
        </div>

        <div className="min-h-0 flex-1">
          <Title as="h6" className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-700">
            {aiQuestion}
          </Title>
          <div className="my-2 h-px bg-muted" />
          <Text className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{aiSummary}</Text>
        </div>

        <div className="mt-3 border-t border-muted pt-2 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <PiSparkle className="h-3 w-3 text-primary" />
            {t('searchHub.aiFooter', { query })}
          </span>
        </div>
      </div>
    </div>
  );
}
