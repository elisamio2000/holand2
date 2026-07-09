'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiPlayFill,
  PiPauseFill,
  PiArrowCounterClockwise,
  PiArrowClockwise,
  PiCameraBold,
  PiClosedCaptioningBold,
  PiArrowsOutSimple,
  PiPictureInPictureBold,
  PiDotsThreeBold,
  PiRepeatBold,
} from 'react-icons/pi';
import { formatTime } from '../utils/format-time';
import { VolumeControl } from './volume-control';
import { SettingsMenu } from './settings-menu';
import { PLAYBACK_SPEEDS } from '../constants';
import { LiveDvrBadge } from '../components/live-dvr-badge';
import type {
  VideoAudioTrack,
  VideoQualityLevel,
  VideoSubtitleTrack,
} from '../types';

const iconBtnClassDefault =
  'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
const iconBtnClassOverlay = 'text-white/80 hover:text-white';

interface ControlBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isLive?: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (v: number) => void;
  onMutedChange: (m: boolean) => void;
  onSpeedChange: (r: number) => void;
  onScreenshot?: () => void;
  onFullscreen?: () => void;
  onPiP?: () => void;
  onToggleSubtitles?: () => void;
  subtitlesEnabled?: boolean;
  enableFullscreen?: boolean;
  enablePiP?: boolean;
  levels?: VideoQualityLevel[];
  activeLevelId?: string;
  autoLevel?: boolean;
  onLevelChange?: (id: string) => void;
  audioTracks?: VideoAudioTrack[];
  activeAudioTrackId?: string | null;
  onAudioTrackChange?: (id: string) => void;
  subtitles?: VideoSubtitleTrack[];
  activeSubtitleId?: string | null;
  onSubtitleChange?: (id: string | null) => void;
  loop?: boolean;
  onLoopChange?: (v: boolean) => void;
  moreMenuItems?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
  compact?: boolean;
  /** White icon styling for overlay chrome on dark video stage. */
  overlay?: boolean;
  className?: string;
}

