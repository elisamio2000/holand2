'use client';

import type { ReactNode } from 'react';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import { PiFilmStripBold, PiPlayFill, PiPauseFill, PiDotsThreeBold } from 'react-icons/pi';
import { vpTokens } from '../helpers/variant-visual-tokens';

interface ListItemShellProps {
  poster?: string;
  thumbnailSlot?: ReactNode;
  title: ReactNode;
  meta?: string;
  isPlaying?: boolean;
  onRowClick?: () => void;
  onPlayClick?: () => void;
  menu?: ReactNode;
  showMoreMenu?: boolean;
  onMoreMenuToggle?: () => void;
  moreMenuPanel?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Ultra-compact list row — mock layout:
 * [thumbnail + play overlay] [title + meta] [⋮ menu]
 */
export function ListItemShell({
  poster,
  thumbnailSlot,
  title,
  meta,
  isPlaying,
  onRowClick,
  onPlayClick,
  menu,
  showMoreMenu,
  onMoreMenuToggle,
  moreMenuPanel,
  trailing,
  className,
  disabled,
}: ListItemShellProps) {
  return (
    <div className={cn(vpTokens.listRow, disabled && 'pointer-events-none opacity-80', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlayClick?.();
        }}
        disabled={disabled}
        className={cn(vpTokens.thumbnail, 'h-10 w-14 rounded-md')}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {thumbnailSlot ? (
          thumbnailSlot
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <PiFilmStripBold className="absolute inset-0 m-auto h-5 w-5 text-gray-400" />
        )}
        <span className={vpTokens.thumbnailOverlay}>
          {isPlaying ? (
            <PiPauseFill className="h-3.5 w-3.5 text-white" />
          ) : (
            <PiPlayFill className="ml-0.5 h-3.5 w-3.5 text-white" />
          )}
        </span>
      </button>

      <button type="button" onClick={onRowClick} className="min-w-0 flex-1 text-start">
        <p className={vpTokens.title}>{title}</p>
        {meta && <p className={cn(vpTokens.meta, 'mt-0.5')}>{meta}</p>}
      </button>

      {trailing}

      {menu ?? (
        onMoreMenuToggle && (
          <div className="relative flex shrink-0 items-center">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={onMoreMenuToggle}
              className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              aria-label="More"
            >
              <PiDotsThreeBold className="h-4 w-4" />
            </ActionIcon>
            {showMoreMenu && moreMenuPanel}
          </div>
        )
      )}
    </div>
  );
}
