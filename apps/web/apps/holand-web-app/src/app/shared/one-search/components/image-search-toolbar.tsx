'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiGridFourBold,
  PiSquaresFourBold,
  PiCaretDownBold,
  PiFunnelBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { Button, Dropdown, Input, Text } from 'rizzui';
import type { OneSearchHit } from '@/types/one-search.types';
import { MediaMatchKind, collectUploadedByValues } from '@/app/shared/one-search/utils/media-hit-meta';
import {
  type ImageDateRange,
  type MediaHitFilterState,
  type MediaSortField,
  collectAudioMimeTypes,
  collectImageMimeTypes,
  collectVideoMimeTypes,
  DEFAULT_MEDIA_FILTERS,
  mimeShortLabel,
} from '../utils/image-hit-filters';
import type { ImageHitLayout } from './image-hit-card';

export interface ImageSearchToolbarProps {
  totalCount: number;
  filteredCount: number;
  hits: OneSearchHit[];
  sort: MediaSortField;
  onSortChange: (sort: MediaSortField) => void;
  filters: MediaHitFilterState;
  onFiltersChange: (filters: MediaHitFilterState) => void;
  viewMode: ImageHitLayout;
  onViewModeChange: (mode: ImageHitLayout) => void;
  minScore?: number;
  onMinScoreChange?: (minScore?: number) => void;
  showLayoutToggle?: boolean;
  mediaKind?: 'image' | 'video' | 'audio';
  className?: string;
}

const IMAGE_SORT_OPTIONS: MediaSortField[] = [
  'relevance',
  'date_desc',
  'date_asc',
  'size_desc',
  'size_asc',
];

const MEDIA_SORT_OPTIONS: MediaSortField[] = [
  ...IMAGE_SORT_OPTIONS,
  'duration_desc',
  'duration_asc',
];

const DATE_RANGE_OPTIONS: ImageDateRange[] = ['any', 'today', 'week', 'month', 'year'];

const MATCH_KIND_OPTIONS: MediaMatchKind[] = ['transcript', 'filename', 'metadata'];

