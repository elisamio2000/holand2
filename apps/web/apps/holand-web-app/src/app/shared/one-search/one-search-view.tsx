'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Title, Text, Badge, Input } from 'rizzui';
import cn from '@core/utils/class-names';
import type { OneSearchMode, OneSearchProviderId, OneSearchLaneId, OneSearchHit } from '@/types/one-search.types';
import { buildOneSearchUrl, laneExploreHref } from '@/app/shared/one-search/utils/search-urls';
import { useOneSearch } from '@/app/shared/one-search/hooks/use-one-search';
import { useSearchUrlState } from '@/app/shared/one-search/hooks/use-search-url-state';
import { useVisualSearchState } from '@/app/shared/one-search/hooks/use-visual-search-state';
import { useOneSearchCompactBarPin } from '@/app/shared/one-search/hooks/use-one-search-compact-bar-pin';
import { isOneSearchDevPanelEnabled, ONE_SEARCH_DEFAULT_LIMIT } from '@/app/shared/one-search/config/search-config';
import {
  DEFAULT_ADVANCED_FILTERS,
  applyAdvancedFiltersToResponse,
  hasActiveAdvancedFilters,
} from '@/app/shared/one-search/utils/advanced-search-filters';
import type { AdvancedSearchFilters } from '@/app/shared/one-search/components/advanced-sidebar';
import {
  OneSearchCompactBar,
  OneSearchLanding,
} from '@/app/shared/one-search/one-search-chrome';
import {
  ModeSelector,
  ImageSearchView,
  VideoSearchView,
  AudioSearchView,
  FileSearchView,
  TextSearchView,
  AllResultsTab,
  SearchResultsSkeleton,
} from './components';
import { SearchModeEmptyState } from './components/search-mode-empty-state';
import OneSearchDevRequirementsPanel from './components/one-search-dev-requirements-panel';
import { SearchInsightsBanner } from './components/search-insights-banner';
import { cancelSearchMediaQueues } from '@/app/shared/one-search/utils/search-media-fetch';
import { bindOneSearchScrollPadding } from '@/app/shared/one-search/utils/one-search-scroll-padding';
import { hitMatchesSearchMode } from './utils/hit-media-mode';
import { useMediaSearchControls } from '@/app/shared/one-search/hooks/use-media-search-controls';
import { dedupeHitsByArtifactId, hitMediaMeta } from '@/app/shared/one-search/utils/media-hit-meta';

const ONE_SEARCH_LANDING_EXPERIMENT_NEUTRAL_BG = true;

export type OneSearchVariant = 'default' | 'advanced';

export interface OneSearchViewProps {
  variant?: OneSearchVariant;
  providerId?: OneSearchProviderId;
}

