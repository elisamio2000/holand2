'use client';

import { useEffect, useState } from 'react';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import {
  PiDownloadBold,
  PiShareNetworkBold,
} from 'react-icons/pi';
import { ExpandedVariant } from './expanded';
import { ChaptersPanel } from '../panels/chapters-panel';
import { SubtitlesPanel } from '../panels/subtitles-panel';
import { BookmarksPanel } from '../panels/bookmarks-panel';
import { FilmstripTimeline, type FilmstripSpriteMeta } from '../timeline/filmstrip-timeline';
import { ChapterTimeline } from '../timeline/chapter-timeline';
import { QuickSettingsBar } from '../controls/quick-settings-bar';
import { loadArtifactFilmstrip } from '../utils/load-artifact-metadata';
import { useVideoFullscreen } from '../hooks/use-video-fullscreen';
import { vpTokens } from '../helpers/variant-visual-tokens';
import type { VariantProps } from '../types';

export function AdvancedVariant(props: VariantProps) {
  const { t } = useTranslation();
  const {
    playback,
    artifactId,
    onDownload,
    onShare,
    onBookmark,
    onAnnotate,
    onScreenshot,
    bookmarks = [],
    showFilmstrip,
    fullscreenLayout = 'pro',
    className,
    moreMenuItems,
  } = props;

  const [spriteMeta, setSpriteMeta] = useState<FilmstripSpriteMeta | null>(null);
  const { isFullscreen } = useVideoFullscreen(playback.containerRef);

  useEffect(() => {
    if (!showFilmstrip || !artifactId) {
      setSpriteMeta(null);
      return;
    }
    let cancelled = false;
    void loadArtifactFilmstrip(artifactId).then((meta) => {
      if (!cancelled) setSpriteMeta(meta);
    });
    return () => {
      cancelled = true;
    };
  }, [artifactId, showFilmstrip]);

  const [activeTab, setActiveTab] = useState<'chapters' | 'subtitles' | 'bookmarks'>('chapters');
  const hasChapters = playback.loadedChapters?.length > 0;
  const hasSubtitles = playback.loadedSubtitles?.length > 0;

  const tabs = [
    { id: 'chapters' as const, label: t('videoPlayer.chapters', 'Chapters'), visible: hasChapters },
    { id: 'subtitles' as const, label: t('videoPlayer.subtitles', 'Subtitles'), visible: hasSubtitles },
    { id: 'bookmarks' as const, label: t('videoPlayer.bookmarks', 'Bookmarks'), visible: true },
  ].filter((tab) => tab.visible);

  const proLayout = isFullscreen && fullscreenLayout === 'pro';

  return (
    <div className={cn('flex flex-col', proLayout && 'h-full bg-black', className)}>
      <div className={cn('flex flex-1 gap-3', proLayout && 'min-h-0')}>
        <div className="flex min-w-0 flex-1 flex-col">
          <ExpandedVariant
            src={props.src}
            playback={playback}
            poster={props.poster}
            title={props.title}
            mimeType={props.mimeType}
            fileSize={props.fileSize}
            width={props.width}
            height={props.height}
            subtitles={props.subtitles}
            enableFullscreen={props.enableFullscreen}
            enablePiP={props.enablePiP}
            chromeMode="overlay"
            fullscreenLayout={fullscreenLayout}
            onScreenshot={props.onScreenshot}
            onDownload={props.onDownload}
            moreMenuItems={props.moreMenuItems}
            spriteMeta={spriteMeta}
          />
          {showFilmstrip && (
            <FilmstripTimeline
              videoRef={playback.videoRef}
              duration={playback.duration}
              currentTime={playback.currentTime}
              onSeek={playback.seekTo}
              spriteMeta={spriteMeta}
              className="mt-2"
            />
          )}
          {hasChapters && (
            <ChapterTimeline
              chapters={playback.loadedChapters}
              duration={playback.duration}
              currentTime={playback.currentTime}
              onSeek={playback.seekTo}
              className="mt-1 border-t border-muted"
            />
          )}
        </div>

        {tabs.length > 0 && (
          <div className={cn(vpTokens.sidebarPanel, proLayout && 'border-white/10 bg-black/80 text-white')}>
            <div className="flex border-b border-muted">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-64 overflow-y-auto py-2">
              {activeTab === 'chapters' && (
                <ChaptersPanel
                  chapters={playback.loadedChapters}
                  currentTime={playback.currentTime}
                  onSeek={playback.seekTo}
                />
              )}
              {activeTab === 'subtitles' && (
                <SubtitlesPanel
                  tracks={playback.loadedSubtitles}
                  activeId={playback.activeSubtitleId}
                  onSelect={playback.setActiveSubtitle}
                />
              )}
              {activeTab === 'bookmarks' && (
                <BookmarksPanel
                  bookmarks={bookmarks}
                  currentTime={playback.currentTime}
                  onSeek={playback.seekTo}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <QuickSettingsBar
        className="mt-3"
        dark={proLayout}
        playbackRate={playback.playbackRate}
        onSpeedChange={playback.setPlaybackRate}
        levels={playback.engineState.levels}
        activeLevelId={playback.engineState.activeLevelId}
        autoLevel={playback.engineState.autoLevel}
        onLevelChange={playback.setLevel}
        audioTracks={playback.engineState.audioTracks}
        activeAudioTrackId={playback.engineState.activeAudioTrackId}
        onAudioTrackChange={playback.setAudioTrack}
        subtitles={playback.loadedSubtitles}
        activeSubtitleId={playback.activeSubtitleId}
        onSubtitleChange={playback.setActiveSubtitle}
        loop={playback.loop}
        onLoopChange={playback.setLoop}
        onScreenshot={
          onScreenshot
            ? () => {
                void playback.takeScreenshot().then(() => onScreenshot());
              }
            : undefined
        }
        onBookmark={onBookmark ? () => onBookmark(playback.currentTime) : undefined}
        onAnnotate={onAnnotate}
        moreMenuItems={[
          ...(onDownload
            ? [
                {
                  icon: <PiDownloadBold className="h-3.5 w-3.5" />,
                  label: t('videoPlayer.download', 'Download'),
                  onClick: onDownload,
                },
              ]
            : []),
          ...(onShare
            ? [
                {
                  icon: <PiShareNetworkBold className="h-3.5 w-3.5" />,
                  label: t('videoPlayer.share', 'Share'),
                  onClick: onShare,
                },
              ]
            : []),
          ...(moreMenuItems ?? []),
        ]}
      />
    </div>
  );
}