export function ImageSearchToolbar({
  totalCount,
  filteredCount,
  hits,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  minScore,
  onMinScoreChange,
  showLayoutToggle = true,
  mediaKind = 'image',
  className,
}: ImageSearchToolbarProps) {
  const { t } = useTranslation();
  const isMediaMode = mediaKind === 'audio' || mediaKind === 'video';
  const sortOptions = isMediaMode ? MEDIA_SORT_OPTIONS : IMAGE_SORT_OPTIONS;

  const resultCountKey =
    mediaKind === 'audio'
      ? 'searchHub.mediaToolbar.audioResultCount'
      : mediaKind === 'video'
        ? 'searchHub.mediaToolbar.videoResultCount'
        : 'searchHub.imageToolbar.resultCount';

  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [minScoreInput, setMinScoreInput] = useState(
    minScore != null ? String(minScore) : filters.clientMinScore != null ? String(filters.clientMinScore) : ''
  );

  useEffect(() => {
    setMinScoreInput(
      minScore != null ? String(minScore) : filters.clientMinScore != null ? String(filters.clientMinScore) : ''
    );
  }, [minScore, filters.clientMinScore]);

  const availableMimes = useMemo(() => {
    if (mediaKind === 'audio') return collectAudioMimeTypes(hits);
    if (mediaKind === 'video') return collectVideoMimeTypes(hits);
    return collectImageMimeTypes(hits);
  }, [hits, mediaKind]);

  const uploadedByOptions = useMemo(
    () => (isMediaMode ? collectUploadedByValues(hits) : []),
    [hits, isMediaMode]
  );

  const sortLabelKey = (field: MediaSortField): string => {
    switch (field) {
      case 'relevance':
        return 'searchHub.filters.sortRelevance';
      case 'date_desc':
        return 'searchHub.filters.sortNewest';
      case 'date_asc':
        return 'searchHub.filters.sortOldest';
      case 'size_desc':
        return 'searchHub.imageToolbar.sortSizeLargest';
      case 'size_asc':
        return 'searchHub.imageToolbar.sortSizeSmallest';
      case 'duration_desc':
        return 'searchHub.mediaToolbar.sortDurationLongest';
      case 'duration_asc':
        return 'searchHub.mediaToolbar.sortDurationShortest';
      default:
        return 'searchHub.filters.sortRelevance';
    }
  };

  const dateRangeLabelKey = (range: ImageDateRange): string => {
    switch (range) {
      case 'today':
        return 'searchHub.filters.today';
      case 'week':
        return 'searchHub.filters.lastWeek';
      case 'month':
        return 'searchHub.filters.lastMonth';
      case 'year':
        return 'searchHub.filters.lastYear';
      default:
        return 'searchHub.filters.anytime';
    }
  };

  const toggleMime = (mime: string) => {
    const next = filters.mimeTypes.includes(mime)
      ? filters.mimeTypes.filter((m) => m !== mime)
      : [...filters.mimeTypes, mime];
    onFiltersChange({ ...filters, mimeTypes: next });
  };

  const toggleMatchKind = (kind: MediaMatchKind) => {
    const current = filters.matchKinds ?? [];
    const next = current.includes(kind)
      ? current.filter((k) => k !== kind)
      : [...current, kind];
    onFiltersChange({ ...filters, matchKinds: next.length ? next : undefined });
  };

  const applyMinScore = () => {
    const parsed = minScoreInput.trim() ? parseFloat(minScoreInput) : undefined;
    const value = parsed != null && Number.isFinite(parsed) ? parsed : undefined;
    onFiltersChange({ ...filters, clientMinScore: value });
    onMinScoreChange?.(value);
  };

  const hasActiveFilters =
    filters.mimeTypes.length > 0 ||
    filters.dateRange !== 'any' ||
    filters.clientMinScore != null ||
    filters.minSizeBytes != null ||
    filters.maxSizeBytes != null ||
    filters.minDurationSec != null ||
    filters.maxDurationSec != null ||
    filters.hasTranscriptOnly === true ||
    (filters.matchKinds?.length ?? 0) > 0 ||
    Boolean(filters.uploadedBy);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {t(resultCountKey, { shown: filteredCount, total: totalCount })}
        </Text>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={filtersPanelOpen || hasActiveFilters ? 'solid' : 'outline'}
            size="sm"
            className="gap-1.5 rounded-md text-xs"
            onClick={() => setFiltersPanelOpen((open) => !open)}
            aria-expanded={filtersPanelOpen}
          >
            <PiFunnelBold className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('searchHub.imageToolbar.filtersTitle')}</span>
            {hasActiveFilters && !filtersPanelOpen ? (
              <span className="ms-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            ) : null}
          </Button>

          <Dropdown placement="bottom-end">
            <Dropdown.Trigger>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-md text-xs">
                {t('searchHub.filters.sortBy')}
                <PiCaretDownBold className="h-3 w-3 opacity-70" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Menu className="min-w-[180px] !z-[60] border border-muted bg-gray-0 shadow-lg dark:bg-gray-50">
              {sortOptions.map((option) => (
                <Dropdown.Item
                  key={option}
                  className={cn(
                    'text-sm',
                    sort === option && 'bg-primary/10 font-medium text-primary'
                  )}
                  onClick={() => onSortChange(option)}
                >
                  {t(sortLabelKey(option))}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          {showLayoutToggle && (
            <>
              <Button
                variant={viewMode === 'masonry' ? 'solid' : 'outline'}
                size="sm"
                className="gap-1.5 rounded-md text-xs"
                onClick={() => onViewModeChange('masonry')}
                aria-pressed={viewMode === 'masonry'}
              >
                <PiSquaresFourBold className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('searchHub.viewModeMasonry')}</span>
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'solid' : 'outline'}
                size="sm"
                className="gap-1.5 rounded-md text-xs"
                onClick={() => onViewModeChange('grid')}
                aria-pressed={viewMode === 'grid'}
              >
                <PiGridFourBold className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('searchHub.viewModeGrid')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {filtersPanelOpen ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-muted bg-gray-0/60 p-3 dark:bg-gray-100/30">
          {!isMediaMode && (
            <div className="min-w-[140px] flex-1">
              <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t('searchHub.imageToolbar.minSimilarity')}
              </Text>
              <Input
                type="number"
                size="sm"
                min={0}
                max={1}
                step={0.01}
                placeholder="0.0"
                value={minScoreInput}
                onChange={(e) => setMinScoreInput(e.target.value)}
                onBlur={applyMinScore}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyMinScore();
                }}
                className="[&_input]:text-xs"
              />
            </div>
          )}

          <div className="min-w-[140px] flex-1">
            <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t('searchHub.filters.dateRange')}
            </Text>
            <select
              value={filters.dateRange}
              onChange={(e) =>
                onFiltersChange({ ...filters, dateRange: e.target.value as ImageDateRange })
              }
              className="h-9 w-full rounded-md border border-muted bg-gray-0 px-2 text-xs text-gray-800 dark:bg-gray-50 dark:text-gray-600"
            >
              {DATE_RANGE_OPTIONS.map((range) => (
                <option key={range} value={range}>
                  {t(dateRangeLabelKey(range))}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px] flex-1">
            <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t('searchHub.imageToolbar.minSize')}
            </Text>
            <Input
              type="number"
              size="sm"
              min={0}
              placeholder="KB"
              value={
                filters.minSizeBytes != null ? String(Math.round(filters.minSizeBytes / 1024)) : ''
              }
              onChange={(e) => {
                const kb = e.target.value.trim() ? parseInt(e.target.value, 10) : undefined;
                onFiltersChange({
                  ...filters,
                  minSizeBytes: kb != null && Number.isFinite(kb) ? kb * 1024 : undefined,
                });
              }}
              className="[&_input]:text-xs"
            />
          </div>

          <div className="min-w-[120px] flex-1">
            <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t('searchHub.imageToolbar.maxSize')}
            </Text>
            <Input
              type="number"
              size="sm"
              min={0}
              placeholder="KB"
              value={
                filters.maxSizeBytes != null ? String(Math.round(filters.maxSizeBytes / 1024)) : ''
              }
              onChange={(e) => {
                const kb = e.target.value.trim() ? parseInt(e.target.value, 10) : undefined;
                onFiltersChange({
                  ...filters,
                  maxSizeBytes: kb != null && Number.isFinite(kb) ? kb * 1024 : undefined,
                });
              }}
              className="[&_input]:text-xs"
            />
          </div>

          {isMediaMode && (
            <>
              <div className="min-w-[100px] flex-1">
                <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {t('searchHub.mediaToolbar.minDurationSec')}
                </Text>
                <Input
                  type="number"
                  size="sm"
                  min={0}
                  placeholder="sec"
                  value={filters.minDurationSec != null ? String(filters.minDurationSec) : ''}
                  onChange={(e) => {
                    const v = e.target.value.trim() ? parseInt(e.target.value, 10) : undefined;
                    onFiltersChange({
                      ...filters,
                      minDurationSec: v != null && Number.isFinite(v) ? v : undefined,
                    });
                  }}
                  className="[&_input]:text-xs"
                />
              </div>
              <div className="min-w-[100px] flex-1">
                <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {t('searchHub.mediaToolbar.maxDurationSec')}
                </Text>
                <Input
                  type="number"
                  size="sm"
                  min={0}
                  placeholder="sec"
                  value={filters.maxDurationSec != null ? String(filters.maxDurationSec) : ''}
                  onChange={(e) => {
                    const v = e.target.value.trim() ? parseInt(e.target.value, 10) : undefined;
                    onFiltersChange({
                      ...filters,
                      maxDurationSec: v != null && Number.isFinite(v) ? v : undefined,
                    });
                  }}
                  className="[&_input]:text-xs"
                />
              </div>
              <label className="flex min-w-[140px] items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={filters.hasTranscriptOnly === true}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      hasTranscriptOnly: e.target.checked || undefined,
                    })
                  }
                  className="rounded border-muted"
                />
                {t('searchHub.mediaToolbar.hasTranscriptOnly')}
              </label>
            </>
          )}

          {uploadedByOptions.length > 0 && (
            <div className="min-w-[140px] flex-1">
              <Text className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t('searchHub.mediaToolbar.uploadedBy')}
              </Text>
              <select
                value={filters.uploadedBy ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    uploadedBy: e.target.value || undefined,
                  })
                }
                className="h-9 w-full rounded-md border border-muted bg-gray-0 px-2 text-xs text-gray-800 dark:bg-gray-50 dark:text-gray-600"
              >
                <option value="">{t('searchHub.filters.anytime')}</option>
                {uploadedByOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableMimes.length > 0 && (
            <div className="w-full">
              <Text className="mb-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t('searchHub.imageToolbar.formatFilter')}
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {availableMimes.map((mime) => {
                  const active = filters.mimeTypes.includes(mime);
                  return (
                    <button
                      key={mime}
                      type="button"
                      onClick={() => toggleMime(mime)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
                      )}
                    >
                      {mimeShortLabel(mime, mediaKind === 'image' ? 'image' : mediaKind)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isMediaMode && (
            <div className="w-full">
              <Text className="mb-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t('searchHub.mediaToolbar.matchKindFilter')}
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {MATCH_KIND_OPTIONS.map((kind) => {
                  const active = filters.matchKinds?.includes(kind) ?? false;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => toggleMatchKind(kind)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
                      )}
                    >
                      {t(`searchHub.mediaMatch.${kind}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <Button
              variant="text"
              size="sm"
              className="text-xs text-gray-500"
              onClick={() => {
                setMinScoreInput('');
                onFiltersChange({ ...DEFAULT_MEDIA_FILTERS });
                onMinScoreChange?.(undefined);
              }}
            >
              {t('searchHub.filters.clearAll')}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default ImageSearchToolbar;
