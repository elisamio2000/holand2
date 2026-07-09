'use client';

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiPlayFill,
  PiPauseFill,
  PiSpeakerHighFill,
  PiSpeakerSlashFill,
  PiDownloadBold,
  PiMusicNoteFill,
  PiDotsThreeBold,
} from 'react-icons/pi';
import { formatTime, formatFileSize } from '../utils/format-time';
import { AudioPlayerMoreMenu } from '../components/more-menu';
import type { VariantProps } from '../types';

export function CompactVariant(props: VariantProps) {
  const {
    playback,
    title,
    mimeType,
    fileSize,
    duration: durationProp,
    className,
    onSeek,
    onDownload,
    onShare,
    onDelete,
    moreMenuItems,
  } = props;
  const {
    fallbackAudioEl,
    togglePlay,
    isPlaying,
    currentTime,
    duration,
    showVolume,
    isMuted,
    volume,
    toggleMute,
    wsRef,
    getActiveAudio,
    showMoreMenu,
    setShowMoreMenu,
  } = playback;
  const { t } = useTranslation();
  const moreMenuAnchorRef = useRef<HTMLDivElement>(null);

  const displayDuration = durationProp ?? duration;
  const ext = mimeType?.split('/').pop()?.toUpperCase() || '';
  const compactProg = duration > 0 ? currentTime / duration : 0;

  const handleCompactSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (wsRef.current && duration > 0) {
      wsRef.current.seekTo(pct);
    } else {
      const a = getActiveAudio();
      if (a && duration > 0) a.currentTime = pct * duration;
      else if (onSeek) onSeek(pct);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-muted bg-gray-0 px-3 py-2.5 dark:bg-gray-50',
        className
      )}
    >
      {fallbackAudioEl}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <PiMusicNoteFill className="h-4.5 w-4.5 text-primary" />
      </div>

      <div className="flex min-w-0 flex-shrink-0 flex-col justify-center">
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
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform',
          'bg-primary text-primary-foreground shadow-sm hover:scale-105 active:scale-95'
        )}
      >
        {isPlaying ? <PiPauseFill className="h-3.5 w-3.5" /> : <PiPlayFill className="ml-0.5 h-3.5 w-3.5" />}
      </button>

      <span className="flex shrink-0 items-center text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        {formatTime(currentTime)} / {formatTime(displayDuration || 0)}
      </span>

      <div
        className="relative h-1 min-w-0 flex-1 cursor-pointer rounded-full bg-gray-200 dark:bg-gray-200/30"
        onClick={handleCompactSeek}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
          style={{ width: `${compactProg * 100}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow-sm"
          style={{ left: `calc(${compactProg * 100}% - 5px)` }}
        />
      </div>

      {showVolume && (
        <ActionIcon
          variant="text"
          size="sm"
          onClick={toggleMute}
          className="flex shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          {isMuted || volume === 0 ? <PiSpeakerSlashFill className="h-4 w-4" /> : <PiSpeakerHighFill className="h-4 w-4" />}
        </ActionIcon>
      )}

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
