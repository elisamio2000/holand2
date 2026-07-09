'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiPlayFill,
  PiPauseFill,
  PiSkipBackFill,
  PiSkipForwardFill,
  PiMusicNoteFill,
  PiSpeakerHighFill,
  PiSpeakerSlashFill,
  PiDotsThreeBold,
  PiRepeatBold,
} from 'react-icons/pi';
import { formatTime } from '../utils/format-time';
import { PLAYBACK_SPEEDS } from '../constants';
import { FloatingPopoverPortal } from '../components/floating-popover-portal';
import type { StickyVariantProps } from '../types';

export function StickyVariant({
  title,
  currentTime,
  duration,
  isPlaying,
  stickyLayout,
  queueIndex = -1,
  queueLength = 0,
  showQueueControls = true,
  volume,
  isMuted,
  playbackRate,
  isLooping,
  className,
  onTogglePlay,
  onSeek,
  onPrev,
  onNext,
  onVolumeChange,
  onToggleLoop,
  onSpeedChange,
}: StickyVariantProps) {
  const { t } = useTranslation();
  const [showVol, setShowVol] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const moreMenuAnchorRef = useRef<HTMLDivElement>(null);

  const isDock = stickyLayout === 'dock';
  const progress = duration > 0 ? currentTime / duration : 0;
  const displayVolume = isMuted ? 0 : volume;
  const hasQueue = showQueueControls && queueLength > 1;

  const shellClass = isDock
    ? cn(
        'fixed bottom-4 inset-x-4 z-[120] mx-auto max-w-3xl',
        'rounded-xl border border-muted bg-gray-0/95 shadow-lg backdrop-blur-sm dark:bg-gray-50/95',
        'overflow-hidden'
      )
    : 'fixed bottom-0 inset-x-0 z-50 border-t border-muted bg-gray-0/95 shadow-lg backdrop-blur-sm dark:bg-gray-50/95';

  const closeMoreMenu = () => {
    setShowMoreMenu(false);
    setShowSpeedMenu(false);
  };

  return (
    <div className={cn(shellClass, className)} data-testid="audio-player-sticky">
      {/* Top progress strip: bar only — dock relies on inline seek bar */}
      {!isDock && (
        <div className="h-[2px] w-full bg-gray-100 dark:bg-gray-200/20">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2',
          !isDock && 'mx-auto max-w-7xl'
        )}
      >
        {hasQueue && (
          <button
            type="button"
            onClick={onPrev}
            disabled={queueIndex <= 0}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 disabled:opacity-30"
            aria-label={t('audioPlayer.previous', 'Previous')}
          >
            <PiSkipBackFill className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
          aria-label={isPlaying ? t('audioPlayer.pause', 'Pause') : t('audioPlayer.play', 'Play')}
        >
          {isPlaying ? (
            <PiPauseFill className="h-4 w-4" />
          ) : (
            <PiPlayFill className="ms-0.5 h-4 w-4" />
          )}
        </button>

        {hasQueue && (
          <button
            type="button"
            onClick={onNext}
            disabled={queueIndex < 0 || queueIndex >= queueLength - 1}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 disabled:opacity-30"
            aria-label={t('audioPlayer.next', 'Next')}
          >
            <PiSkipForwardFill className="h-4 w-4" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PiMusicNoteFill className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs font-medium text-gray-900 dark:text-gray-700">
              {title || t('audioPlayer.untitled', 'Audio')}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary dark:bg-gray-200/30"
              aria-label={t('audioPlayer.seek', 'Seek')}
            />
            <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowVol((p) => !p)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              showVol ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
            )}
            aria-label={t('audioPlayer.volume', 'Volume')}
          >
            {isMuted || displayVolume === 0 ? (
              <PiSpeakerSlashFill className="h-4 w-4" />
            ) : (
              <PiSpeakerHighFill className="h-4 w-4" />
            )}
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              showVol ? 'max-w-[80px] opacity-100' : 'max-w-0 opacity-0'
            )}
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={displayVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary dark:bg-gray-200/30"
            />
          </div>
        </div>

        <div ref={moreMenuAnchorRef} className="relative shrink-0">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={() => {
              setShowMoreMenu((p) => !p);
              setShowSpeedMenu(false);
            }}
            className={cn(
              'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              isLooping && 'text-primary dark:text-primary'
            )}
            aria-expanded={showMoreMenu}
            aria-haspopup="menu"
          >
            <PiDotsThreeBold className="h-4 w-4" />
          </ActionIcon>

          <FloatingPopoverPortal
            open={showMoreMenu}
            onClose={closeMoreMenu}
            anchorRef={moreMenuAnchorRef}
          >
            <button
              type="button"
              onClick={() => onToggleLoop()}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
            >
              <PiRepeatBold
                className={cn(
                  'h-4 w-4',
                  isLooping ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
                )}
              />
              <span className={isLooping ? 'font-medium text-primary' : 'text-gray-600 dark:text-gray-400'}>
                {t('audioPlayer.loop', 'Loop')}
              </span>
              {isLooping && <span className="ms-auto h-2 w-2 rounded-full bg-primary" />}
            </button>
            <button
              type="button"
              onClick={() => setShowSpeedMenu((p) => !p)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
            >
              <span>{t('audioPlayer.speed', 'Speed')}</span>
              <span className="tabular-nums">{playbackRate === 1 ? '1×' : `${playbackRate}×`}</span>
            </button>
            {showSpeedMenu && (
              <div className="border-t border-muted py-1">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => {
                      onSpeedChange(speed);
                      closeMoreMenu();
                    }}
                    className={cn(
                      'flex w-full px-3 py-1.5 text-xs',
                      speed === playbackRate
                        ? 'font-semibold text-primary'
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {speed === 1 ? 'Normal' : `${speed}x`}
                  </button>
                ))}
              </div>
            )}
          </FloatingPopoverPortal>
        </div>
      </div>
    </div>
  );
}
