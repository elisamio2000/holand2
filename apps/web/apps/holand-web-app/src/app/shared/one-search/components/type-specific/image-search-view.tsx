'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type {
  OneSearchExecutionMeta,
  OneSearchHit,
  OneSearchQueryImage,
} from '@/types/one-search.types';
import { ImagePreviewPanel } from './image-preview-panel';
import { ImageHitCard, type ImageHitLayout } from '../image-hit-card';
import { MediaSearchToolbar } from '../media-search-toolbar';
import {
  filterMediaHits,
  sortMediaHits,
  type MediaHitFilterState,
  type MediaSortField,
} from '../../utils/image-hit-filters';

export interface ImageSearchViewProps {
  images: OneSearchHit[];
  className?: string;
  onVisualSearch?: (queryImage: OneSearchQueryImage) => void;
  searchMeta?: OneSearchExecutionMeta | null;
  minScore?: number;
  onMinScoreChange?: (minScore?: number) => void;
}

const ITEMS_PER_PAGE = 24;
const DEFAULT_FILTERS: MediaHitFilterState = {
  mimeTypes: [],
  dateRange: 'any',
};

export function ImageSearchView({
  images,
  className,
  onVisualSearch,
  searchMeta,
  minScore,
  onMinScoreChange,
}: ImageSearchViewProps) {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<OneSearchHit | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ImageHitLayout>('grid');
  const [sort, setSort] = useState<MediaSortField>('relevance');
  const [filters, setFilters] = useState<MediaHitFilterState>(DEFAULT_FILTERS);

  const queryImageEcho = searchMeta?.queryImageEcho;

  const processedImages = useMemo(() => {
    const filtered = filterMediaHits(images, {
      ...filters,
      clientMinScore: minScore ?? filters.clientMinScore,
    });
    return sortMediaHits(filtered, sort);
  }, [images, filters, sort, minScore]);

  useEffect(() => {
    setCurrentPage(1);
  }, [processedImages.length, minScore, sort, filters, viewMode]);

  if (processedImages.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {images.length > 0 && (
          <MediaSearchToolbar
            mediaKind="image"
            totalCount={images.length}
            filteredCount={0}
            hits={images}
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onFiltersChange={setFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            minScore={minScore}
            onMinScoreChange={onMinScoreChange}
          />
        )}
        <div className="py-20 text-center">
          {searchMeta?.degradedSources?.visual_search && (
            <p className="mx-auto mb-3 max-w-lg rounded-md border border-amber-200 bg-amber-50/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {searchMeta.degradedSources.visual_search}
            </p>
          )}
          <p className="text-gray-500 dark:text-gray-400">{t('searchHub.noResults')}</p>
        </div>
      </div>
    );
  }

  if (selectedImage) {
    return (
      <ImagePreviewPanel
        key={selectedImage.id}
        image={selectedImage}
        allImages={processedImages}
        onImageSelect={setSelectedImage}
        onBack={() => setSelectedImage(null)}
        onVisualSearch={onVisualSearch}
        queryImageEcho={queryImageEcho}
        viewMode={viewMode}
        className={className}
      />
    );
  }

  const totalPages = Math.ceil(processedImages.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedImages = processedImages.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  return (
    <div className={cn('space-y-4', className)}>
      <MediaSearchToolbar
        mediaKind="image"
        totalCount={images.length}
        filteredCount={processedImages.length}
        hits={images}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        minScore={minScore}
        onMinScoreChange={onMinScoreChange}
      />
      {viewMode === 'masonry' ? (
        <div className="columns-2 gap-4 md:columns-3 lg:columns-4 xl:columns-5">
          {paginatedImages.map((image) => (
            <ImageHitCard
              key={image.id}
              hit={image}
              layout="masonry"
              queryImageEcho={queryImageEcho}
              onClick={() => setSelectedImage(image)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {paginatedImages.map((image) => (
            <ImageHitCard
              key={image.id}
              hit={image}
              layout="grid"
              queryImageEcho={queryImageEcho}
              onClick={() => setSelectedImage(image)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-muted px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            {t('common.previous')}
          </button>
          <span className="flex items-center px-4 text-sm text-gray-600 dark:text-gray-400">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-muted px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}

export default ImageSearchView;