export function ControlBar({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isLive = false,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onMutedChange,
  onSpeedChange,
  onScreenshot,
  onFullscreen,
  onPiP,
  onToggleSubtitles,
  subtitlesEnabled,
  enableFullscreen = true,
  enablePiP = true,
  levels = [],
  activeLevelId = 'auto',
  autoLevel = true,
  onLevelChange,
  audioTracks = [],
  activeAudioTrackId = null,
  onAudioTrackChange,
  subtitles = [],
  activeSubtitleId = null,
  onSubtitleChange,
  loop = false,
  onLoopChange,
  moreMenuItems,
  compact,
  overlay = false,
  className,
}: ControlBarProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const iconBtnClass = overlay ? iconBtnClassOverlay : iconBtnClassDefault;
  const timeClass = overlay
    ? 'min-w-[72px] shrink-0 text-[11px] tabular-nums text-white/80'
    : 'min-w-[72px] shrink-0 text-[11px] tabular-nums text-gray-500 dark:text-gray-400';

  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-1.5 px-2 py-1.5 text-gray-700 dark:text-gray-200',
        className
      )}
    >
      {/* Left: volume (matches audio player) */}
      {!compact && (
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onMutedChange={onMutedChange}
        />
      )}

      {/* Center: skip + play */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip content={t('videoPlayer.skipBack', 'Skip back 10s (J)')} placement="top">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={onSkipBack}
            className={iconBtnClass}
            aria-label={t('videoPlayer.skipBack', 'Skip back 10s')}
          >
            <PiArrowCounterClockwise className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <Tooltip
          content={isPlaying ? t('videoPlayer.pause', 'Pause') : t('videoPlayer.play', 'Play')}
          placement="top"
        >
          <button
            type="button"
            onClick={onTogglePlay}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform',
              'bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95'
            )}
            aria-label={isPlaying ? t('videoPlayer.pause', 'Pause') : t('videoPlayer.play', 'Play')}
          >
            {isPlaying ? (
              <PiPauseFill className="h-5 w-5" />
            ) : (
              <PiPlayFill className="ms-0.5 h-5 w-5" />
            )}
          </button>
        </Tooltip>

        <Tooltip content={t('videoPlayer.skipForward', 'Skip forward 10s (L)')} placement="top">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={onSkipForward}
            className={iconBtnClass}
            aria-label={t('videoPlayer.skipForward', 'Skip forward 10s')}
          >
            <PiArrowClockwise className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Time / live badge */}
      {isLive ? (
        <LiveDvrBadge
          isLive
          className={cn('text-[11px] normal-case', overlay && 'bg-white/15 text-white')}
        />
      ) : (
        <span className={timeClass}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      )}

      <div className="flex-1" />

      {/* Right: speed, loop, CC, settings, extras (matches audio cluster) */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="relative">
          <Tooltip content={t('videoPlayer.speed', 'Playback speed')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={() => {
                setSpeedOpen((p) => !p);
                setMoreOpen(false);
              }}
              className={cn(
                iconBtnClass,
                playbackRate !== 1 && (overlay ? 'text-white' : 'text-primary dark:text-primary')
              )}
              aria-label={t('videoPlayer.speed', 'Playback speed')}
            >
              <span className="text-xs font-medium">
                {playbackRate === 1 ? '1x' : `${playbackRate}x`}
              </span>
            </ActionIcon>
          </Tooltip>
          {speedOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSpeedOpen(false)} />
              <div className="absolute bottom-full end-0 z-50 mb-1.5 min-w-[110px] overflow-hidden rounded-md border border-muted bg-gray-0 py-1 shadow-md dark:bg-gray-50">
                <div className="mb-1 border-b border-muted px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {t('videoPlayer.speed', 'Speed')}
                </div>
                {PLAYBACK_SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onSpeedChange(s);
                      setSpeedOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-start text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/30',
                      s === playbackRate
                        ? 'bg-primary/5 font-semibold text-primary dark:bg-primary/10'
                        : 'text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <span>{s === 1 ? t('videoPlayer.normal', 'Normal') : `${s}x`}</span>
                    {s === playbackRate && <span className="text-[10px] text-primary">&bull;</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {onLoopChange && (
          <Tooltip content={t('videoPlayer.loop', 'Loop (R)')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={() => onLoopChange(!loop)}
              className={cn(
                iconBtnClass,
                loop && (overlay ? 'text-white' : 'text-primary dark:text-primary')
              )}
              aria-label={t('videoPlayer.loop', 'Loop')}
              aria-pressed={loop}
            >
              <PiRepeatBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {onToggleSubtitles && (
          <Tooltip content={t('videoPlayer.subtitles', 'Subtitles (V)')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={onToggleSubtitles}
              className={cn(
                iconBtnClass,
                subtitlesEnabled && (overlay ? 'text-white' : 'text-primary dark:text-primary')
              )}
              aria-label={t('videoPlayer.subtitles', 'Subtitles')}
              aria-pressed={subtitlesEnabled}
            >
              <PiClosedCaptioningBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        <SettingsMenu
          playbackRate={playbackRate}
          onSpeedChange={onSpeedChange}
          levels={levels}
          activeLevelId={activeLevelId}
          autoLevel={autoLevel}
          onLevelChange={onLevelChange ?? (() => {})}
          audioTracks={audioTracks}
          activeAudioTrackId={activeAudioTrackId}
          onAudioTrackChange={onAudioTrackChange ?? (() => {})}
          subtitles={subtitles}
          activeSubtitleId={activeSubtitleId}
          onSubtitleChange={onSubtitleChange ?? (() => {})}
          loop={loop}
          onLoopChange={onLoopChange ?? (() => {})}
          overlay={overlay}
        />

        {onScreenshot && (
          <Tooltip content={t('videoPlayer.screenshot', 'Screenshot (C)')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={onScreenshot}
              className={iconBtnClass}
              aria-label={t('videoPlayer.screenshot', 'Screenshot')}
            >
              <PiCameraBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {enablePiP && onPiP && (
          <Tooltip content={t('videoPlayer.pip', 'Picture in Picture (P)')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={onPiP}
              className={iconBtnClass}
              aria-label={t('videoPlayer.pip', 'Picture in Picture')}
            >
              <PiPictureInPictureBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {enableFullscreen && onFullscreen && (
          <Tooltip content={t('videoPlayer.fullscreen', 'Fullscreen (F)')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={onFullscreen}
              className={iconBtnClass}
              aria-label={t('videoPlayer.fullscreen', 'Fullscreen')}
            >
              <PiArrowsOutSimple className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {moreMenuItems && moreMenuItems.length > 0 && (
          <div className="relative">
            <Tooltip content={t('common.more', 'More options')} placement="top">
              <ActionIcon
                variant="text"
                size="sm"
                onClick={() => setMoreOpen(!moreOpen)}
                className={iconBtnClass}
                aria-label={t('common.more', 'More')}
              >
                <PiDotsThreeBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                <div className="absolute bottom-full end-0 z-20 mb-1 min-w-[140px] rounded-md border border-muted bg-gray-0 py-1 shadow-md dark:bg-gray-50">
                  {moreMenuItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.onClick();
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-200/30"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
