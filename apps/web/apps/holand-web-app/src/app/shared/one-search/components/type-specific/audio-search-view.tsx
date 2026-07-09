'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import AudioPlayer, {
  type AudioPlayerControls,
  useAudioStickyAnchor,
  useStickyBarActive,
} from '@/components/audio-player';
import {
  MediaElementHost,
  mediaSessionController,
  useMediaPreview,
  useMediaSession,
} from '@/components/media-playback';
import {
  PiPlayBold,
  PiPauseBold,
  PiDownloadBold,
  PiFileTextBold,
  PiMusicNoteDuotone,
  PiNotePencilDuotone,
  PiWaveformBold,
  PiXBold,
} from 'react-icons/pi';
import { Text, Button } from 'rizzui';
import { formatRelativeDate, formatFileSize } from '../../utils/format-date';
import { MediaSearchToolbar } from '../media-search-toolbar';
import { MediaPaginationBar } from '../media-pagination-bar';
import { TranscriptPanel } from '../transcript-panel';
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
import { artifactIdFromHit, downloadStorageArtifact } from '@/utils/storage-artifact-media';
import { storageService } from '@/services/storage.service';
import { useStoragePlaybackUrl } from '@/hooks/use-storage-playback-url';
import { useAudioPlayerStore } from '@/components/audio-player/store/audio-player-store';
import toast from 'react-hot-toast';

export interface AudioSearchViewProps {
  audios: OneSearchHit[];
  mediaControls?: MediaSearchControlsProps;
  className?: string;
}

