'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ListItemShell } from '../components/list-item-shell';
import { ChatInlineControls } from '../components/chat-inline-controls';
import { VideoPlayerMoreMenu } from '../components/more-menu';
import { useInlineRowRegistry } from '../store/inline-row-registry';
import { formatTime, formatFileSize, formatResolution } from '../utils/format-time';
import type { VariantProps } from '../types';

/**
 * UltraCompact — mock list item:
 * thumbnail + play overlay | title + meta | ⋮
 * preview mode: single row (sidebar, attachments); inline mode: play expands player below.
 */
export function UltraCompactVariant({
  playback,
  poster,
  thumbnailSlot,
  title,
  mimeType,
  fileSize,
  width,
  height,
  duration: durationProp,
  onExpand,
  onDownload,
  onShare,
  onRowPreview,
  rowId: rowIdProp,
  inlinePlaybackActive,
  onInlinePlaybackRequest,
  playbackMode = 'preview',
  moreMenuItems,
  className,
}: VariantProps) {
  const { t } = useTranslation();
  const autoId = useId();
  const rowId = rowIdProp ?? autoId;
  const [menuOpen, setMenuOpen] = useState(false);
  const { togglePlay, isPlaying, duration, mirrorPlayback, pause, videoRef } = playback;
  const { claim, release, activeRowId } = useInlineRowRegistry();

  const allowInline = playbackMode === 'inline' || playbackMode === 'mini';
  const inlineActive = allowInline && Boolean(inlinePlaybackActive);
  const isThisRowActive = activeRowId === rowId;

  useEffect(() => {
    if (!allowInline) return;
    if (inlineActive && isThisRowActive) {
      claim(rowId);
    }
    return () => release(rowId);
  }, [allowInline, inlineActive, isThisRowActive, rowId, claim, release]);

  useEffect(() => {
    if (!allowInline) return;
    if (activeRowId && activeRowId !== rowId && inlineActive) {
      pause();
    }
  }, [allowInline, activeRowId, rowId, inlineActive, pause]);

  const meta = [
    formatResolution(width, height),
    (duration > 0 ? duration : durationProp) ? formatTime(duration > 0 ? duration : durationProp!) : '',
    formatFileSize(fileSize),
  ]
    .filter(Boolean)
    .join(' · ');

  const openPreview = () => {
    if (onRowPreview) onRowPreview();
    else onExpand?.();
  };

  const handlePlayClick = () => {
    if (mirrorPlayback) return;
    if (!allowInline) {
      openPreview();
      return;
    }
    if (!inlineActive) {
      claim(rowId);
      onInlinePlaybackRequest?.();
      return;
    }
    togglePlay();
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <ListItemShell
        poster={poster}
        thumbnailSlot={thumbnailSlot}
        title={title || t('videoPlayer.untitled', 'Untitled video')}
        meta={meta}
        isPlaying={allowInline && inlineActive && isPlaying}
        onRowClick={openPreview}
        onPlayClick={handlePlayClick}
        disabled={Boolean(mirrorPlayback)}
        showMoreMenu={menuOpen}
        onMoreMenuToggle={() => setMenuOpen((p) => !p)}
        moreMenuPanel={
          <VideoPlayerMoreMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            placement="below"
            loop={playback.loop}
            onLoopChange={playback.setLoop}
            playbackRate={playback.playbackRate}
            onSpeedChange={playback.setPlaybackRate}
            onExpand={openPreview}
            onDownload={onDownload}
            onShare={onShare}
            moreMenuItems={moreMenuItems}
          />
        }
      />

      {inlineActive && !mirrorPlayback && playbackMode === 'inline' && (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg border border-muted bg-black/5 dark:bg-gray-200/10">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              poster={poster}
              playsInline
              className="max-h-[160px] w-full object-contain"
            />
          </div>
          <ChatInlineControls
            playback={playback}
            duration={durationProp}
            onExpand={onExpand ?? openPreview}
            onDownload={onDownload}
            onShare={onShare}
            moreMenuItems={moreMenuItems}
            showPlayButton={false}
          />
        </div>
      )}

      {inlineActive && !mirrorPlayback && playbackMode === 'mini' && (
        <div className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="sr-only" playsInline aria-hidden poster={poster} />
          <ChatInlineControls
            playback={playback}
            duration={durationProp}
            onExpand={onExpand ?? openPreview}
            onDownload={onDownload}
            onShare={onShare}
            moreMenuItems={moreMenuItems}
            showPlayButton={false}
            className="px-2 py-2"
          />
        </div>
      )}
    </div>
  );
}
