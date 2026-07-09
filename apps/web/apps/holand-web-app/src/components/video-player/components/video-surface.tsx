'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { PiPlayFill, PiArrowCounterClockwise } from 'react-icons/pi';
import type {
  VideoChromeMode,
  VideoFullscreenLayout,
  VideoSubtitleTrack,
  UseVideoPlaybackReturn,
} from '../types';
import type { FilmstripSpriteMeta } from '../timeline/filmstrip-timeline';
import { VideoErrorState } from './video-error-state';
import { CinemaHeader } from './cinema-header';
import { ProgressBar } from '../controls/progress-bar';
import { ControlBar } from '../controls/control-bar';
import { OverlayControlBar } from '../controls/overlay-control-bar';
import { useVideoFullscreen } from '../hooks/use-video-fullscreen';
import { useControlAutoHide } from '../hooks/use-control-auto-hide';
import { useScrubPreview } from '../hooks/use-scrub-preview';
import { syncSubtitleTracks } from '../utils/sync-subtitle-tracks';
import { formatFileSize, formatResolution } from '../utils/format-time';
import { vpTokens } from '../helpers/variant-visual-tokens';

export interface VariantShellProps {
  playback: UseVideoPlaybackReturn;
  poster?: string;
  title?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  subtitles?: VideoSubtitleTrack[];
  enableFullscreen?: boolean;
  enablePiP?: boolean;
  chromeMode?: VideoChromeMode;
  fullscreenLayout?: VideoFullscreenLayout;
  onScreenshot?: () => void;
  onDownload?: () => void;
  moreMenuItems?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
  showHeader?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  videoClassName?: string;
  minVideoHeight?: string;
  maxVideoHeight?: string;
  showShortcutsHint?: boolean;
  /** Filmstrip sprite for scrub thumbnail preview (advanced mode). */
  spriteMeta?: FilmstripSpriteMeta | null;
}

