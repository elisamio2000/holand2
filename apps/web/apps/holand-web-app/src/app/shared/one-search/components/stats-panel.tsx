'use client';

import { useState } from 'react';
import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchResponse } from '@/types/one-search.types';
import { PiChartBarDuotone, PiCaretDownBold, PiCaretUpBold, PiClockDuotone } from 'react-icons/pi';

export interface StatsPanelProps {
  response: OneSearchResponse;
  className?: string;
  sticky?: boolean;
}

export function StatsPanel({ response, className, sticky = true }: StatsPanelProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalResults = response.lanes.reduce((sum, lane) => sum + (lane.total || lane.hits.length), 0);
  const activeLanes = response.lanes.filter((l) => l.hits.length > 0);
  const searchTime = response.tookMs ?? 0;

  if (isCollapsed) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50',
          sticky && 'sticky top-20 z-10',
          className
        )}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
        >
          <PiChartBarDuotone className="h-4 w-4 text-primary" />
          <span>{t('searchHub.showStats')}</span>
          <PiCaretDownBold className="ms-auto h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50',
        sticky && 'sticky top-20 z-10',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-muted px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PiChartBarDuotone className="h-4 w-4" />
          </div>
          <Title as="h3" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.searchStats')}
          </Title>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/20"
          title={t('searchHub.showStats')}
        >
          <PiCaretUpBold className="h-3 w-3" />
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center rounded-md bg-primary/10 p-2.5 text-center">
            <Text className="text-lg font-bold text-primary">{totalResults.toLocaleString()}</Text>
            <Text className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">{t('searchHub.statsHits')}</Text>
          </div>
          <div className="flex flex-col items-center justify-center rounded-md bg-blue-50 p-2.5 text-center dark:bg-blue-950/30">
            <Text className="text-lg font-bold text-blue-600 dark:text-blue-400">{activeLanes.length}</Text>
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

        {activeLanes.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-muted pt-3">
            {activeLanes.slice(0, 6).map((lane) => (
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
    </div>
  );
}

export default StatsPanel;
