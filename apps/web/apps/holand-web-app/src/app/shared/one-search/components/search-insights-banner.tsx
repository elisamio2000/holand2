'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiCaretDownBold,
  PiCaretUpBold,
  PiClockDuotone,
  PiSparkle,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import type {
  OneSearchExecutionMeta,
  OneSearchKind,
  OneSearchLaneId,
  OneSearchResponse,
} from '@/types/one-search.types';
import StorageArtifactThumbnail from '@/components/storage-artifact-thumbnail';
import { hasNoVisualMatches } from '../utils/hit-match-meta';

export interface SearchInsightsBannerProps {
  response: OneSearchResponse | null;
  meta: OneSearchExecutionMeta | null;
  className?: string;
}

function searchKindLabelKey(kind?: OneSearchKind): string | null {
  if (kind === 'visual') return 'searchHub.insightsVisualKind';
  if (kind === 'hybrid') return 'searchHub.insightsHybridKind';
  if (kind === 'text') return 'searchHub.insightsTextKind';
  return null;
}

export function SearchInsightsBanner({
  response,
  meta,
  className,
}: SearchInsightsBannerProps) {
  const { t } = useTranslation();
  const [summaryOpen, setSummaryOpen] = useState(false);

  const searchKind = meta?.searchKind ?? response?.searchKind;
  const kindKey = searchKindLabelKey(searchKind);

  const totalResults = useMemo(() => {
    if (response?.total != null) return response.total;
    if (!response) return 0;
    return response.lanes.reduce((sum, lane) => sum + (lane.total ?? lane.hits.length), 0);
  }, [response]);

  const activeLanes = useMemo(() => {
    if (!response) return [] as { lane: OneSearchLaneId; count: number }[];
    return response.lanes
      .filter((lane) => (lane.total ?? lane.hits.length) > 0)
      .map((lane) => ({
        lane: lane.lane,
        count: lane.total ?? lane.hits.length,
      }));
  }, [response]);

  const tookMs = response?.tookMs ?? meta?.tookMs;
  const noVisual = hasNoVisualMatches(meta?.degradedSources);
  const aiSummary = meta?.aiSummary?.trim();
  const queryImageEcho = meta?.queryImageEcho?.trim();

  const hasContent =
    kindKey ||
    totalResults > 0 ||
    activeLanes.length > 0 ||
    tookMs != null ||
    noVisual ||
    aiSummary ||
    queryImageEcho;

  if (!hasContent) return null;

  const showLaneBreakdown = activeLanes.length > 1;

  return (
    <section
      className={cn(
        'mb-5 overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 @md:px-5">
        {kindKey && (
          <Badge color="primary" rounded="md" className="text-[11px] font-medium">
            {t(kindKey)}
          </Badge>
        )}

        {queryImageEcho && (
          <div className="flex items-center gap-2 rounded-md border border-muted bg-gray-50/80 px-2 py-1 dark:bg-gray-100/30">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-200/30">
              <StorageArtifactThumbnail
                artifactId={queryImageEcho}
                mimeType="image/*"
                alt={t('searchHub.insightsQueryImage')}
                className="h-full w-full"
                preset="fileExplorerGrid"
                lazy
              />
            </div>
            <Text className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
              {t('searchHub.insightsQueryImage')}
            </Text>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          {totalResults > 0 && (
            <span>{t('searchHub.insightsResultCount', { count: totalResults })}</span>
          )}
          {tookMs != null && (
            <span className="inline-flex items-center gap-1">
              <PiClockDuotone className="h-3.5 w-3.5" />
              {t('searchHub.insightsTookMs', { ms: Math.round(tookMs) })}
            </span>
          )}
          {showLaneBreakdown &&
            activeLanes.map(({ lane, count }) => (
              <span key={lane} className="text-[11px]">
                {t(`searchHub.lanes.${lane}`)}: {count}
              </span>
            ))}
        </div>
      </div>

      {noVisual && (
        <div className="flex items-start gap-2 border-t border-amber-200/60 bg-amber-50/80 px-4 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20 @md:px-5">
          <PiWarningCircleDuotone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <Text className="text-xs font-medium text-amber-900 dark:text-amber-200">
              {t('searchHub.insightsNoVisualMatchTitle')}
            </Text>
            <Text className="mt-0.5 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
              {t('searchHub.insightsNoVisualMatch')}
            </Text>
          </div>
        </div>
      )}

      {aiSummary && (
        <div className="border-t border-muted px-4 py-2.5 @md:px-5">
          <button
            type="button"
            onClick={() => setSummaryOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-start"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <PiSparkle className="h-3.5 w-3.5 text-primary" />
              {t('searchHub.insightsAiSummary')}
            </span>
            {summaryOpen ? (
              <PiCaretUpBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            ) : (
              <PiCaretDownBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            )}
          </button>
          {summaryOpen && (
            <Text className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {aiSummary}
            </Text>
          )}
        </div>
      )}
    </section>
  );
}

export default SearchInsightsBanner;
