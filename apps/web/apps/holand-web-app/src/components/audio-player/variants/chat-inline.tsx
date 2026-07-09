'use client';

import { Tooltip } from '@/components/tooltip';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiPlayFill,
  PiPauseFill,
  PiSpeakerHighFill,
  PiWaveformBold,
  PiWarningCircle,
  PiDotsThreeBold,
} from 'react-icons/pi';
import { formatTime } from '../utils/format-time';
import { AudioPlayerMoreMenu } from '../components/more-menu';
import type { VariantProps } from '../types';

export function ChatInlineVariant(props: VariantProps) {
  const { playback, className, duration: durationProp, onSeek, mirrorPlayback, syncAudioRef } = props;
  const {
    containerRef,
    fallbackAudioEl,
    togglePlay,
    currentTime,
    duration,
    isPlaying,
    showWaveform,
    setShowWaveformVisible,
    isWaveSurferActive,
    wsRef,
    getActiveAudio,
    loadError,
    handleRetryLoad,
    isReady,
    inlineWaveformRef,
    setIsFocused,
    showMoreMenu,
    setShowMoreMenu,
    showSpeedControl,
  } = playback;
  const { t } = useTranslation();
  const moreMenuAnchorRef = useRef<HTMLDivElement>(null);

  const isMirror = Boolean(mirrorPlayback);
  const mirrorShowWaveform = mirrorPlayback?.showWaveform ?? showWaveform;
  const sharedDur = syncAudioRef?.current?.duration;
  const displayDuration =
    durationProp ??
    duration ??
    (sharedDur && Number.isFinite(sharedDur) ? sharedDur : 0);
  const displayCurrentTime = mirrorPlayback?.currentTime ?? currentTime;
  const displayPlaying = mirrorPlayback?.isPlaying ?? isPlaying;
  const chatProg = displayDuration > 0 ? displayCurrentTime / displayDuration : 0;
  const effectiveShowWaveform = isMirror ? mirrorShowWaveform : showWaveform;

  const handleChatSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMirror) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (isWaveSurferActive() && wsRef.current) {
      wsRef.current.seekTo(pct);
    } else {
      const a = getActiveAudio();
      if (a && displayDuration > 0) {
        a.currentTime = pct * displayDuration;
      } else if (onSeek) {
        onSeek(pct);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-muted bg-gray-0 px-3 py-2.5 dark:bg-gray-50',
        isMirror && 'pointer-events-none opacity-90',
        className
      )}
    >
      {!isMirror && fallbackAudioEl}
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
      >
        {displayPlaying ? <PiPauseFill className="h-4 w-4" /> : <PiPlayFill className="ml-0.5 h-4 w-4" />}
      </button>

      <span className="flex shrink-0 items-center text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {formatTime(displayCurrentTime)} / {formatTime(displayDuration || 0)}
      </span>

      <div className="relative min-w-0 flex-1">
        {!effectiveShowWaveform && (
          <div
            className={cn(
              'relative h-1 w-full rounded-full bg-gray-200 dark:bg-gray-200/30',
              !isMirror && 'cursor-pointer'
            )}
            onClick={handleChatSeek}
            role="slider"
            aria-label={t('audioPlayer.seekBar', 'Seek')}
            aria-valuemin={0}
            aria-valuemax={displayDuration || 0}
            aria-valuenow={displayCurrentTime}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
              style={{ width: `${chatProg * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow-sm"
              style={{ left: `calc(${chatProg * 100}% - 5px)` }}
            />
          </div>
        )}

        {effectiveShowWaveform && (
          <div
            className={cn(
              'relative h-6 w-full',
              isMirror && 'pointer-events-none',
              !isMirror && 'cursor-pointer'
            )}
            onClick={!isMirror ? handleChatSeek : undefined}
            role={isMirror ? undefined : 'slider'}
            aria-label={isMirror ? undefined : t('audioPlayer.waveform', 'Waveform')}
          >
            {isMirror ? (
              <div
                className="relative h-6 w-full rounded bg-gray-100 dark:bg-gray-200/20"
                aria-hidden
              >
                <div
                  className="absolute inset-y-0 left-0 rounded bg-primary/30"
                  style={{ width: `${chatProg * 100}%` }}
                />
              </div>
            ) : loadError ? (
              <div className="flex h-full items-center gap-2 rounded bg-red-50 px-2 text-[10px] text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t('audioPlayer.loadError', 'Failed to load audio')}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRetryLoad(); }} className="shrink-0 underline">
                  {t('audioPlayer.retry', 'Retry')}
                </button>
              </div>
            ) : (
              <>
                {!isReady && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
                <div
                  ref={inlineWaveformRef}
                  className={cn('h-6 w-full', !isReady && 'opacity-0')}
                />
              </>
            )}
          </div>
        )}
      </div>

      {!isMirror && (
        <>
          <Tooltip content={showWaveform ? t('audioPlayer.hideWaveform', 'Seek bar') : t('audioPlayer.showWaveform', 'Waveform')}>
            <ActionIcon
              variant="text"
              size="sm"
              onClick={() => setShowWaveformVisible(!showWaveform)}
              className="flex shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              {showWaveform
                ? <PiSpeakerHighFill className="h-4 w-4" />
                : <PiWaveformBold className="h-4 w-4" />
              }
            </ActionIcon>
          </Tooltip>

          <div ref={moreMenuAnchorRef} className="relative flex shrink-0 items-center">
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
              showSpeedInMenu={showSpeedControl}
            />
          </div>
        </>
      )}
    </div>
  );
}