export default function OneSearchView({
  variant = 'default',
  providerId,
}: OneSearchViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isFilterOpen, setIsFilterOpen] = useState(variant === 'advanced');
  const [scoreThreshold, setScoreThreshold] = useState<number | undefined>();
  const [advancedMinScore, setAdvancedMinScore] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>(DEFAULT_ADVANCED_FILTERS);
  const prevSearchMediaKeyRef = useRef('');
  const showDevPanels = isOneSearchDevPanelEnabled();

  const {
    query,
    setQuery,
    mode,
    setMode,
    queryImage,
    setQueryImage,
    qParam,
    modeParam,
    hasQuery,
    applyToUrl,
    advancedHref,
    simpleHref,
  } = useSearchUrlState(variant);

  const {
    imageUploading,
    uploadRateLimited,
    visualArtifactChip,
    runVisualSearch,
    handleClearVisual,
    handleImageUpload,
    clearPreviewOnTextSubmit,
    ephemeralCleanupEnabled,
  } = useVisualSearchState({
    query,
    mode,
    queryImage,
    setQueryImage,
    setMode,
    applyToUrl,
  });

  const isMediaMode = modeParam === 'audio' || modeParam === 'video';
  const mediaControls = useMediaSearchControls();
  const prevMediaKeyRef = useRef('');

  const mediaRequestPatch = useMemo(
    () => (isMediaMode ? mediaControls.toSearchRequestPatch() : undefined),
    [
      isMediaMode,
      mediaControls.sort,
      mediaControls.filters,
      mediaControls.offset,
      mediaControls.limit,
      mediaControls.toSearchRequestPatch,
    ]
  );

  useEffect(() => {
    const mediaKey = `${modeParam}:${qParam}`;
    if (prevMediaKeyRef.current && prevMediaKeyRef.current !== mediaKey) {
      mediaControls.resetPagination();
    }
    prevMediaKeyRef.current = mediaKey;
  }, [modeParam, qParam, mediaControls.resetPagination]);

  const {
    response: searchResponse,
    meta: searchMeta,
    loading: searchLoading,
    error: searchError,
    errorCategory: searchErrorCategory,
    rateLimited: searchRateLimited,
    refetch: refetchSearch,
    isMockProvider,
    isTempProvider,
    isSmartSearchProvider,
    isLegacyFederatedProvider,
  } = useOneSearch({
    query: qParam,
    mode: modeParam,
    queryImage,
    scoreThreshold,
    advancedFilters,
    mediaRequestPatch,
    providerId,
  });

  const displayResponse = useMemo(() => {
    if (!searchResponse) return null;
    if (modeParam !== 'all' || !hasActiveAdvancedFilters(advancedFilters)) {
      return searchResponse;
    }
    return applyAdvancedFiltersToResponse(searchResponse, advancedFilters);
  }, [searchResponse, modeParam, advancedFilters]);

  const [mediaHitsAccum, setMediaHitsAccum] = useState<OneSearchHit[]>([]);

  const freshMediaHits = useMemo(() => {
    if (!displayResponse || !isMediaMode) return [];
    return displayResponse.lanes.flatMap((lane) =>
      lane.hits.filter((hit) => hitMatchesSearchMode(hit, modeParam as 'audio' | 'video'))
    );
  }, [displayResponse, isMediaMode, modeParam]);

  useEffect(() => {
    if (!isMediaMode) {
      setMediaHitsAccum([]);
      return;
    }
    if (mediaControls.offset === 0) {
      setMediaHitsAccum(freshMediaHits);
    } else if (freshMediaHits.length > 0) {
      setMediaHitsAccum((prev) => dedupeHitsByArtifactId([...prev, ...freshMediaHits]));
    }
  }, [freshMediaHits, mediaControls.offset, isMediaMode, qParam, modeParam]);

  const mediaHits =
    isMediaMode && mediaControls.offset === 0 ? freshMediaHits : isMediaMode ? mediaHitsAccum : freshMediaHits;

  const mediaServerMetadataReady = useMemo(() => {
    if (!isMediaMode || mediaHits.length === 0) return true;
    return mediaHits.some((h) => hitMediaMeta(h).duration != null || hitMediaMeta(h).match != null);
  }, [isMediaMode, mediaHits]);

  const mediaHasMore = useMemo(() => {
    if (!isMediaMode) return false;
    const total = displayResponse?.total;
    if (total != null && total > 0) return mediaHits.length < total;
    return freshMediaHits.length >= (mediaControls.limit ?? ONE_SEARCH_DEFAULT_LIMIT);
  }, [isMediaMode, displayResponse?.total, mediaHits.length, freshMediaHits.length, mediaControls.limit]);

  const mediaControlsProps = useMemo(
    () =>
      isMediaMode
        ? {
            sort: mediaControls.sort,
            onSortChange: mediaControls.setSort,
            filters: mediaControls.filters,
            onFiltersChange: mediaControls.setFilters,
            searchQuery: qParam,
            onLoadMore: mediaControls.loadMore,
            hasMore: mediaHasMore,
            paginationLoading: searchLoading && mediaControls.offset > 0,
            totalCount: displayResponse?.total,
            serverMetadataReady: mediaServerMetadataReady,
          }
        : undefined,
    [
      isMediaMode,
      mediaControls.sort,
      mediaControls.setSort,
      mediaControls.filters,
      mediaControls.setFilters,
      mediaControls.loadMore,
      mediaControls.offset,
      qParam,
      mediaHasMore,
      searchLoading,
      displayResponse?.total,
      mediaServerMetadataReady,
    ]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // In landing (no existing query), use mode state (user's selection);
      // In results view, use modeParam from URL to preserve current mode.
      const targetMode = hasQuery ? modeParam : mode;
      if (queryImage?.artifact_id || visualArtifactChip) {
        clearPreviewOnTextSubmit();
      } else {
        applyToUrl(query, targetMode, null);
      }
    },
    [applyToUrl, query, mode, modeParam, hasQuery, clearPreviewOnTextSubmit, queryImage, visualArtifactChip]
  );

  const handleVoiceQuery = useCallback(
    (transcript: string) => {
      const targetMode = modeParam === 'audio' ? 'audio' : modeParam;
      applyToUrl(transcript.trim(), targetMode, queryImage);
    },
    [applyToUrl, modeParam, queryImage]
  );

  const handleClearQuery = useCallback(() => {
    setQuery('');
    if (qParam || queryImage?.artifact_id) {
      applyToUrl('', modeParam, null);
    }
  }, [setQuery, qParam, queryImage?.artifact_id, applyToUrl, modeParam]);


  const showRateLimitBanner =
    uploadRateLimited ||
    searchRateLimited ||
    searchErrorCategory === 'rate_limited' ||
    Boolean(searchMeta?.rateLimited);

  const searchMediaKey = `${modeParam}:${qParam}:${queryImage?.artifact_id ?? ''}:${queryImage?.crop ? JSON.stringify(queryImage.crop) : ''}`;

  useEffect(() => {
    if (prevSearchMediaKeyRef.current && prevSearchMediaKeyRef.current !== searchMediaKey) {
      cancelSearchMediaQueues();
    }
    prevSearchMediaKeyRef.current = searchMediaKey;
  }, [searchMediaKey]);

  useLayoutEffect(() => bindOneSearchScrollPadding(), []);

  const { sentinelRef, barRef, pin } = useOneSearchCompactBarPin(hasQuery);

  const showMockBadge = isMockProvider;
  const showTempBadge =
    isLegacyFederatedProvider ||
    (isSmartSearchProvider &&
      Boolean(searchMeta?.calls?.some((c) => c.notes?.includes('Fell back to temp-federated'))));

  const textResults = useMemo((): Array<OneSearchHit & { lane: OneSearchLaneId }> => {
    if (!displayResponse) return [];
    return displayResponse.lanes.flatMap((lane) =>
      lane.hits.map((hit) => ({ ...hit, lane: lane.lane }))
    );
  }, [displayResponse]);

  return (
    <div
      className={cn(
        'relative min-h-screen w-full',
        hasQuery
          ? 'bg-gray-0 dark:bg-gray-50'
          : ONE_SEARCH_LANDING_EXPERIMENT_NEUTRAL_BG
            ? 'bg-gray-0 dark:bg-gray-50'
            : 'bg-[#f5f6f7] dark:bg-gray-50'
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute end-3 top-3 z-40 flex flex-wrap justify-end gap-2 sm:end-6 sm:top-4',
          hasQuery && 'hidden sm:flex'
        )}
      >
        {isSmartSearchProvider && (
          <Badge color="primary" rounded="md" className="pointer-events-auto shadow-sm">
            {t('searchHub.smartSearchBadge')}
          </Badge>
        )}
        {isLegacyFederatedProvider && (
          <Badge color="info" rounded="md" className="pointer-events-auto shadow-sm">
            {t('searchHub.tempApiBadge')}
          </Badge>
        )}
        {isMockProvider && (
          <Badge color="warning" rounded="md" className="pointer-events-auto shadow-sm">
            {t('searchHub.previewBadge')}
          </Badge>
        )}
        {showMockBadge && (
          <Badge color="secondary" rounded="md" className="pointer-events-auto shadow-sm">
            {t('searchHub.mockSampleBadge')}
          </Badge>
        )}
        {showTempBadge && (
          <Badge color="success" rounded="md" className="pointer-events-auto shadow-sm">
            {t('searchHub.realDataBadge')}
          </Badge>
        )}
      </div>

      {hasQuery && (
        <>
          <div ref={sentinelRef} className="pointer-events-none h-px w-full shrink-0" aria-hidden />
          {pin.active && pin.placeholderHeight > 0 ? (
            <div
              aria-hidden
              className="shrink-0"
              style={{ height: pin.placeholderHeight }}
            />
          ) : null}
          <OneSearchCompactBar
            barRef={barRef}
            pinned={pin.active}
            pinStyle={pin.style}
            query={query}
            setQuery={setQuery}
            onSubmit={onSubmit}
            variant={variant}
            onOpenAdvanced={() => router.push(advancedHref)}
            onOpenSimple={() => router.push(simpleHref)}
            isFilterOpen={isFilterOpen}
            onToggleFilter={() => setIsFilterOpen((p) => !p)}
            onImageUpload={handleImageUpload}
            imageUploading={imageUploading}
            visualArtifact={visualArtifactChip}
            onClearVisual={handleClearVisual}
            onClearQuery={handleClearQuery}
            voiceSearchEnabled={modeParam === 'audio'}
            onVoiceQuery={handleVoiceQuery}
          />
        </>
      )}

      {!hasQuery ? (
        <OneSearchLanding
          query={query}
          setQuery={setQuery}
          mode={mode}
          setMode={setMode}
          onSubmit={onSubmit}
          onQuickSearch={(q) => applyToUrl(q, mode)}
          variant={variant}
          onOpenAdvanced={() => router.push(advancedHref)}
          onOpenSimple={() => router.push(simpleHref)}
          mockEnabled={isMockProvider}
          isTempProvider={isTempProvider}
          isSmartSearchProvider={isSmartSearchProvider}
          onImageUpload={handleImageUpload}
          imageUploading={imageUploading}
          visualArtifact={visualArtifactChip}
          onClearVisual={handleClearVisual}
          onClearQuery={handleClearQuery}
          voiceSearchEnabled={mode === 'audio'}
          onVoiceQuery={handleVoiceQuery}
        />
      ) : (
        <div className="w-full px-4 pb-20 pt-4 @md:px-6 2xl:px-8">
          <div className="mb-4">
            <ModeSelector
              activeMode={modeParam}
              onChange={(newMode) => applyToUrl(query, newMode, queryImage)}
            />
          </div>

          {searchLoading && <SearchResultsSkeleton mode={modeParam} />}

          {showRateLimitBanner && !searchLoading && (
            <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-950/25">
              <Text className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {t('searchHub.rateLimitedTitle')}
              </Text>
              <Text className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
                {t('searchHub.rateLimitedMessage')}
              </Text>
              <button
                type="button"
                onClick={() => {
                  refetchSearch(true);
                }}
                className="mt-3 rounded-md border border-amber-300 bg-gray-0 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-gray-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
              >
                {t('searchHub.rateLimitedRetry')}
              </button>
            </section>
          )}

          {!searchLoading && searchError && !showRateLimitBanner && (
            <section className="mb-6 rounded-lg border border-red-200 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/20">
              <Text className="text-sm text-red-700 dark:text-red-300">{searchError}</Text>
            </section>
          )}

          {!searchLoading && displayResponse && isSmartSearchProvider && (
            <SearchInsightsBanner response={displayResponse} meta={searchMeta} />
          )}

          {!searchLoading && modeParam === 'image' && displayResponse ? (
            <ImageSearchView
              images={displayResponse.lanes.flatMap((lane) =>
                lane.hits.filter((hit) => hitMatchesSearchMode(hit, 'image'))
              )}
              onVisualSearch={(visual) => runVisualSearch(visual, 'image')}
              searchMeta={searchMeta}
              minScore={scoreThreshold}
              onMinScoreChange={setScoreThreshold}
            />
          ) : !searchLoading && modeParam === 'video' && displayResponse ? (
            <VideoSearchView
              videos={mediaHits}
              mediaControls={mediaControlsProps}
            />
          ) : !searchLoading && modeParam === 'audio' && displayResponse ? (
            <AudioSearchView
              audios={mediaHits}
              mediaControls={mediaControlsProps}
            />
          ) : !searchLoading && modeParam === 'file' && displayResponse ? (
            <FileSearchView
              files={displayResponse.lanes.flatMap((lane) =>
                lane.hits.filter((hit) => lane.lane === 'files' || lane.lane === 'storage')
              )}
            />
          ) : !searchLoading && modeParam === 'text' && displayResponse ? (
            <TextSearchView results={textResults} />
          ) : !searchLoading && modeParam === 'all' && displayResponse ? (
            <AllResultsTab
              response={displayResponse}
              searchQuery={qParam}
              aiSummary={searchMeta?.aiSummary}
              pageVariant={variant}
              isFilterOpen={isFilterOpen}
              onToggleFilter={() => setIsFilterOpen((p) => !p)}
              onViewAllLane={(lane) => router.push(laneExploreHref(lane, qParam, variant))}
              onViewAllImages={() =>
                router.push(buildOneSearchUrl({ q: qParam, mode: 'image', variant }))
              }
              onMinScoreChange={setScoreThreshold}
              isLiveProvider={isSmartSearchProvider || isLegacyFederatedProvider}
              filters={advancedFilters}
              onFiltersChange={(next) => {
                setAdvancedFilters(next);
                if (next.minScore !== advancedFilters.minScore) {
                  setScoreThreshold(next.minScore);
                }
              }}
              showClientFilterNote={
                (isSmartSearchProvider || isLegacyFederatedProvider) &&
                hasActiveAdvancedFilters(advancedFilters)
              }
            />
          ) : !searchLoading && !searchError ? (
            <SearchModeEmptyState mode={modeParam} />
          ) : null}

          {showDevPanels && (
            <OneSearchDevRequirementsPanel
              mode={modeParam}
              variant={variant}
              meta={searchMeta}
              queryImage={queryImage}
              ephemeralCleanupEnabled={ephemeralCleanupEnabled}
            />
          )}

          {variant === 'advanced' && hasQuery && (
            <section className="mt-6 rounded-lg border border-muted bg-gray-0/80 p-4 dark:bg-gray-100/40">
              <Title as="h3" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
                {t('searchHub.filters.minScore')}
              </Title>
              <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('searchHub.advancedMinScoreHint')}
              </Text>
              <Input
                type="number"
                size="sm"
                min={0}
                max={1}
                step={0.1}
                placeholder="0.0 – 1.0"
                value={advancedMinScore}
                onChange={(e) => {
                  const raw = e.target.value;
                  setAdvancedMinScore(raw);
                  setScoreThreshold(raw ? parseFloat(raw) : undefined);
                }}
                className="mt-3 max-w-[200px] [&_input]:text-xs"
              />
            </section>
          )}

          <div className="mt-10 grid gap-5 border-t border-muted pt-8 @md:grid-cols-2">
            <section>
              <Title as="h3" className="text-sm font-semibold text-gray-800 dark:text-gray-700">
                {t('searchHub.dorkTitle')}
              </Title>
              <Text className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {t('searchHub.dorkBody')}
              </Text>
            </section>
            <section>
              <Title as="h3" className="text-sm font-semibold text-gray-800 dark:text-gray-700">
                {t('searchHub.transliterationTitle')}
              </Title>
              <Text className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {t('searchHub.transliterationBody')}
              </Text>
            </section>
          </div>

          {variant === 'advanced' && (
            <section className="mt-8 rounded-lg border border-primary/20 bg-primary/[0.04] p-5 dark:border-primary/15 dark:bg-primary/[0.06]">
              <Title as="h3" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
                {t('searchHub.advancedSearchTitle')}
              </Title>
              <Text className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {t('searchHub.advancedSearchDesc')}
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {['type:chat', 'case:*', 'lang:fa', 'before:2026-01-01', 'path:*report*'].map((op) => (
                  <code
                    key={op}
                    className="rounded-md border border-muted bg-gray-0 px-2 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-100 dark:text-gray-400"
                  >
                    {op}
                  </code>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!hasQuery && variant === 'advanced' && (
        <div className="px-4 pb-12 @md:px-6 2xl:px-8">
          <section className="rounded-lg border border-primary/20 bg-primary/[0.04] p-5 dark:border-primary/15 dark:bg-primary/[0.06]">
            <Title as="h3" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              {t('searchHub.advancedSearchTitle')}
            </Title>
            <Text className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {t('searchHub.advancedSearchDesc')}
            </Text>
          </section>
        </div>
      )}

      {showDevPanels && !hasQuery && (
        <div className="px-4 pb-12 @md:px-6 2xl:px-8">
          <OneSearchDevRequirementsPanel
            mode={mode}
            variant={variant}
            meta={null}
            queryImage={queryImage}
            ephemeralCleanupEnabled={ephemeralCleanupEnabled}
          />
        </div>
      )}
    </div>
  );
}
