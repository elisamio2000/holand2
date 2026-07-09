'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import { SearchHitThumbnail } from './search-hit-thumbnail';
import { HitMatchBadges } from './hit-match-badges';
import { formatFileSize, formatRelativeDate } from '../utils/format-date';
import { hitMimeType, hitSizeBytes } from '../utils/image-hit-filters';

const HOVER_DELAY_MS = 400;

export type ImageHitLayout = 'masonry' | 'grid';

export interface ImageHitCardProps {
  hit: OneSearchHit;
  queryImageEcho?: string;
  onClick?: () => void;
  isActive?: boolean;
  layout?: ImageHitLayout;
  className?: string;
}

/** Clean image thumbnail — metadata appears on hover pause only. */
export function ImageHitCard({
  hit,
  queryImageEcho,
  onClick,
  isActive = false,
  layout = 'grid',
  className,
}: ImageHitCardProps) {
  const { i18n } = useTranslation();
  const [showOverlay, setShowOverlay] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const width = Number(hit.meta?.width || 0);
  const height = Number(hit.meta?.height || 0);
  const mimeType = hitMimeType(hit) || 'image/jpeg';
  const sizeBytes = hitSizeBytes(hit);
  const isMasonry = layout === 'masonry';

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setShowOverlay(true), HOVER_DELAY_MS);
  }, [clearHoverTimer]);

  const handleMouseLeave = useCallback(() => {
    clearHoverTimer();
    setShowOverlay(false);
  }, [clearHoverTimer]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className={cn(
        'group relative text-start',
        isMasonry ? 'mb-4 w-full break-inside-avoid' : 'w-full',
        className
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700',
          isActive && 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-50',
          !isMasonry && 'aspect-square'
        )}
        style={
          isMasonry && width > 0 && height > 0
            ? { aspectRatio: `${width}/${height}` }
            : undefined
        }
      >
        <SearchHitThumbnail
          hit={hit}
          className={cn('h-full w-full', isMasonry ? 'object-cover' : 'object-cover')}
          objectFit="cover"
        />

        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2.5 text-white transition-opacity duration-200',
            showOverlay ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden={!showOverlay}
        >
          <span className="line-clamp-2 text-xs font-medium leading-snug">{hit.title}</span>
          <HitMatchBadges
            hit={hit}
            queryImageEcho={queryImageEcho}
            size="xs"
            className="mt-1 [&_span]:border-white/20 [&_span]:bg-white/15 [&_span]:text-white"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/85">
            {mimeType ? (
              <span className="uppercase">{mimeType.replace('image/', '')}</span>
            ) : null}
            {sizeBytes > 0 ? <span>{formatFileSize(sizeBytes)}</span> : null}
            {hit.occurredAt ? (
              <span>{formatRelativeDate(hit.occurredAt, i18n.language)}</span>
            ) : null}
          </div>
        </div>

        {!showOverlay && (
          <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        )}
      </div>
    </button>
  );
}

export default ImageHitCard;
