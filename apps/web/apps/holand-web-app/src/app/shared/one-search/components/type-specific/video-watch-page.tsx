'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import VideoPlayer, { type VideoPlayerControls } from '@/components/video-player';
import {
  MediaElementHost,
  MediaPreviewPlaceholder,
  MpsUltraCompactVideo,
  mediaSessionController,
  useMediaPreview,
} from '@/components/media-playback';
import { useStoragePlaybackUrl } from '@/hooks/use-storage-playback-url';
import { useFilePreview } from '@/hooks/use-file-preview';
import { storageService } from '@/services/storage.service';
import { formatRelativeDate, formatFileSize } from '../../utils/format-date';
import { SearchHitThumbnail } from '../search-hit-thumbnail';
import { artifactIdFromHit, downloadStorageArtifact } from '@/utils/storage-artifact-media';
import toast from 'react-hot-toast';
import {
  PiDownloadBold,
  PiShareNetworkBold,
  PiBookmarkBold,
  PiPlayBold,
  PiArrowRightBold,
  PiFileTextBold,
  PiArrowsOutBold,
} from 'react-icons/pi';
import { Button } from 'rizzui';
import { TranscriptPanel } from '../transcript-panel';
import { MediaMatchBadge } from '../media-match-badge';
import { hitMatchKind, hitMediaMeta } from '../../utils/media-hit-meta';
import { getPlaybackStrategy } from '@/utils/playback-strategy';

export interface VideoWatchPageProps {
  video: OneSearchHit;
  allVideos: OneSearchHit[];
  searchQuery?: string;
  onVideoSelect: (video: OneSearchHit) => void;
  onBack: () => void;
  className?: string;
}

