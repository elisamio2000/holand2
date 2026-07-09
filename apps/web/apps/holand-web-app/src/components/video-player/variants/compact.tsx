'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon } from 'rizzui';
import { PiDotsThreeBold, PiArrowsOutSimple } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { MiniPlayerShell } from '../components/mini-player-shell';
import { ProgressBar } from '../controls/progress-bar';
import { VolumeControl } from '../controls/volume-control';
import { SettingsMenu } from '../controls/settings-menu';
import { formatTime } from '../utils/format-time';
import type { VariantProps } from '../types';

/**
 * Compact — integrated mini player card (mock compact mini).
 * Used in map-chat and One Search collapsed cards.
 */
export function CompactVariant(props: VariantProps) {
  const { t } = useTranslation();
  const {
    playback,
    poster,
    title,
    onExpand,
    onDownload,
    onShare,
    moreMenuItems,
    className,
  } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    togglePlay,
    isPlaying,
    currentTime,
    duration,
    buffered,
    seekTo,
    volume,
    isMuted,
    setVolume,
    setMuted,
    playbackRate,
    setPlaybackRate,
    loop,
    setLoop,
    engineState,
    loadedSubtitles,
    activeSubtitleId,
    setActiveSubtitle,
    setLevel,
    setAudioTrack,
    mirrorPlayback,
  } = playback;

  const menu = [
    onExpand && {
      icon: <PiArrowsOutSimple className="h-3.5 w-3.5" />,
      label: t('videoPlayer.expand', 'Expand'),
      onClick: onExpand,
    },
    ...(moreMenuItems ?? []),
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;

  return (
    <MiniPlayerShell
      className={className}
      poster={poster}
      title={title || t('videoPlayer.untitled', 'Untitled video')}
      timeLabel={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      isPlaying={isPlaying}
      onTogglePlay={mirrorPlayback ? undefined : togglePlay}
      disabled={Boolean(mirrorPlayback)}
      progress={
        !mirrorPlayback ? (
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            onSeek={seekTo}
            className="h-1"
          />
        ) : undefined
      }
      volume={
        !mirrorPlayback ? (
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={setVolume}
            onMutedChange={setMuted}
            compact
          />
        ) : undefined
      }
      settings={
        !mirrorPlayback ? (
          <SettingsMenu
            playbackRate={playbackRate}
            onSpeedChange={setPlaybackRate}
            levels={engineState.levels}
            activeLevelId={engineState.activeLevelId}
            autoLevel={engineState.autoLevel}
            onLevelChange={setLevel}
            audioTracks={engineState.audioTracks}
            activeAudioTrackId={engineState.activeAudioTrackId}
            onAudioTrackChange={setAudioTrack}
            subtitles={loadedSubtitles}
            activeSubtitleId={activeSubtitleId}
            onSubtitleChange={setActiveSubtitle}
            loop={loop}
            onLoopChange={setLoop}
          />
        ) : undefined
      }
      expand={
        onExpand && !mirrorPlayback ? (
          <Tooltip content={t('videoPlayer.expand', 'Expand')} placement="top">
            <ActionIcon variant="text" size="sm" onClick={onExpand} aria-label={t('videoPlayer.expand', 'Expand')}>
              <PiArrowsOutSimple className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        ) : undefined
      }
      menu={
        menu.length > 0 && !mirrorPlayback ? (
          <div className="relative">
            <ActionIcon variant="text" size="sm" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('common.more', 'More')}>
              <PiDotsThreeBold className="h-4 w-4" />
            </ActionIcon>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute end-0 top-full z-20 mt-1 min-w-[120px] rounded-md border border-muted bg-gray-0 py-1 shadow-md dark:bg-gray-50">
                  {menu.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.onClick();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : undefined
      }
      videoStage={
        <div className="overflow-hidden rounded-lg border border-muted bg-black/5 dark:bg-gray-200/10">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={playback.videoRef}
            poster={poster}
            playsInline
            className="max-h-[160px] w-full object-contain"
          />
        </div>
      }
    />
  );
}
