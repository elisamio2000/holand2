'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import { PiPlayFill, PiPauseFill, PiDotsThreeBold } from 'react-icons/pi';
import { formatTime } from '../utils/format-time';
import { VideoPlayerMoreMenu } from './more-menu';
import type { UseVideoPlaybackReturn } from '../types';

interface ChatInlineControlsProps {
  playback: UseVideoPlaybackReturn;
  duration?: number;
  mirrorPlayback?: { currentTime: number; isPlaying: boolean } | null;
  onExpand?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  moreMenuItems?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
  /** When false, row-level play button owns toggle (ultraCompact inline expansion). */
  showPlayButton?: boolean;
  /** `card` = standalone bordered bar; `footer` = flat strip inside FilePreviewInline. */
  layout?: 'card' | 'footer';
  className?: string;
}

/** Single-row chat controls — mirrors audio `chatInline` layout. */
export function ChatInlineControls({
  playback,
  duration: durationProp,
  mirrorPlayback,
  onExpand,
  onDownload,
  onShare,
  onDelete,
  moreMenuItems,
  showPlayButton = true,
  layout = 'card',
  className,
}: ChatInlineControlsProps) {
  const { t } = useTranslation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const {
    togglePlay,
    currentTime,
    duration,
    isPlaying,
    seekTo,
    loop,
    setLoop,
    playbackRate,
    setPlaybackRate,
  } = playback;

  const isMirror = Boolean(mirrorPlayback);
  const displayDuration = durationProp ?? duration ?? 0;
  const displayCurrentTime = mirrorPlayback?.currentTime ?? currentTime;
  const displayPlaying = mirrorPlayback?.isPlaying ?? isPlaying;
  const progress = displayDuration > 0 ? displayCurrentTime / displayDuration : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMirror || !displayDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * displayDuration);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        layout === 'footer'
          ? 'bg-transparent'
          : 'rounded-xl border border-muted bg-gray-0 px-3 py-2.5 dark:bg-gray-50',
        isMirror && 'pointer-events-none opacity-90',
        className
      )}
    >
      {showPlayButton && (
        <button
          type="button"
          onClick={isMirror ? undefined : togglePlay}
          disabled={isMirror}
          aria-disabled={isMirror}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform',
            'bg-primary text-primary-foreground shadow-sm',
            !isMirror && 'hover:scale-105 active:scale-95'
          )}
          aria-label={displayPlaying ? t('videoPlayer.pause', 'Pause') : t('videoPlayer.play', 'Play')}
        >
          {displayPlaying ? (
            <PiPauseFill className="h-4 w-4" />
          ) : (
            <PiPlayFill className="ml-0.5 h-4 w-4" />
          )}
        </button>
      )}

      <span className="flex shrink-0 items-center text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {formatTime(displayCurrentTime)} / {formatTime(displayDuration || 0)}
      </span>

      <div
        className={cn(
          'relative h-1 min-w-0 flex-1 rounded-full bg-gray-200 dark:bg-gray-200/30',
          !isMirror && 'cursor-pointer'
        )}
        onClick={handleSeek}
        role="slider"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('videoPlayer.progress', 'Progress')}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow-sm"
          style={{ left: `calc(${progress * 100}% - 5px)` }}
        />
      </div>

      {!isMirror && (
        <div className="relative flex shrink-0 items-center">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={() => setShowMoreMenu((p) => !p)}
            className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label={t('common.more', 'More')}
          >
            <PiDotsThreeBold className="h-4 w-4" />
          </ActionIcon>
          <VideoPlayerMoreMenu
            open={showMoreMenu}
            onClose={() => setShowMoreMenu(false)}
            placement="below"
            loop={loop}
            onLoopChange={setLoop}
            playbackRate={playbackRate}
            onSpeedChange={setPlaybackRate}
            onExpand={onExpand}
            onDownload={onDownload}
            onShare={onShare}
            onDelete={onDelete}
            moreMenuItems={moreMenuItems}
          />
        </div>
      )}
    </div>
  );
}