export function AudioSearchView({ audios, mediaControls, className }: AudioSearchViewProps) {
  const { t } = useTranslation();
  const [localSort, setLocalSort] = useState<MediaSortField>('relevance');
  const [localFilters, setLocalFilters] = useState<MediaHitFilterState>(DEFAULT_MEDIA_FILTERS);

  const sort = mediaControls?.sort ?? localSort;
  const setSort = mediaControls?.onSortChange ?? setLocalSort;
  const filters = mediaControls?.filters ?? localFilters;
  const setFilters = mediaControls?.onFiltersChange ?? setLocalFilters;
  const searchQuery = mediaControls?.searchQuery ?? '';

  const processedAudios = useMemo(
    () => sortMediaHits(filterMediaHits(audios, filters), sort),
    [audios, filters, sort]
  );

  const [expandedAudioId, setExpandedAudioId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<OneSearchHit | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [transcriptTarget, setTranscriptTarget] = useState<OneSearchHit | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const queueIds = useMemo(() => processedAudios.map((a) => a.id), [processedAudios]);
  const queueIndex = currentAudio ? queueIds.indexOf(currentAudio.id) : -1;
  const isWaveformMode = !!(currentAudio && expandedAudioId === currentAudio.id);
  const stickyBarActive = useStickyBarActive();
  const stickyAnchorRef = useRef<HTMLDivElement | null>(null);
  const sessionId = currentAudio ? `one-search-${currentAudio.id}` : '';

  const currentArtifactId = currentAudio
    ? artifactIdFromHit(currentAudio.meta)
    : undefined;
  const currentFallbackUrl = currentArtifactId
    ? storageService.getDownloadUrl(currentArtifactId, 'inline')
    : currentAudio
      ? String(currentAudio.meta?.url || currentAudio.href || '')
      : '';
  const { src: currentPlaybackSrc } = useStoragePlaybackUrl(
    currentArtifactId,
    currentFallbackUrl
  );

  const audioMedia = useMediaPreview({
    enabled: Boolean(currentAudio && currentPlaybackSrc),
    kind: 'audio',
    src: currentFallbackUrl,
    artifactId: currentArtifactId,
    mimeType: currentAudio?.meta?.mime ? String(currentAudio.meta.mime) : undefined,
    fileSize: currentAudio?.meta?.size_bytes ? Number(currentAudio.meta.size_bytes) : undefined,
    title: currentAudio?.title,
    blobUrl: currentPlaybackSrc ?? null,
    sessionKey: currentAudio?.id ?? '',
  });

  const mpsSession = useMediaSession(audioMedia.sessionId || undefined);

  const updateSession = useAudioPlayerStore((s) => s.updateSession);

  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const wsControlsRef = useRef<AudioPlayerControls | null>(null);

  const handlePlayRef = useRef<(audio: OneSearchHit) => void>(() => {});
  /** Play/seek intent while MPS session + blob URL are still resolving after track switch. */
  const pendingPlayRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingSeekPctRef = useRef<number | null>(null);
  const prevMpsPlayingRef = useRef(false);

  const seekToSeconds = useCallback(
    (audio: OneSearchHit, seconds: number) => {
      stopAllRef.current?.();
      if (expandedAudioId === audio.id && wsControlsRef.current) {
        wsControlsRef.current.seekTo(seconds);
        wsControlsRef.current.play();
        setCurrentAudio(audio);
        setIsPlaying(true);
        return;
      }
      if (currentAudio?.id !== audio.id) {
        setExpandedAudioId(null);
        pendingSeekRef.current = seconds;
        pendingPlayRef.current = true;
        setCurrentAudio(audio);
      } else if (audioMedia.sessionId) {
        mediaSessionController.seek(audioMedia.sessionId, seconds);
        mediaSessionController.play(audioMedia.sessionId);
      }
      setIsPlaying(true);
    },
    [currentAudio?.id, expandedAudioId, audioMedia.sessionId]
  );

  const stopAllRef = useRef<(() => void) | null>(null);

  const stopAll = useCallback(() => {
    wsControlsRef.current?.pause();
    wsControlsRef.current = null;
    if (audioMedia.sessionId) {
      mediaSessionController.pause(audioMedia.sessionId);
    }
  }, [audioMedia.sessionId]);
  stopAllRef.current = stopAll;

  const playQueueItem = useCallback(
    (index: number) => {
      const item = processedAudios[index];
      if (!item) return;
      handlePlayRef.current?.(item);
    },
    [processedAudios]
  );

  const handlePlayNext = useCallback(() => {
    if (queueIndex < 0 || queueIndex >= queueIds.length - 1) return;
    playQueueItem(queueIndex + 1);
  }, [queueIndex, queueIds.length, playQueueItem]);

  const handlePlayPrev = useCallback(() => {
    if (queueIndex <= 0) return;
    playQueueItem(queueIndex - 1);
  }, [queueIndex, playQueueItem]);

  const handlePlayAll = useCallback(() => {
    if (processedAudios.length === 0) return;
    playQueueItem(0);
  }, [processedAudios.length, playQueueItem]);

  const handlePlay = useCallback(
    (audio: OneSearchHit) => {
      if (expandedAudioId === audio.id && wsControlsRef.current) {
        wsControlsRef.current.togglePlay();
        return;
      }

      if (currentAudio?.id === audio.id && expandedAudioId === null) {
        if (audioMedia.sessionId) {
          mediaSessionController.togglePlay(audioMedia.sessionId);
        }
        return;
      }

      stopAll();
      if (expandedAudioId !== null && expandedAudioId !== audio.id) {
        setExpandedAudioId(null);
      }
      pendingPlayRef.current = true;
      setCurrentAudio(audio);
      setIsPlaying(true);
      setAudioProgress(0);
      setAudioCurrentTime(0);
      setAudioDuration(0);
    },
    [currentAudio, expandedAudioId, stopAll, audioMedia.sessionId]
  );
  handlePlayRef.current = handlePlay;

  const handleSnippetClick = useCallback(
    (audio: OneSearchHit) => {
      const tm = hitMediaMeta(audio).transcript_match;
      if (tm && Number.isFinite(tm.start_sec)) {
        seekToSeconds(audio, tm.start_sec);
        return;
      }
      if (hitMediaMeta(audio).has_transcript) {
        setTranscriptTarget(audio);
      }
    },
    [seekToSeconds]
  );

  const handleOpenTranscript = useCallback((audio: OneSearchHit) => {
    setTranscriptTarget(audio);
  }, []);

  // ----------------------------------------------------------------
  // Expand / Collapse waveform view
  // ----------------------------------------------------------------
  const handleExpand = useCallback(
    (audio: OneSearchHit) => {
      // ── Collapsing the currently expanded card ──
      if (expandedAudioId === audio.id) {
        const wsTime = wsControlsRef.current?.getCurrentTime() ?? audioCurrentTime;
        const wsWasPlaying = isPlaying;

        // Pause WaveSurfer immediately (React destroys it async — we stop sound NOW)
        wsControlsRef.current?.pause();
        wsControlsRef.current = null;
        setExpandedAudioId(null);

        // Hand back to hidden audio at the exact same position
        if (audioMedia.sessionId) {
          mediaSessionController.seek(audioMedia.sessionId, wsTime);
          if (wsWasPlaying) mediaSessionController.play(audioMedia.sessionId);
        }
        return;
      }

      // ── Expanding a card ──
      // 1. Stop EVERYTHING playing right now (no overlap ever)
      stopAll();

      // 2. If a different card is expanded, collapse it
      if (expandedAudioId !== null) {
        setExpandedAudioId(null);
      }

      // 3. Make this the active audio
      if (currentAudio?.id !== audio.id) {
        setCurrentAudio(audio);
        setAudioCurrentTime(0);
        setAudioProgress(0);
        setAudioDuration(0);
        setIsPlaying(false);
      }

      setExpandedAudioId(audio.id);
    },
    [expandedAudioId, currentAudio, isPlaying, audioCurrentTime, stopAll, audioMedia.sessionId]
  );

  // ----------------------------------------------------------------
  // WaveSurfer reports state changes back to us
  // ----------------------------------------------------------------
  const handleExpandedPlayerStateChange = useCallback((time: number, playing: boolean) => {
    setIsPlaying(playing);
    setAudioCurrentTime(time);
    const dur = wsControlsRef.current?.getDuration() ?? 0;
    if (dur > 0) {
      setAudioDuration(dur);
      setAudioProgress(time / dur);
    }
  }, []);

  // ----------------------------------------------------------------
  // Seek mini bar
  // ----------------------------------------------------------------
  const handleMiniSeek = useCallback(
    (audio: OneSearchHit, pct: number) => {
      if (currentAudio?.id === audio.id && expandedAudioId === null) {
        const dur = mpsSession?.duration ?? audioDuration;
        if (dur > 0) {
          const seekTime = pct * dur;
          if (audioMedia.sessionId) {
            mediaSessionController.seek(audioMedia.sessionId, seekTime);
            if (!mpsSession?.isPlaying) mediaSessionController.play(audioMedia.sessionId);
          }
          setAudioCurrentTime(seekTime);
          setAudioProgress(pct);
        }
        return;
      }

      stopAll();
      if (expandedAudioId !== null && expandedAudioId !== audio.id) setExpandedAudioId(null);
      pendingSeekPctRef.current = pct;
      pendingPlayRef.current = true;
      setCurrentAudio(audio);
      setIsPlaying(true);
      setAudioProgress(pct);
    },
    [currentAudio, expandedAudioId, stopAll, audioMedia.sessionId, mpsSession, audioDuration]
  );

  // ----------------------------------------------------------------
  // Register card refs for IntersectionObserver
  // ----------------------------------------------------------------
  const registerCardRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) cardRefsMap.current.set(id, el);
      else cardRefsMap.current.delete(id);
    },
    []
  );

  const handleStickySeek = useCallback(
    (time: number) => {
      if (isWaveformMode && wsControlsRef.current) {
        wsControlsRef.current.seekTo(time);
      } else if (audioMedia.sessionId) {
        mediaSessionController.seek(audioMedia.sessionId, time);
      }
    },
    [isWaveformMode, audioMedia.sessionId]
  );

  const stickyHandlers = useMemo(
    () => ({
      togglePlay: () => {
        if (isWaveformMode && wsControlsRef.current) {
          wsControlsRef.current.togglePlay();
          return;
        }
        if (audioMedia.sessionId) {
          mediaSessionController.togglePlay(audioMedia.sessionId);
          return;
        }
        if (currentAudio) handlePlay(currentAudio);
      },
      seekTo: handleStickySeek,
      onPrev: handlePlayPrev,
      onNext: handlePlayNext,
    }),
    [
      isWaveformMode,
      audioMedia.sessionId,
      currentAudio,
      handlePlay,
      handleStickySeek,
      handlePlayPrev,
      handlePlayNext,
    ]
  );

  const stickyAnchorEnabled = Boolean(
    currentAudio &&
      (isPlaying || audioCurrentTime > 0 || audioDuration > 0 || isWaveformMode)
  );

  useAudioStickyAnchor({
    enabled: stickyAnchorEnabled,
    sessionId,
    anchorRef: stickyAnchorRef,
    anchorKey: `${currentAudio?.id ?? ''}-${isWaveformMode ? 'wave' : 'mini'}`,
    stickyLayout: 'bar',
    queueIndex,
    queueLength: queueIds.length,
    handlers: stickyHandlers,
    threshold: isWaveformMode ? 0 : 0.15,
    rootMargin: isWaveformMode ? '0px 0px -72px 0px' : '0px',
  });

  useEffect(() => {
    if (!currentAudio) return;
    const metadata = {
      activeId: sessionId,
      title: currentAudio.title,
      src: currentPlaybackSrc,
      artifactId: currentArtifactId,
      queueIndex,
      queueLength: queueIds.length,
      mediaSessionId: audioMedia.sessionId || undefined,
      isPlaying,
      currentTime: audioCurrentTime,
      duration: audioDuration,
    };
    updateSession(metadata);
  }, [
    currentAudio,
    sessionId,
    currentPlaybackSrc,
    currentArtifactId,
    isPlaying,
    audioCurrentTime,
    audioDuration,
    queueIndex,
    queueIds.length,
    audioMedia.sessionId,
    updateSession,
  ]);

  useEffect(() => {
    if (!mpsSession || isWaveformMode) return;
    setIsPlaying(mpsSession.isPlaying);
    setAudioCurrentTime(mpsSession.currentTime);
    if (mpsSession.duration > 0) {
      setAudioDuration(mpsSession.duration);
      setAudioProgress(mpsSession.currentTime / mpsSession.duration);
    }
  }, [
    mpsSession?.isPlaying,
    mpsSession?.currentTime,
    mpsSession?.duration,
    isWaveformMode,
  ]);

  useEffect(() => {
    if (!mpsSession || isWaveformMode) return;
    const wasPlaying = prevMpsPlayingRef.current;
    prevMpsPlayingRef.current = mpsSession.isPlaying;
    const atEnd =
      mpsSession.duration > 0 &&
      mpsSession.currentTime >= mpsSession.duration - 0.25;
    if (wasPlaying && !mpsSession.isPlaying && atEnd) {
      setAudioProgress(0);
      if (queueIndex >= 0 && queueIndex < queueIds.length - 1) {
        handlePlayNext();
      }
    }
  }, [
    mpsSession?.isPlaying,
    mpsSession?.currentTime,
    mpsSession?.duration,
    isWaveformMode,
    queueIndex,
    queueIds.length,
    handlePlayNext,
  ]);

  useEffect(() => {
    if (!audioMedia.sessionId || !currentPlaybackSrc || isWaveformMode) return;

    if (pendingSeekRef.current !== null) {
      mediaSessionController.seek(audioMedia.sessionId, pendingSeekRef.current);
      pendingSeekRef.current = null;
    } else if (pendingSeekPctRef.current !== null && mpsSession && mpsSession.duration > 0) {
      mediaSessionController.seek(
        audioMedia.sessionId,
        pendingSeekPctRef.current * mpsSession.duration
      );
      pendingSeekPctRef.current = null;
    }

    if (pendingPlayRef.current) {
      mediaSessionController.play(audioMedia.sessionId);
      pendingPlayRef.current = false;
    }
  }, [audioMedia.sessionId, currentPlaybackSrc, isWaveformMode, mpsSession?.duration]);

  useEffect(() => {
    if (!isWaveformMode) return;
    let raf = 0;
    const tick = () => {
      const controls = wsControlsRef.current;
      if (controls) {
        const t = controls.getCurrentTime();
        if (Number.isFinite(t)) {
          setAudioCurrentTime(t);
          const dur = controls.getDuration();
          if (dur > 0) {
            setAudioDuration(dur);
            setAudioProgress(t / dur);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isWaveformMode]);

  // Keyboard navigation: j/k focus, Enter play, t transcript
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'j') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(processedAudios.length - 1, i + 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const hit = processedAudios[focusedIndex];
        if (hit) handlePlay(hit);
      } else if (e.key === 't' && focusedIndex >= 0) {
        e.preventDefault();
        const hit = processedAudios[focusedIndex];
        if (hit && hitMediaMeta(hit).has_transcript) setTranscriptTarget(hit);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [processedAudios, focusedIndex, handlePlay]);

  // Infinite scroll sentinel
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

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < processedAudios.length) {
      const id = processedAudios[focusedIndex].id;
      cardRefsMap.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex, processedAudios]);

  if (audios.length === 0) {
    return (
      <div className={cn('py-20 text-center', className)}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('searchHub.noResults')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', stickyBarActive ? 'pb-20' : '', className)}>
      {mediaControls?.serverMetadataReady === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
          {t('searchHub.mediaDegraded.filenameOnly')}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <MediaSearchToolbar
          mediaKind="audio"
          totalCount={mediaControls?.totalCount ?? audios.length}
          filteredCount={processedAudios.length}
          hits={audios}
          sort={sort}
          onSortChange={setSort}
          filters={filters}
          onFiltersChange={setFilters}
          viewMode="grid"
          onViewModeChange={() => {}}
        />
        {processedAudios.length > 1 && (
          <Button type="button" size="sm" variant="outline" className="text-xs" onClick={handlePlayAll}>
            {t('searchHub.audioQueue.playAll')}
          </Button>
        )}
      </div>

      {processedAudios.map((audio, index) => {
        const isCurrent = currentAudio?.id === audio.id;
        const isThisExpanded = expandedAudioId === audio.id;
        const isThisPlaying = isCurrent && isPlaying;
        const cardProgress = isCurrent && !isThisExpanded ? audioProgress : 0;
        const isFocused = focusedIndex === index;

        return (
          <AudioCard
            key={audio.id}
            audio={audio}
            searchQuery={searchQuery}
            isPlaying={isThisPlaying}
            isExpanded={isThisExpanded}
            isFocused={isFocused}
            playbackProgress={cardProgress}
            onPlay={() => handlePlay(audio)}
            onExpand={() => handleExpand(audio)}
            onMiniSeek={(pct) => handleMiniSeek(audio, pct)}
            onSnippetClick={() => handleSnippetClick(audio)}
            onOpenTranscript={() => handleOpenTranscript(audio)}
            onExpandedPlayerStateChange={handleExpandedPlayerStateChange}
            wsControlsRef={isThisExpanded ? wsControlsRef : undefined}
            mediaSessionId={
              isCurrent || isThisExpanded ? audioMedia.sessionId || undefined : undefined
            }
            playbackSrc={isCurrent || isThisExpanded ? currentPlaybackSrc || undefined : undefined}
            registerRef={registerCardRef}
            stickyAnchorRef={isCurrent ? stickyAnchorRef : undefined}
            lazyPlayback={!isCurrent && !isThisExpanded}
          />
        );
      })}

      <MediaPaginationBar
        shownCount={processedAudios.length}
        filteredCount={processedAudios.length}
        totalCount={mediaControls?.totalCount ?? audios.length}
        hasMore={Boolean(mediaControls?.hasMore)}
        loading={mediaControls?.paginationLoading}
        onLoadMore={() => mediaControls?.onLoadMore?.()}
      />

      <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />

      {transcriptTarget && (
        <TranscriptPanel
          artifactId={artifactIdFromHit(transcriptTarget.meta) ?? ''}
          title={transcriptTarget.title}
          query={searchQuery}
          open={Boolean(transcriptTarget)}
          onClose={() => setTranscriptTarget(null)}
          onSeek={(sec) => {
            seekToSeconds(transcriptTarget, sec);
          }}
        />
      )}

      {currentAudio && currentPlaybackSrc && audioMedia.sessionId && (
        <MediaElementHost
          sessionId={audioMedia.sessionId}
          kind="audio"
          src={audioMedia.playbackSrc}
          className="hidden"
        />
      )}

    </div>
  );
}

// ====================================================================
// AudioCard
// ====================================================================
interface AudioCardProps {
  audio: OneSearchHit;
  searchQuery?: string;
  isPlaying: boolean;
  isExpanded: boolean;
  isFocused?: boolean;
  playbackProgress: number;
  lazyPlayback?: boolean;
  onPlay: () => void;
  onExpand: () => void;
  onMiniSeek: (progress: number) => void;
  onSnippetClick: () => void;
  onOpenTranscript: () => void;
  onExpandedPlayerStateChange: (time: number, playing: boolean) => void;
  wsControlsRef?: React.MutableRefObject<AudioPlayerControls | null>;
  mediaSessionId?: string;
  /** Parent-resolved blob URL — avoids duplicate fetch + keeps MPS host in sync */
  playbackSrc?: string;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  stickyAnchorRef?: React.MutableRefObject<HTMLDivElement | null>;
}

function AudioCard({
  audio,
  searchQuery: _searchQuery,
  isPlaying,
  isExpanded,
  isFocused,
  playbackProgress,
  lazyPlayback = false,
  onPlay,
  onExpand,
  onMiniSeek,
  onSnippetClick,
  onOpenTranscript,
  onExpandedPlayerStateChange,
  wsControlsRef,
  mediaSessionId,
  playbackSrc,
  registerRef,
  stickyAnchorRef,
}: AudioCardProps) {
  const { t, i18n } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(!lazyPlayback);
  const artifactId = artifactIdFromHit(audio.meta);
  const mediaMeta = hitMediaMeta(audio);
  const matchKind = hitMatchKind(audio);
  const durationLabel = formatHitDuration(hitDurationSec(audio) || mediaMeta.duration);

  useEffect(() => {
    if (!lazyPlayback) {
      setIsVisible(true);
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazyPlayback]);

  const fallbackUrl = artifactId
    ? storageService.getDownloadUrl(artifactId, 'inline')
    : String(audio.meta?.url || audio.href || '');

  const mimeLabel = audio.meta?.mime
    ? String(audio.meta.mime).split('/')[1]?.toUpperCase()
    : null;
  const sizeLabel = audio.meta?.size_bytes
    ? formatFileSize(Number(audio.meta.size_bytes))
    : null;
  const dateLabel = audio.occurredAt
    ? formatRelativeDate(audio.occurredAt, i18n.language)
    : null;

  const handleDownload = async () => {
    const artifactId = artifactIdFromHit(audio.meta);
    if (!artifactId) {
      toast.error(t('common.downloadFailed', 'Download failed'));
      return;
    }
    try {
      await downloadStorageArtifact(artifactId, audio.title);
    } catch {
      toast.error(t('common.downloadFailed', 'Download failed'));
    }
  };

  return (
    <div
      ref={(el) => {
        cardRef.current = el;
        registerRef(audio.id, el);
      }}
      className={cn(
        'rounded-lg border transition-colors',
        isExpanded
          ? 'border-primary/30 bg-gray-0 dark:bg-gray-50'
          : 'border-muted bg-gray-0 dark:bg-gray-50',
        isFocused && 'ring-2 ring-primary/40'
      )}
    >
      {/* ---- Row 1: Play · Title · Duration · Actions (sticky scroll anchor) ---- */}
      <div
        ref={(el) => {
          if (stickyAnchorRef) stickyAnchorRef.current = el;
        }}
        className="flex items-center gap-3 px-4 pt-4"
      >
        <button
          onClick={onPlay}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all',
            isPlaying
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-200/20 dark:text-gray-400 dark:hover:bg-gray-200/30'
          )}
        >
          {isPlaying ? (
            <PiPauseBold className="h-4 w-4" />
          ) : (
            <PiPlayBold className="ml-0.5 h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <PiMusicNoteDuotone className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-700">
              {audio.title}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {durationLabel}
          </span>

          <Tooltip content={t('common.download', 'Download')} placement="top">
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/15 dark:hover:text-gray-300"
            >
              <PiDownloadBold className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          {mediaMeta.has_transcript && (
            <Tooltip content={t('searchHub.transcript', 'Transcript')} placement="top">
              <button
                type="button"
                onClick={onOpenTranscript}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/15 dark:hover:text-gray-300"
              >
                <PiFileTextBold className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}

          <Tooltip
            content={
              isExpanded
                ? t('audioPlayer.hideWaveform', 'Hide waveform')
                : t('audioPlayer.showWaveform', 'Show waveform')
            }
            placement="top"
          >
            <button
              onClick={onExpand}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                isExpanded
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/15 dark:hover:text-gray-300'
              )}
            >
              {isExpanded ? (
                <PiXBold className="h-3.5 w-3.5" />
              ) : (
                <PiWaveformBold className="h-3.5 w-3.5" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ---- Row 2: Mini waveform (clickable) ---- */}
      {!isExpanded && isVisible && (
        <div className="px-4 pt-2">
          <AudioPlayer
            src={playbackSrc ?? (artifactId ? undefined : fallbackUrl)}
            artifactId={playbackSrc ? undefined : artifactId}
            playbackStrategy="blob-first"
            variant="mini"
            showWaveform={true}
            progress={playbackProgress}
            onSeek={onMiniSeek}
            mediaSessionId={mediaSessionId}
          />
        </div>
      )}

      {/* ---- Row 3: Metadata + snippet ---- */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pb-4 pt-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {mimeLabel && <span>{mimeLabel}</span>}
          {sizeLabel && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{sizeLabel}</span>
            </>
          )}
          {dateLabel && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{dateLabel}</span>
            </>
          )}
          {(matchKind !== 'filename' || mediaMeta.has_transcript) && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <MediaMatchBadge kind={matchKind} variant="card" />
            </>
          )}
        </div>
        {audio.snippet && !isExpanded && (
          <button
            type="button"
            onClick={onSnippetClick}
            className="flex min-w-0 items-start gap-1 text-start text-xs leading-relaxed text-gray-500 hover:text-primary dark:text-gray-400"
          >
            <PiNotePencilDuotone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="line-clamp-1">{audio.snippet}</span>
          </button>
        )}
      </div>

      {/* ---- Expanded full player ---- */}
      {isExpanded && isVisible && playbackSrc && mediaSessionId && (
        <div className="border-t border-muted/50 px-6 py-5">
          <AudioPlayer
            src={playbackSrc}
            title={audio.title}
            mimeType={audio.meta?.mime ? String(audio.meta.mime) : undefined}
            fileSize={audio.meta?.size_bytes ? Number(audio.meta.size_bytes) : undefined}
            variant="full"
            showWaveform={true}
            enableRegions={true}
            showTimeline={true}
            showVolume={true}
            showFileInfo={false}
            showShortcutsHint={true}
            showSkipButtons={true}
            showSkipEnds={true}
            showSpeedControl={true}
            showZoom={true}
            waveformHeight={80}
            mediaSessionId={mediaSessionId}
            controlsRef={wsControlsRef}
            onMediaStateChange={onExpandedPlayerStateChange}
          />
        </div>
      )}
      {isExpanded && isVisible && (!playbackSrc || !mediaSessionId) && (
        <div className="border-t border-muted/50 px-6 py-8 text-center text-sm text-gray-400">
          {t('common.loading', 'Loading...')}
        </div>
      )}
    </div>
  );
}