export function VideoWatchPage({
  video,
  allVideos,
  searchQuery = '',
  onVideoSelect,
  onBack,
  className,
}: VideoWatchPageProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const [currentPage, setCurrentPage] = useState(1);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [activeRelatedRowId, setActiveRelatedRowId] = useState<string | null>(null);
  const controlsRef = useRef<VideoPlayerControls | null>(null);
  const itemsPerPage = 12;

  const videoUrl = String(video.meta?.url || video.href || '');
  const artifactId = artifactIdFromHit(video.meta);
  const duration = Number(video.meta?.duration || 0);

  const fallbackPlaybackUrl = artifactId
    ? storageService.getDownloadUrl(artifactId, 'inline')
    : videoUrl;

  const mimeType = String(video.meta?.mime || 'video/mp4');

  const {
    src: playbackSrc,
    loading: playbackLoading,
    error: playbackError,
    retry: retryPlayback,
  } = useStoragePlaybackUrl(artifactId, fallbackPlaybackUrl, {
    strategy: getPlaybackStrategy(mimeType, video.title, Number(video.meta?.size_bytes || 0) || undefined),
  });

  const mediaMeta = hitMediaMeta(video);
  const matchKind = hitMatchKind(video);
  const size = Number(video.meta?.size_bytes || 0);
  const width = Number(video.meta?.width || 0);
  const height = Number(video.meta?.height || 0);

  const gatewaySrc = artifactId
    ? storageService.getDownloadUrl(artifactId, 'inline')
    : videoUrl;

  const videoMedia = useMediaPreview({
    enabled: Boolean(playbackSrc) && !playbackLoading,
    kind: 'video',
    src: gatewaySrc,
    artifactId: artifactId ?? undefined,
    mimeType,
    fileSize: size > 0 ? size : undefined,
    title: video.title,
    blobUrl: playbackSrc ?? null,
    sessionKey: video.id,
  });

  const videoHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoMedia.isModal || !videoMedia.sessionId) return;
    const host = videoHostRef.current;
    const el = videoMedia.session?.elementRef?.current;
    if (!host || !el) return;
    if (el.parentElement !== host) {
      host.appendChild(el);
      el.className = 'h-full w-full object-contain';
      el.style.outline = 'none';
    }
  }, [videoMedia.isModal, videoMedia.session, videoMedia.sessionId]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (videoMedia.sessionId) {
        mediaSessionController.seek(videoMedia.sessionId, seconds);
        mediaSessionController.play(videoMedia.sessionId);
        return;
      }
      controlsRef.current?.seekTo(seconds);
      controlsRef.current?.play();
    },
    [videoMedia.sessionId]
  );

  const handleSnippetSeek = () => {
    const tm = mediaMeta.transcript_match;
    if (tm && Number.isFinite(tm.start_sec)) {
      handleSeek(tm.start_sec);
    } else if (mediaMeta.has_transcript) {
      setTranscriptOpen(true);
    }
  };

  const handleDownload = async () => {
    if (!artifactId) {
      toast.error(t('common.downloadFailed', 'Download failed'));
      return;
    }
    try {
      await downloadStorageArtifact(artifactId, video.title);
    } catch {
      toast.error(t('common.downloadFailed', 'Download failed'));
    }
  };

  const handleExpandPreview = useCallback(() => {
    const tm = mediaMeta.transcript_match;
    const currentTime = controlsRef.current?.getCurrentTime() ?? 0;
    const seekTime =
      tm && Number.isFinite(tm.start_sec) ? tm.start_sec : currentTime;

    if (videoMedia.sessionId && seekTime > 0) {
      mediaSessionController.seek(videoMedia.sessionId, seekTime);
    }

    videoMedia.expandToModal();

    openFilePreview({
      src: gatewaySrc,
      name: video.title || 'video.mp4',
      mimeType,
      fileSize: size > 0 ? size : undefined,
      artifactId: artifactId ?? undefined,
      localPreviewUrl: playbackSrc?.startsWith('blob:') ? playbackSrc : undefined,
      meta: video.meta as Record<string, unknown> | undefined,
      mediaSessionId: videoMedia.sessionId,
      onPlaybackSync: () => {
        videoMedia.collapseToInline();
      },
    });
  }, [
    openFilePreview,
    artifactId,
    gatewaySrc,
    video.title,
    video.meta,
    mimeType,
    size,
    mediaMeta.transcript_match,
    playbackSrc,
    videoMedia,
  ]);

  const hasVideoThumb = (hit: OneSearchHit) =>
    Boolean(hit.meta?.thumb_url) || Boolean(artifactIdFromHit(hit.meta));

  const relatedVideos = allVideos.filter((v) => v.id !== video.id).slice(0, 10);
  const gridVideos = allVideos.filter((v) => v.id !== video.id);
  const totalPages = Math.ceil(gridVideos.length / itemsPerPage);
  const paginatedVideos = gridVideos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('w-full space-y-6', className)}>
      <button
        onClick={onBack}
        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-700 transition-colors"
      >
        ← {t('common.back')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {playbackLoading ? (
            <div className="flex aspect-video min-h-[240px] items-center justify-center overflow-hidden rounded-lg border border-muted bg-black">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            </div>
          ) : playbackError || !playbackSrc ? (
            <div className="flex aspect-video min-h-[240px] flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-muted bg-black px-4 text-center">
              <p className="text-sm text-gray-300">
                {t('videoPlayer.loadError', 'Unable to load video')}
              </p>
              <Button size="sm" variant="outline" onClick={retryPlayback}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : (
            <div className="relative aspect-video min-h-[240px] overflow-hidden rounded-lg border border-muted bg-black">
              {videoMedia.sessionId && (
                <div
                  ref={videoHostRef}
                  className={cn(
                    'absolute inset-0',
                    videoMedia.isModal && 'sr-only h-0 overflow-hidden'
                  )}
                >
                  <MediaElementHost
                    sessionId={videoMedia.sessionId}
                    kind="video"
                    src={videoMedia.playbackSrc}
                    className="h-full w-full object-contain"
                  />
                </div>
              )}

              {!videoMedia.isModal && videoMedia.sessionId ? (
                <VideoPlayer
                  src={playbackSrc}
                  variant="expanded"
                  title={video.title}
                  mimeType={mimeType}
                  fileSize={size > 0 ? size : undefined}
                  width={width > 0 ? width : undefined}
                  height={height > 0 ? height : undefined}
                  duration={duration > 0 ? duration : undefined}
                  artifactId={artifactId ?? undefined}
                  mediaSessionId={videoMedia.sessionId}
                  chromeMode="overlay"
                  fullscreenLayout="cinema"
                  className="relative z-[1] h-full w-full overflow-hidden"
                  controlsRef={controlsRef}
                  enableFullscreen
                  enablePiP
                  onDownload={() => void handleDownload()}
                />
              ) : videoMedia.isModal && videoMedia.sessionId ? (
                <div className="flex h-full flex-col justify-center px-4 py-3">
                  <MediaPreviewPlaceholder
                    sessionId={videoMedia.sessionId}
                    kind="video"
                    title={video.title || 'Video'}
                    className="border-white/20 bg-black/40"
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-700">
              {video.title}
            </h1>
            <MediaMatchBadge kind={matchKind} variant="card" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 py-3 border-b border-muted">
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{formatRelativeDate(video.occurredAt || '')}</span>
              {width && height && <span>{width}×{height}</span>}
              {duration > 0 && <span>{formatDuration(duration)}</span>}
              {size > 0 && <span>{formatFileSize(size)}</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExpandPreview}
                disabled={videoMedia.isModal || !playbackSrc}
                className="flex items-center gap-2 rounded-full border border-muted px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
              >
                <PiArrowsOutBold className="h-4 w-4" />
                {t('videoPlayer.expand', 'Expand')}
              </button>
              <Tooltip content={t('common.comingSoon', 'Coming soon')} placement="top">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-full border border-muted px-4 py-2 text-sm font-medium text-gray-400 opacity-60"
                >
                  <PiShareNetworkBold className="h-4 w-4" />
                  {t('common.share')}
                </button>
              </Tooltip>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="flex items-center gap-2 rounded-full border border-muted px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
              >
                <PiDownloadBold className="h-4 w-4" />
                {t('common.download')}
              </button>
              {mediaMeta.has_transcript && (
                <button
                  type="button"
                  onClick={() => setTranscriptOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-muted px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
                >
                  <PiFileTextBold className="h-4 w-4" />
                  {t('searchHub.transcript')}
                </button>
              )}
              <Tooltip content={t('videoPlayer.addBookmark', 'Bookmark')} placement="top">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-full border border-muted px-4 py-2 text-sm font-medium text-gray-400 opacity-60"
                >
                  <PiBookmarkBold className="h-4 w-4" />
                  {t('common.save')}
                </button>
              </Tooltip>
            </div>
          </div>

          {video.snippet && (
            <div className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
              <button
                type="button"
                onClick={handleSnippetSeek}
                className="w-full text-start text-sm text-gray-700 whitespace-pre-wrap hover:text-primary dark:text-gray-400"
              >
                {video.snippet}
              </button>
            </div>
          )}

          {video.meta && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {video.meta.artifact_id && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Artifact ID:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-700 font-mono">
                    {String(video.meta.artifact_id)}
                  </span>
                </div>
              )}
              {video.meta.mime && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Format:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-700">
                    {String(video.meta.mime).split('/')[1]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-700">
              {t('searchHub.relatedVideos')}
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {relatedVideos.map((relatedVideo) => (
                <RelatedVideoRow
                  key={relatedVideo.id}
                  video={relatedVideo}
                  inlinePlaybackActive={activeRelatedRowId === relatedVideo.id}
                  onInlinePlaybackRequest={() =>
                    setActiveRelatedRowId((prev) =>
                      prev === relatedVideo.id ? null : relatedVideo.id
                    )
                  }
                  onSelect={() => onVideoSelect(relatedVideo)}
                />
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => onBack()}>
              <PiArrowRightBold className="h-4 w-4 mr-2" />
              {t('searchHub.findMoreVideos')}
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-muted">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-700 mb-6">
          {t('searchHub.moreVideos')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {paginatedVideos.map((gridVideo) => {
            const gridDuration = Number(gridVideo.meta?.duration || 0);
            return (
              <button
                key={gridVideo.id}
                onClick={() => onVideoSelect(gridVideo)}
                className="group text-left"
              >
                <div
                  className="relative w-full overflow-hidden rounded-lg bg-gray-200/60 dark:bg-gray-200/15 mb-2"
                  style={{ aspectRatio: '16/9' }}
                >
                  {hasVideoThumb(gridVideo) ? (
                    <SearchHitThumbnail
                      hit={gridVideo}
                      className="h-full w-full"
                      objectFit="cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PiPlayBold className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-0/90 dark:bg-gray-50/90 rounded-full p-3">
                      <PiPlayBold className="h-6 w-6 text-gray-900 dark:text-gray-700" />
                    </div>
                  </div>
                  {gridDuration > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(gridDuration)}
                    </div>
                  )}
                </div>
                <Tooltip content={gridVideo.title} placement="top">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-700 truncate mb-1">
                    {gridVideo.title}
                  </h3>
                </Tooltip>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeDate(gridVideo.occurredAt || '')}
                </p>
              </button>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              {t('common.previous')}
            </Button>
            <span className="flex items-center px-4 text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>

      {artifactId && (
        <TranscriptPanel
          artifactId={artifactId}
          title={video.title}
          query={searchQuery}
          open={transcriptOpen}
          onClose={() => setTranscriptOpen(false)}
          onSeek={handleSeek}
        />
      )}
    </div>
  );
}

export default VideoWatchPage;

function RelatedVideoRow({
  video: relatedVideo,
  inlinePlaybackActive,
  onInlinePlaybackRequest,
  onSelect,
}: {
  video: OneSearchHit;
  inlinePlaybackActive?: boolean;
  onInlinePlaybackRequest?: () => void;
  onSelect: () => void;
}) {
  const artifactId = artifactIdFromHit(relatedVideo.meta);
  const videoUrl = String(relatedVideo.meta?.url || relatedVideo.href || '');
  const fallbackUrl = artifactId
    ? storageService.getDownloadUrl(artifactId, 'inline')
    : videoUrl;
  const mimeType = String(relatedVideo.meta?.mime || 'video/mp4');
  const size = Number(relatedVideo.meta?.size_bytes || 0);

  const { src: playbackSrc } = useStoragePlaybackUrl(artifactId, fallbackUrl, {
    strategy: getPlaybackStrategy(mimeType, relatedVideo.title, size > 0 ? size : undefined),
  });

  if (!playbackSrc) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-lg p-2 text-start transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
      >
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-700">{relatedVideo.title}</p>
      </button>
    );
  }

  return (
    <MpsUltraCompactVideo
      src={playbackSrc}
      title={relatedVideo.title}
      mimeType={mimeType}
      fileSize={size > 0 ? size : undefined}
      artifactId={artifactId ?? undefined}
      rowId={relatedVideo.id}
      inlinePlaybackActive={inlinePlaybackActive}
      onInlinePlaybackRequest={onInlinePlaybackRequest}
      onRowPreview={onSelect}
      thumbnailSlot={
        <SearchHitThumbnail hit={relatedVideo} className="h-full w-full object-cover" objectFit="cover" />
      }
    />
  );
}
