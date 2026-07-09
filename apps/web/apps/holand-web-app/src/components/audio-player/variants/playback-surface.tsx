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
  PiSpeakerSlashFill,
  PiSpeakerLowFill,
  PiArrowCounterClockwise,
  PiArrowClockwise,
  PiRepeatBold,
  PiSelectionAllBold,
  PiScissorsBold,
  PiTrashBold,
  PiDownloadBold,
  PiMusicNoteFill,
  PiSkipBackFill,
  PiSkipForwardFill,
  PiMagnifyingGlassPlusBold,
  PiMagnifyingGlassMinusBold,
  PiDotsThreeBold,
  PiShareNetworkBold,
  PiPlusBold,
  PiArrowsOutSimple,
  PiXBold,
  PiWarningCircle,
} from 'react-icons/pi';
import { PLAYBACK_SPEEDS } from '../constants';
import { formatTime, formatFileSize } from '../utils/format-time';
import { AudioPlayerMoreMenu } from '../components/more-menu';
import { FloatingPopoverPortal } from '../components/floating-popover-portal';
import type { VariantProps } from '../types';

export function PlaybackSurface(props: VariantProps) {
  const {
    playback,
    title,
    mimeType,
    fileSize,
    className,
    onExpand,
    onClose,
    onDownload,
    onShare,
    onDelete,
    onTrim,
    onAddMarker,
    moreMenuItems,
  } = props;
  const {
    containerRef,
    fallbackAudioEl,
    setIsFocused,
    showHeader,
    isExpanded,
    isAdvanced,
    effectiveShowWaveform,
    variantUsesMainWaveSurfer,
    showFileInfo,
    showTimeline,
    waveformHeight,
    isReady,
    loadError,
    handleRetryLoad,
    zoomLevel,
    isRegionMode,
    waveformRef,
    timelineRef,
    showWaveform,
    showZoom,
    showSkipEnds,
    showShortcutsHint,
    enableRegions,
    activeRegion,
    downloadRegion,
    removeActiveRegion,
    showVolumePopup,
    setShowVolumePopup,
    showVolume,
    isMuted,
    volume,
    handleVolumeChange,
    showSkipButtons,
    togglePlay,
    skipBack,
    skipForward,
    isPlaying,
    showSpeedControl,
    showSpeedMenu,
    setShowSpeedMenu,
    setShowMoreMenu,
    showMoreMenu,
    playbackRate,
    handleSpeedChange,
    isLooping,
    toggleLoop,
    toggleRegionMode,
    userRegions,
    clearRegions,
    zoomIn,
    zoomOut,
    skipToStart,
    skipToEnd,
    seekToSeconds,
    currentTime,
    duration,
    wsRef,
    getActiveAudio,
  } = playback;
  const { t } = useTranslation();
  const speedMenuAnchorRef = useRef<HTMLDivElement>(null);
  const moreMenuAnchorRef = useRef<HTMLDivElement>(null);

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    seekToSeconds(next);
  };

  const ext = mimeType?.split('/').pop()?.toUpperCase() || '';
  const VolumeIcon = isMuted
    ? PiSpeakerSlashFill
    : volume < 0.5
      ? PiSpeakerLowFill
      : PiSpeakerHighFill;
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn('w-full', className)}
    >
      {fallbackAudioEl}

      {/* Card header (for full/advanced variants with showHeader) */}
      {showHeader && !isExpanded && (
        <div className="mb-3 flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                {title || 'Audio'}
              </span>
              {ext && (
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500 dark:bg-gray-200/20 dark:text-gray-400">
                  {ext}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              {mimeType && <span className="capitalize">{mimeType.split('/')[0]}</span>}
              {fileSize && <span> · {formatFileSize(fileSize)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {onDownload && (
              <Tooltip content={t('common.download', 'Download')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={onDownload}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  <PiDownloadBold className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
            )}
            {onExpand && (
              <Tooltip content={t('common.expand', 'Expand')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={onExpand}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  <PiArrowsOutSimple className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
            )}
            {onClose && (
              <Tooltip content={t('common.close', 'Close')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  <PiXBold className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* Centered file info (for expanded or when showFileInfo + no header) */}
      {showFileInfo && !showHeader && (
        <div className="mb-5 flex w-full flex-col items-center text-center">
          <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <PiMusicNoteFill className="h-6 w-6 text-primary" />
          </div>
          {title && (
            <h5 className="w-full max-w-full px-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h5>
          )}
          <div className="mt-0.5 flex w-full justify-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
            {mimeType && <span className="uppercase">{mimeType.split('/').pop()}</span>}
            {fileSize && <span>&middot; {formatFileSize(fileSize)}</span>}
          </div>
        </div>
      )}

      {/* Waveform area — always mounted for full/advanced/compact (hidden when toggled off) */}
      {variantUsesMainWaveSurfer && (
        <div className={cn('mb-1 px-1', !effectiveShowWaveform && 'hidden')}>
          {!isReady && !loadError && effectiveShowWaveform && (
            <div
              className="flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-200/10"
              style={{ height: waveformHeight }}
            >
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t('common.loading', 'Loading...')}
              </div>
            </div>
          )}

          {loadError && effectiveShowWaveform && (
            <div
              className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
              style={{ minHeight: waveformHeight }}
            >
              <PiWarningCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t('audioPlayer.loadError', 'Failed to load audio. Please try again.')}</span>
              <button
                type="button"
                onClick={handleRetryLoad}
                className="shrink-0 text-xs font-medium underline hover:no-underline"
              >
                    {t('audioPlayer.retry', 'Retry')}
              </button>
            </div>
          )}

          <div
            className={cn(
              'w-full',
              zoomLevel > 50 ? 'overflow-x-auto' : 'overflow-hidden'
            )}
          >
            <div
              ref={waveformRef}
              className={cn(
                'transition-opacity',
                isReady ? 'opacity-100' : 'opacity-0',
                loadError && effectiveShowWaveform && 'hidden',
                isRegionMode && 'cursor-crosshair'
              )}
              style={{ minWidth: zoomLevel > 50 ? `${zoomLevel * 2}%` : '100%' }}
            />
          </div>

          {showTimeline && !loadError && (
            <div ref={timelineRef} className="mt-0.5 w-full" />
          )}
        </div>
      )}

      {/* Seek bar when waveform is hidden — HTML or WS owner via seekToSeconds */}
      {!effectiveShowWaveform && (variantUsesMainWaveSurfer || isExpanded) && (
        <div className="mb-3 w-full">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeekInput}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary dark:bg-gray-200/30"
          />
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Time indicators (below waveform, when waveform is shown) */}
      {effectiveShowWaveform && (
        <div className="mb-3 flex justify-between px-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}

      {/* Active region info bar */}
      {activeRegion && (
        <div className="mx-1 mb-3 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 dark:bg-primary/10">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: activeRegion.color }}
          />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('audioPlayer.region', 'Region')}:
          </span>
          <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
            {formatTime(activeRegion.start)} — {formatTime(activeRegion.end)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            ({formatTime(activeRegion.end - activeRegion.start)})
          </span>
          <div className="flex-1" />
          <Tooltip content={t('audioPlayer.downloadRegion', 'Download region')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={downloadRegion}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <PiDownloadBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('audioPlayer.deleteRegion', 'Delete region')} placement="top">
            <ActionIcon
              variant="text"
              size="sm"
              onClick={removeActiveRegion}
              className="text-red-500 hover:text-red-600 dark:text-red-400"
            >
              <PiTrashBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </Tooltip>
        </div>
      )}

      {/* ── Controls ── */}
      {/* Center playback cluster is absolutely centered so left/right wings (volume, speed) never shift it */}
      <div className="relative flex min-h-11 min-w-0 items-center px-1">

        {/* Left wing: volume — pointer-events-none on shell so flex-1 dead space does not block center play */}
        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-start gap-1 pointer-events-none">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={() => setShowVolumePopup((p) => !p)}
            className={cn(
              'pointer-events-auto shrink-0 transition-colors',
              showVolumePopup
                ? 'text-primary dark:text-primary'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            <VolumeIcon className="h-4 w-4" />
          </ActionIcon>

          <div
            className={cn(
              'pointer-events-auto flex items-center gap-1.5 overflow-hidden transition-all duration-200',
              showVolumePopup && showVolume
                ? 'max-w-[110px] opacity-100'
                : 'max-w-0 opacity-0'
            )}
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary dark:bg-gray-200/30"
            />
            <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>

        {/* Center: playback — z-20 above wings; full button hit target */}
        <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1.5">
            {showSkipButtons && (
              <Tooltip content={t('audioPlayer.skipBack', 'Skip back 10s')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={skipBack} disabled={!isReady}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <PiArrowCounterClockwise className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
            )}

            <button
              onClick={togglePlay}
              disabled={!isReady}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform',
                'bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95',
                'disabled:opacity-50 disabled:hover:scale-100'
              )}
            >
              {isPlaying ? <PiPauseFill className="h-5 w-5" /> : <PiPlayFill className="h-5 w-5" />}
            </button>

            {showSkipButtons && (
              <Tooltip content={t('audioPlayer.skipForward', 'Skip forward 10s')} placement="top">
                <ActionIcon variant="text" size="sm" onClick={skipForward} disabled={!isReady}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <PiArrowClockwise className="h-4 w-4" />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Right wing: speed + more */}
        <div className="relative z-10 flex flex-1 items-center justify-end gap-1 pointer-events-none">
          {/* Speed */}
          {showSpeedControl && (
            <div ref={speedMenuAnchorRef} className="relative pointer-events-auto">
              <Tooltip content="Playback speed" placement="top">
                <ActionIcon variant="text" size="sm"
                  onClick={() => { setShowSpeedMenu((p) => !p); setShowMoreMenu(false); }}
                  className={cn('text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                    playbackRate !== 1 && 'text-primary dark:text-primary')}>
                  <span className="text-xs font-medium">{playbackRate === 1 ? '1x' : `${playbackRate}x`}</span>
                </ActionIcon>
              </Tooltip>
              <FloatingPopoverPortal
                open={showSpeedMenu}
                onClose={() => setShowSpeedMenu(false)}
                anchorRef={speedMenuAnchorRef}
                width={110}
              >
                <div className="mb-1 border-b border-muted px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Speed
                </div>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button key={speed} onClick={() => handleSpeedChange(speed)}
                    className={cn('flex w-full items-center justify-between px-3 py-1.5 text-start text-xs transition-colors',
                      'hover:bg-gray-100 dark:hover:bg-gray-200/30',
                      speed === playbackRate ? 'bg-primary/5 font-semibold text-primary dark:bg-primary/10' : 'text-gray-600 dark:text-gray-400')}>
                    <span>{speed === 1 ? 'Normal' : `${speed}x`}</span>
                    {speed === playbackRate && <span className="text-[10px] text-primary">&bull;</span>}
                  </button>
                ))}
              </FloatingPopoverPortal>
            </div>
          )}

          {/* More (⋯) — Loop, Region, Zoom */}
          <div ref={moreMenuAnchorRef} className="relative pointer-events-auto">
            <Tooltip content="More options" placement="top">
              <ActionIcon variant="text" size="sm"
                onClick={() => { setShowMoreMenu((p) => !p); setShowSpeedMenu(false); }}
                className={cn('text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                  (isLooping || isRegionMode) && 'text-primary dark:text-primary')}>
                <PiDotsThreeBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            <AudioPlayerMoreMenu
              playback={playback}
              open={showMoreMenu}
              anchorRef={moreMenuAnchorRef}
              onDownload={onDownload}
              onShare={onShare}
              onDelete={onDelete}
              moreMenuItems={moreMenuItems}
            />
          </div>
        </div>
      </div>

      {/* Action toolbar (advanced variant) */}
      {isAdvanced && (
        <div className="mt-4 flex items-center justify-center gap-1 border-t border-muted pt-3">
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-200"
            >
              <PiDownloadBold className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t('common.download', 'Download')}</span>
            </button>
          )}
          {onTrim && (
            <button
              onClick={onTrim}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors',
                isRegionMode
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-200'
              )}
            >
              <PiScissorsBold className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t('audioPlayer.trim', 'Trim')}</span>
            </button>
          )}
          {onAddMarker && (
            <button
              onClick={onAddMarker}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-200"
            >
              <PiPlusBold className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t('audioPlayer.addMarker', 'Add Marker')}</span>
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-200"
            >
              <PiShareNetworkBold className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t('common.share', 'Share')}</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <PiTrashBold className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t('common.delete', 'Delete')}</span>
            </button>
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {showShortcutsHint && (
        <p className="mt-2.5 text-center text-[10px] text-gray-300 dark:text-gray-600">
          Space: play/pause &middot; J/L: skip 10s &middot; &uarr;&darr;: volume &middot; M: mute
        </p>
      )}
    </div>
  );
}