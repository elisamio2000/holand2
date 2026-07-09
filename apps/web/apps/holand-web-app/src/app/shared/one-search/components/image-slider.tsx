'use client';

import { useCallback, useRef } from 'react';
import Link from 'next/link';
import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { PiCaretLeftBold, PiCaretRightBold, PiImagesDuotone, PiArrowRightBold } from 'react-icons/pi';
import type { OneSearchHit } from '@/types/one-search.types';
import { SearchHitThumbnail } from './search-hit-thumbnail';

interface ImageSliderProps {
  images: OneSearchHit[];
  maxVisible?: number;
  totalCount?: number;
  onViewAllImages?: () => void;
  viewAllHref?: string;
  className?: string;
}

export function ImageSlider({
  images,
  maxVisible = 10,
  totalCount,
  onViewAllImages,
  viewAllHref,
  className,
}: ImageSliderProps) {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const visible = images.slice(0, maxVisible);
  const total = totalCount ?? images.length;

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.85) * dir;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  if (visible.length === 0) return null;

  const openAll = () => {
    if (onViewAllImages) onViewAllImages();
    else if (viewAllHref) window.location.assign(viewAllHref);
  };

  return (
    <div className={cn('rounded-lg border border-muted bg-gray-0 p-3 shadow-sm dark:bg-gray-50', className)}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PiImagesDuotone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <Title as="h2" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              {t('searchHub.relatedImages')}
            </Title>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('searchHub.imageStripCount', { shown: visible.length, total })}
            </Text>
          </div>
        </div>

        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-muted px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
          >
            <PiArrowRightBold className="h-3 w-3" />
            {t('searchHub.viewAllImages')}
          </Link>
        ) : onViewAllImages ? (
          <button
            type="button"
            onClick={openAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-muted px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
          >
            <PiArrowRightBold className="h-3 w-3" />
            {t('searchHub.viewAllImages')}
          </button>
        ) : null}
      </div>

      <div className="relative">
        {visible.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              className="absolute start-1 top-1/2 z-[1] -translate-y-1/2 rounded-full bg-gray-0 p-1.5 shadow-md ring-1 ring-muted hover:bg-gray-100 dark:bg-gray-50"
              aria-label={t('searchHub.prevImages')}
            >
              <PiCaretLeftBold className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              className="absolute end-1 top-1/2 z-[1] -translate-y-1/2 rounded-full bg-gray-0 p-1.5 shadow-md ring-1 ring-muted hover:bg-gray-100 dark:bg-gray-50"
              aria-label={t('searchHub.nextImages')}
            >
              <PiCaretRightBold className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
            </button>
          </>
        )}

        <div
          ref={scrollerRef}
          dir="ltr"
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visible.map((image) => (
            <Link
              key={image.id}
              href={image.href || '#'}
              className="snap-start scroll-ml-1 shrink-0"
              style={{ width: '130px' }}
            >
              <div className="relative aspect-square overflow-hidden rounded-md border border-muted bg-gray-100 transition hover:border-primary/40 dark:bg-gray-200/10">
                <SearchHitThumbnail hit={image} className="h-full w-full" objectFit="cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-1.5">
                  <Text className="line-clamp-2 text-[10px] font-medium text-white">{image.title}</Text>
                </div>
              </div>
            </Link>
          ))}

          {(onViewAllImages || viewAllHref) && (
            <button
              type="button"
              onClick={openAll}
              className="flex h-[130px] w-[110px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/30 bg-primary/[0.04] px-2 text-center text-[11px] font-medium text-primary transition hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
            >
              <PiImagesDuotone className="h-6 w-6 opacity-80" />
              <span>{t('searchHub.loadMoreImages')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
