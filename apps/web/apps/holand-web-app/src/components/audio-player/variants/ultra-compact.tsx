'use client';

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiPlayFill,
  PiPauseFill,
  PiDownloadBold,
  PiMusicNoteFill,
  PiDotsThreeBold,
} from 'react-icons/pi';
import { formatTime, formatFileSize } from '../utils/format-time';
import { AudioPlayerMoreMenu } from '../components/more-menu';
import type { VariantProps } from '../types';

export function UltraCompactVariant(props: VariantProps) {
  const {
    playback,
    title,
    mimeType,
    fileSize,
    duration: durationProp,
    className,
    onDownload,
    onShare,
    onDelete,
    moreMenuItems,
  } = props;
  const {
    fallbackAudioEl,
    togglePlay,
    isPlaying,
    duration,
    showMoreMenu,
    setShowMoreMenu,
  } = playback;
  const { t } = useTranslation();
  const moreMenuAnchorRef = useRef<HTMLDivElement>(null);

  const displayDuration = durationProp ?? duration;
  const ext = mimeType?.split('/').pop()?.toUpperCase() || '';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-muted bg-gray-0 px-3 py-2.5 dark:bg-gray-50',
        className
      )}
    >
      {fallbackAudioEl}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <PiMusicNoteFill className="h-4 w-4 text-primary" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
            {title || 'Audio'}
          </span>
          {ext && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-gray-200/20 dark:text-gray-400">
              {ext}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          {fileSize ? formatFileSize(fileSize) : ''}
          {fileSize && displayDuration ? ' · ' : ''}
          {displayDuration ? formatTime(displayDuration) : ''}
        </p>
      </div>

      <button
        onClick={togglePlay}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform',
          'bg-primary text-primary-foreground shadow-sm hover:scale-105 active:scale-95'
        )}
      >
        {isPlaying ? <PiPauseFill className="h-3.5 w-3.5" /> : <PiPlayFill className="ml-0.5 h-3.5 w-3.5" />}
      </button>

      <div ref={moreMenuAnchorRef} className="relative flex items-center">
        <ActionIcon
          variant="text"
          size="sm"
          onClick={() => setShowMoreMenu((p) => !p)}
          className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <PiDotsThreeBold className="h-4 w-4" />
        </ActionIcon>
        <AudioPlayerMoreMenu
          playback={playback}
          open={showMoreMenu}
          anchorRef={moreMenuAnchorRef}
          placement="below"
          showSpeedInMenu
          onDownload={onDownload}
          onShare={onShare}
          onDelete={onDelete}
          moreMenuItems={moreMenuItems}
        />
      </div>
    </div>
  );
}