export function VideoSurface({
  playback,
  poster,
  title,
  mimeType,
  fileSize,
  width,
  height,
  subtitles = [],
  enableFullscreen = true,
  enablePiP = true,
  chromeMode = 'barBelow',
  fullscreenLayout = 'standard',
  onScreenshot,
  onDownload,
  moreMenuItems,
  showHeader,
  onExpand,
  onClose,
  children,
  className,
  videoClassName,
  minVideoHeight = '40vh',
  maxVideoHeight = '65vh',
  showShortcutsHint = true,
  spriteMeta = null,
}: VariantShellProps) {
  const { t } = useTranslation();
  const {
    videoRef,
    containerRef,
    setIsFocused,
    status,
    detectedFormat,
    retry,
    mirrorPlayback,
    usesExternalVideo,
    isPlaying,
    currentTime,
    duration,
    buffered,
    togglePlay,
    play,
    seekTo,
    setVolume,
    setMuted,
    setPlaybackRate,
    volume,
    isMuted,
    playbackRate,
    loop,
    setLoop,
    requestPiP,
    loadedChapters,
    loadedSubtitles,
    activeSubtitleId,
    setActiveSubtitle,
    setLevel,
    setAudioTrack,
    engineState,
  } = playback;

  const [ended, setEnded] = useState(false);
  const lastTapRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen, exitFullscreen } = useVideoFullscreen(containerRef);

  const effectiveChrome =
    isFullscreen && (fullscreenLayout === 'cinema' || fullscreenLayout === 'pro')
      ? 'overlay'
      : chromeMode;

  const { controlsVisible, revealControls } = useControlAutoHide({
    isPlaying,
    enabled: effectiveChrome === 'overlay' && !mirrorPlayback,
  });

  const { previewStyle, onHoverRatio } = useScrubPreview({
    duration,
    spriteMeta: spriteMeta ?? undefined,
  });

  const showError = status === 'error' || status === 'unsupported';
  const isBuffering = status === 'loading' && !showError;
  const resolution = formatResolution(width, height);
  const showCinemaHeader =
    isFullscreen && (fullscreenLayout === 'cinema' || fullscreenLayout === 'pro');
  /** Overlay on a watch/modal stage — single black frame, no nested card border. */
  const isOverlayEmbedded = effectiveChrome === 'overlay' && !isFullscreen;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mirrorPlayback) return;
    const onEnded = () => setEnded(true);
    const onPlaying = () => setEnded(false);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlaying);
    return () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlaying);
    };
  }, [videoRef, mirrorPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mirrorPlayback) return;
    video.loop = loop;
  }, [loop, videoRef, mirrorPlayback]);

  const handleStageClick = useCallback(() => {
    if (mirrorPlayback) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) return;
    lastTapRef.current = now;
    revealControls();
    togglePlay();
  }, [mirrorPlayback, revealControls, togglePlay]);

  const handleStageDoubleClick = useCallback(() => {
    if (mirrorPlayback || !enableFullscreen) return;
    toggleFullscreen();
  }, [mirrorPlayback, enableFullscreen, toggleFullscreen]);

  useLayoutEffect(() => {
    if (!usesExternalVideo || mirrorPlayback || showError) return;
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage) return;

    if (video.parentElement !== stage) {
      stage.appendChild(video);
    }
    video.playsInline = true;
    video.className = cn(
      'cursor-pointer',
      isFullscreen
        ? 'h-full max-h-full w-full object-contain'
        : isOverlayEmbedded
          ? 'h-full w-full object-contain'
          : 'max-w-full',
      videoClassName
    );
    video.style.outline = 'none';
    video.style.maxHeight = isFullscreen || isOverlayEmbedded ? '' : maxVideoHeight;
    video.onclick = handleStageClick;
    video.ondblclick = handleStageDoubleClick;

    if (loadedSubtitles.length > 0) {
      void syncSubtitleTracks(video, loadedSubtitles, activeSubtitleId);
    }

    return () => {
      video.onclick = null;
      video.ondblclick = null;
    };
  }, [
    usesExternalVideo,
    mirrorPlayback,
    showError,
    videoRef,
    isFullscreen,
    isOverlayEmbedded,
    videoClassName,
    maxVideoHeight,
    handleStageClick,
    handleStageDoubleClick,
    loadedSubtitles,
    activeSubtitleId,
  ]);

  const handleReplay = () => {
    setEnded(false);
    seekTo(0);
    play();
  };

  const showCenterPlay =
    !mirrorPlayback && !isPlaying && !isBuffering && !ended && status !== 'idle';

  const controlBarCommon = {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isLive: engineState.isLive,
    onTogglePlay: togglePlay,
    onSkipBack: () => seekTo(Math.max(0, currentTime - 10)),
    onSkipForward: () => seekTo(Math.min(duration, currentTime + 10)),
    onVolumeChange: setVolume,
    onMutedChange: setMuted,
    onSpeedChange: setPlaybackRate,
    onScreenshot,
    onFullscreen: enableFullscreen ? toggleFullscreen : undefined,
    onPiP: enablePiP ? requestPiP : undefined,
    onToggleSubtitles:
      subtitles.length > 0 || loadedSubtitles.length > 0
        ? () => {
            const tracks = loadedSubtitles.length > 0 ? loadedSubtitles : subtitles;
            setActiveSubtitle(activeSubtitleId ? null : tracks[0]?.id ?? null);
          }
        : undefined,
    subtitlesEnabled: Boolean(activeSubtitleId),
    enableFullscreen,
    enablePiP,
    levels: engineState.levels,
    activeLevelId: engineState.activeLevelId,
    autoLevel: engineState.autoLevel,
    onLevelChange: setLevel,
    audioTracks: engineState.audioTracks,
    activeAudioTrackId: engineState.activeAudioTrackId,
    onAudioTrackChange: setAudioTrack,
    subtitles,
    activeSubtitleId,
    onSubtitleChange: setActiveSubtitle,
    loop,
    onLoopChange: setLoop,
    moreMenuItems,
  };

  const progressEl = (
    <ProgressBar
      currentTime={currentTime}
      duration={duration}
      buffered={buffered}
      chapters={loadedChapters}
      onSeek={seekTo}
      disabled={engineState.isLive}
      scrubPreviewStyle={previewStyle}
      onHoverRatioChange={spriteMeta ? onHoverRatio : undefined}
      className={effectiveChrome === 'overlay' ? 'h-1 bg-white/25 [&_.bg-primary]:bg-primary' : undefined}
    />
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label={title ? `${title} — ${t('videoPlayer.player', 'Video player')}` : t('videoPlayer.player', 'Video player')}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        'flex flex-col overflow-hidden',
        isOverlayEmbedded
          ? 'bg-black'
          : 'rounded-xl border border-muted bg-gray-0 dark:bg-gray-50',
        isFullscreen && 'h-full w-full rounded-none border-0 bg-black',
        className
      )}
    >
      {showHeader && title && !isFullscreen && (
        <div className="flex items-center gap-2 border-b border-muted px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
            {title}
          </span>
          {mimeType && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-200/30">
              {mimeType.split('/')[1]}
            </span>
          )}
          {onExpand && (
            <button type="button" onClick={onExpand} className="text-xs text-primary">
              {t('videoPlayer.expand', 'Expand')}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="text-xs text-gray-400" aria-label={t('common.close', 'Close')}>
              ×
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          'group relative flex min-h-0 items-center justify-center overflow-hidden',
          isOverlayEmbedded || isFullscreen ? 'bg-black' : 'bg-black/5 dark:bg-gray-200/10',
          isFullscreen && 'min-h-0 flex-1'
        )}
        style={isFullscreen ? undefined : { minHeight: minVideoHeight }}
        onMouseMove={effectiveChrome === 'overlay' ? revealControls : undefined}
        onTouchStart={effectiveChrome === 'overlay' ? revealControls : undefined}
      >
        {showCinemaHeader && (
          <CinemaHeader
            title={title}
            mimeType={mimeType}
            fileSize={fileSize != null ? formatFileSize(fileSize) : undefined}
            resolution={resolution || undefined}
            onBack={exitFullscreen}
          />
        )}

        {showError ? (
          <VideoErrorState
            status={status}
            format={detectedFormat}
            onRetry={retry}
            onDownload={onDownload}
            className="m-4 w-full max-w-md border-0 bg-transparent"
          />
        ) : (
          <>
            {usesExternalVideo ? (
              <div ref={stageRef} className={cn('h-full w-full', isFullscreen && 'min-h-0 flex-1')} />
            ) : (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  poster={poster}
                  playsInline
                  onClick={handleStageClick}
                  onDoubleClick={handleStageDoubleClick}
                  className={cn(
                    'cursor-pointer',
                    isFullscreen ? 'h-full max-h-full w-full object-contain' : 'max-w-full',
                    effectiveChrome === 'overlay' && 'w-full',
                    videoClassName
                  )}
                  style={
                    isFullscreen
                      ? { outline: 'none' }
                      : { maxHeight: maxVideoHeight, outline: 'none' }
                  }
                >
                  {subtitles.map((track) =>
                    track.src ? (
                      <track
                        key={track.id}
                        kind={track.kind ?? 'subtitles'}
                        src={track.src}
                        srcLang={track.language}
                        label={track.label}
                        default={track.id === activeSubtitleId}
                      />
                    ) : null
                  )}
                  {t('videoPlayer.notSupported', 'Video not supported')}
                </video>
              </>
            )}

            {isBuffering && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-300 border-t-primary dark:border-gray-500 dark:border-t-primary" />
              </div>
            )}

            {showCenterPlay && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20"
                aria-label={t('videoPlayer.play', 'Play')}
              >
                <span className={cn(vpTokens.playFab, vpTokens.playFabLg, 'bg-primary/90 text-primary-foreground shadow-lg')}>
                  <PiPlayFill className="h-8 w-8" />
                </span>
              </button>
            )}

            {ended && !mirrorPlayback && (
              <button
                type="button"
                onClick={handleReplay}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white transition-colors hover:bg-black/50"
                aria-label={t('videoPlayer.replay', 'Replay')}
              >
                <span className={cn(vpTokens.playFab, vpTokens.playFabLg, 'bg-primary/90 text-primary-foreground shadow-lg')}>
                  <PiArrowCounterClockwise className="h-7 w-7" />
                </span>
                <span className="text-sm font-medium">{t('videoPlayer.replay', 'Replay')}</span>
              </button>
            )}

            {effectiveChrome === 'overlay' && !mirrorPlayback && !showError && (
              <div
                className={cn(vpTokens.stageControls, !controlsVisible && 'opacity-0')}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 px-1">{progressEl}</div>
                <OverlayControlBar {...controlBarCommon} visible={controlsVisible} />
              </div>
            )}
          </>
        )}
      </div>

      {effectiveChrome === 'barBelow' && !showError && !mirrorPlayback && (
        <div className="border-t border-muted bg-gray-0 dark:bg-gray-50">
          <div className="px-3 pt-2">{progressEl}</div>
          <ControlBar {...controlBarCommon} />
        </div>
      )}

      {children}

      {showShortcutsHint && effectiveChrome === 'barBelow' && !showError && !mirrorPlayback && (
        <p className="border-t border-muted px-3 py-1.5 text-center text-[10px] text-gray-300 dark:text-gray-600">
          {t(
            'videoPlayer.shortcutsHint',
            'Space: play/pause · J/L or ←/→: skip 10s · ↑/↓: volume · M: mute · R: loop · F: fullscreen · P: PiP · C: screenshot · V: captions'
          )}
        </p>
      )}
    </div>
  );
}
