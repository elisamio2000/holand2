'use client';

import { Tooltip } from '@/components/tooltip';
import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import { formatRelativeDate } from '../../utils/format-date';
import { VideoWatchPage } from './video-watch-page';
import { SearchHitThumbnail } from '../search-hit-thumbnail';
import { MediaSearchToolbar } from '../media-search-toolbar';
import { MediaPaginationBar } from '../media-pagination-bar';
import { MediaMatchBadge } from '../media-match-badge';
import {
  filterMediaHits,
  sortMediaHits,
  type MediaSortField,
  type MediaHitFilterState,
  DEFAULT_MEDIA_FILTERS,
} from '../../utils/media-hit-filters';
import {
  formatHitDuration,
  hitDurationSec,
  hitMatchKind,
  hitMediaMeta,
} from '../../utils/media-hit-meta';
import type { MediaSearchControlsProps } from '../../types/media-search-controls-props';
import { MpsUltraCompactVideo } from '@/components/media-playback';
import { storageService } from '@/services/storage.service';
import { artifactIdFromHit } from '@/utils/storage-artifact-media';
import { getPlaybackStrategy } from '@/utils/playback-strategy';
import { useStoragePlaybackUrl } from '@/hooks/use-storage-playback-url';

import { PiPlayBold } from 'react-icons/pi';

export interface VideoSearchViewProps {
  videos: OneSearchHit[];
  mediaControls?: MediaSearchControlsProps;
  className?: string;
}

export function VideoSearchView({ videos, mediaControls, className }: VideoSearchViewProps) {
  const { t } = useTranslation();
  const [selectedVideo, setSelectedVideo] = useState<OneSearchHit | null>(null);
  const [inlineVideoId, setInlineVideoId] = useState<string | null>(null);
  const [localSort, setLocalSort] = useState<MediaSortField>('relevance');
  const [localFilters, setLocalFilters] = useState<MediaHitFilterState>(DEFAULT_MEDIA_FILTERS);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const sort = mediaControls?.sort ?? localSort;
  const setSort = mediaControls?.onSortChange ?? setLocalSort;
  const filters = mediaControls?.filters ?? localFilters;
  const setFilters = mediaControls?.onFiltersChange ?? setLocalFilters;
  const searchQuery = mediaControls?.searchQuery ?? '';

  const processedVideos = useMemo(
    () => sortMediaHits(filterMediaHits(videos, filters), sort),
    [videos, filters, sort]
  );

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !mediaControls?.onLoadMore || !mediaControls.hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !mediaControls.paginationLoading) {
          mediaControls.onLoadMore?.();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mediaControls?.onLoadMore, mediaControls?.hasMore, mediaControls?.paginationLoading, mediaControls]);

  if (videos.length === 0) {
    return (
      <div className={cn('py-20 text-center', className)}>
        <p className="text-gray-500 dark:text-gray-400">
          {t('searchHub.noResults')}
        </p>
      </div>
    );
  }

  if (selectedVideo) {
    return (
      <VideoWatchPage
        video={selectedVideo}
        allVideos={processedVideos}
        searchQuery={searchQuery}
        onVideoSelect={setSelectedVideo}
        onBack={() => setSelectedVideo(null)}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {mediaControls?.serverMetadataReady === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
          {t('searchHub.mediaDegraded.filenameOnly')}
        </div>
      )}

      <MediaSearchToolbar
        mediaKind="video"
        totalCount={mediaControls?.totalCount ?? videos.length}
        filteredCount={processedVideos.length}
        hits={videos}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
        viewMode="grid"
        onViewModeChange={() => {}}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {processedVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            inlineActive={inlineVideoId === video.id}
            onInlineRequest={() =>
              setInlineVideoId((prev) => (prev === video.id ? null : video.id))
            }
            onClick={() => setSelectedVideo(video)}
          />
        ))}
      </div>

      <MediaPaginationBar
        shownCount={processedVideos.length}
        filteredCount={processedVideos.length}
        totalCount={mediaControls?.totalCount ?? videos.length}
        hasMore={Boolean(mediaControls?.hasMore)}
        loading={mediaControls?.paginationLoading}
        onLoadMore={() => mediaControls?.onLoadMore?.()}
      />

      <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
    </div>
  );
}

interface VideoCardProps {
  video: OneSearchHit;
  onClick: () => void;
  inlineActive?: boolean;
  onInlineRequest?: () => void;
}

function VideoCard({ video, onClick, inlineActive, onInlineRequest }: VideoCardProps) {
  const { t } = useTranslation();
  const durationSec = hitDurationSec(video) || Number(video.meta?.duration || 0);
  const matchKind = hitMatchKind(video);
  const mediaMeta = hitMediaMeta(video);
  const artifactId = artifactIdFromHit(video.meta);
  const videoUrl = String(video.meta?.url || video.href || '');
  const fallbackUrl = artifactId
    ? storageService.getDownloadUrl(artifactId, 'inline')
    : videoUrl;
  const mimeType = String(video.meta?.mime || 'video/mp4');
  const size = Number(video.meta?.size_bytes || 0);

  const { src: playbackSrc } = useStoragePlaybackUrl(artifactId, fallbackUrl, {
    strategy: getPlaybackStrategy(mimeType, video.title, size > 0 ? size : undefined),
  });

  if (inlineActive && playbackSrc) {
    return (
      <div className="overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
        <MpsUltraCompactVideo
          src={playbackSrc}
          title={video.title}
          mimeType={mimeType}
          fileSize={size > 0 ? size : undefined}
          artifactId={artifactId ?? undefined}
          rowId={video.id}
          inlinePlaybackActive
          onInlinePlaybackRequest={onInlineRequest}
          onRowPreview={onClick}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-lg border border-muted bg-gray-0 text-start transition-shadow hover:shadow-md dark:bg-gray-50"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-200/20">
        <SearchHitThumbnail hit={video} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/30">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInlineRequest?.();
            }}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-2 ring-white/20 opacity-80 transition group-hover:scale-105 group-hover:opacity-100"
            aria-label={t('videoPlayer.play', 'Play')}
          >
            <PiPlayBold className="ms-0.5 h-5 w-5" />
          </button>
        </div>
        {durationSec > 0 && (
          <span className="absolute bottom-2 end-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {formatHitDuration(durationSec)}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <Tooltip content={video.title} placement="top">
          <p className="truncate text-sm font-medium leading-snug text-gray-900 dark:text-gray-700">
            {video.title}
          </p>
        </Tooltip>
        {(matchKind !== 'filename' || mediaMeta.has_transcript) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <MediaMatchBadge kind={matchKind} variant="card" />
            {mediaMeta.has_transcript && matchKind !== 'transcript' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/60 bg-violet-50/50 px-2 py-0.5 text-[10px] text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/15 dark:text-violet-300">
                {t('searchHub.transcript')}
              </span>
            )}
          </div>
        )}
        {video.snippet && (
          <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {video.snippet}
          </p>
        )}
        {video.occurredAt && (
          <p className="text-[10px] text-gray-400">{formatRelativeDate(video.occurredAt)}</p>
        )}
      </div>
    </button>
  );
}

