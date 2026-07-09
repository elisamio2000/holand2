'use client';

import { useState } from 'react';
import { Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchResponse, OneSearchLaneId } from '@/types/one-search.types';
import { TopInfoPanels } from './top-info-panels';
import { AdvancedSidebar, type AdvancedSearchFilters } from './advanced-sidebar';
import { LaneSection } from './lane-section';
import { ImageSlider } from './image-slider';
import { PeopleAlsoAsk, RelatedSearches } from './bottom-sections';
import type { OneSearchPageVariant } from '../utils/search-urls';

export interface AllResultsTabProps {
  response: OneSearchResponse;
  aiSummary?: string;
  searchQuery?: string;
  pageVariant?: OneSearchPageVariant;
  isFilterOpen?: boolean;
  onToggleFilter?: () => void;
  onViewAllLane?: (lane: OneSearchLaneId) => void;
  onViewAllImages?: () => void;
  onMinScoreChange?: (minScore?: number) => void;
  isLiveProvider?: boolean;
  filters?: AdvancedSearchFilters;
  onFiltersChange?: (filters: AdvancedSearchFilters) => void;
  showClientFilterNote?: boolean;
  className?: string;
}

export function AllResultsTab({
  response,
  aiSummary,
  searchQuery,
  pageVariant = 'default',
  isFilterOpen = true,
  onToggleFilter,
  onViewAllLane,
  onViewAllImages,
  onMinScoreChange,
  isLiveProvider = false,
  filters: controlledFilters,
  onFiltersChange,
  showClientFilterNote = false,
  className,
}: AllResultsTabProps) {
  const { t } = useTranslation();
  const [internalFilters, setInternalFilters] = useState<AdvancedSearchFilters>({
    lanes: [],
    dateRange: 'any',
    fileTypes: [],
    languages: [],
    sortBy: 'relevance',
    includeArchived: false,
  });

  const filters = controlledFilters ?? internalFilters;

  const handleFiltersChange = (next: AdvancedSearchFilters) => {
    if (onFiltersChange) onFiltersChange(next);
    else setInternalFilters(next);
    if (onMinScoreChange && next.minScore !== filters.minScore) {
      onMinScoreChange(next.minScore);
    }
  };

  const lanesWithResults = response.lanes.filter((lane) => lane.hits && lane.hits.length > 0);

  const fileLanes = lanesWithResults.filter(
    (lane) => lane.lane === 'files' || lane.lane === 'storage'
  );
  const nonFileLanes = lanesWithResults.filter(
    (lane) => lane.lane !== 'files' && lane.lane !== 'storage'
  );

  const images = fileLanes
    .flatMap((lane) => lane.hits)
    .filter((hit) => hit.meta?.thumb_url || hit.meta?.url);

  const laneCounts = response.lanes.reduce(
    (acc, lane) => {
      acc[lane.lane] = lane.total || lane.hits.length;
      return acc;
    },
    {} as Record<OneSearchLaneId, number>
  );

  if (lanesWithResults.length === 0) {
    return (
      <div className={cn('py-20 text-center', className)}>
        <Text className="text-sm text-gray-500 dark:text-gray-400">{t('searchHub.noResults')}</Text>
      </div>
    );
  }

  const queryLabel = searchQuery || response.query;

  const paaQuestions = isLiveProvider
    ? aiSummary?.trim()
      ? [
          {
            question: t('searchHub.insightsAiSummary'),
            answer: aiSummary,
            source: t('searchHub.smartSearchBadge'),
          },
        ]
      : []
    : [
        {
          question: t('searchHub.paaQ1', { query: queryLabel }),
          answer: aiSummary || t('searchHub.paaA1'),
          source: t('searchHub.paaSourceSample'),
        },
        {
          question: t('searchHub.paaQ2', { query: queryLabel }),
          answer: t('searchHub.paaA2'),
        },
        {
          question: t('searchHub.paaQ3', { query: queryLabel }),
          answer: t('searchHub.paaA3'),
        },
      ];

  const relatedSearches = isLiveProvider
    ? response.suggestions?.relatedSearches ?? []
    : response.suggestions?.relatedSearches || [
        t('searchHub.relatedS1', { query: queryLabel }),
        t('searchHub.relatedS2', { query: queryLabel }),
        t('searchHub.relatedS3', { query: queryLabel }),
        t('searchHub.relatedS4', { query: queryLabel }),
      ];

  return (
    <div className={cn('flex gap-4', className)}>
      {isFilterOpen && (
        <AdvancedSidebar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          laneCounts={laneCounts}
          isOpen={isFilterOpen}
          onClose={onToggleFilter}
          showClientFilterNote={showClientFilterNote}
          className="sticky top-20 hidden h-fit self-start lg:block"
        />
      )}

      <div className="min-w-0 flex-1 space-y-4">
        {showClientFilterNote && (
          <Text className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            {t('searchHub.advancedFiltersClientOnlyNote')}
          </Text>
        )}
        <TopInfoPanels
          response={response}
          query={queryLabel}
          aiQuestion={t('searchHub.aiQuestion', { query: queryLabel })}
          aiSummary={
            isLiveProvider
              ? (aiSummary ?? '')
              : (aiSummary || t('searchHub.aiSummaryPlaceholder'))
          }
        />

        {images.length > 0 && (
          <ImageSlider images={images} maxVisible={10} onViewAllImages={onViewAllImages} />
        )}

        {fileLanes.map((lane) => (
          <LaneSection
            key={lane.lane}
            lane={lane}
            searchQuery={queryLabel}
            pageVariant={pageVariant}
            onViewAllLane={onViewAllLane}
            maxItems={5}
          />
        ))}

        {nonFileLanes.map((lane) => (
          <LaneSection
            key={lane.lane}
            lane={lane}
            searchQuery={queryLabel}
            pageVariant={pageVariant}
            onViewAllLane={onViewAllLane}
            maxItems={3}
          />
        ))}

        {paaQuestions.length > 0 && <PeopleAlsoAsk questions={paaQuestions} />}

        {relatedSearches.length > 0 && (
          <RelatedSearches searches={relatedSearches} query={queryLabel} pageVariant={pageVariant} />
        )}
      </div>
    </div>
  );
}

export default AllResultsTab;
