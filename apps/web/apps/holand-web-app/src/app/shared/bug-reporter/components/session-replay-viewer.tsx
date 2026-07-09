'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Replayer } from '@rrweb/replay';
import type { eventWithTime } from '@rrweb/types';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import { PiPauseFill, PiPlayFill } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import '@rrweb/replay/dist/style.css';
import {
  extractRecordedViewport,
  getReplayEventStats,
  normalizeReplayEvents,
} from '../capture/replay-events';

const MAX_VIEWPORT_HEIGHT = 480;

/** Legacy exception — rrweb replay timeline; not MPS-backed media (see LEGACY-EXCEPTIONS.md). */

type SessionReplayViewerProps = {
  events: eventWithTime[];
  viewport?: { width: number; height: number };
  className?: string;
};

function formatMs(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function applyViewportScale(
  replayer: Replayer,
  containerEl: HTMLDivElement,
  containerWidth: number,
  recordedWidth: number,
  recordedHeight: number
) {
  const scale = Math.min(
    containerWidth / recordedWidth,
    MAX_VIEWPORT_HEIGHT / recordedHeight,
    1
  );

  const scaledH = recordedHeight * scale;

  replayer.wrapper.style.width = `${recordedWidth}px`;
  replayer.wrapper.style.height = `${recordedHeight}px`;
  replayer.wrapper.style.transform = `scale(${scale})`;
  replayer.wrapper.style.transformOrigin = 'top center';
  replayer.wrapper.style.margin = '0 auto';

  containerEl.style.height = `${scaledH}px`;
  containerEl.style.width = '100%';
  containerEl.style.overflow = 'hidden';
  containerEl.style.display = 'flex';
  containerEl.style.justifyContent = 'center';

  return { scale, scaledH };
}

export default function SessionReplayViewer({
  events,
  viewport,
  className,
}: SessionReplayViewerProps) {
  const { t } = useTranslation();
  const shellRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const mountedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const recordedSizeRef = useRef({ width: 0, height: 0 });
  const [recordedLabel, setRecordedLabel] = useState('');

  const stats = useMemo(() => getReplayEventStats(events), [events]);
  const playableEvents = useMemo(() => normalizeReplayEvents(events), [events]);
  const recordedViewport = useMemo(
    () => extractRecordedViewport(events, viewport),
    [events, viewport]
  );

  const rescaleReplayer = useCallback(() => {
    if (!replayerRef.current || !rootRef.current || !shellRef.current) return;
    const containerWidth = shellRef.current.clientWidth;
    if (containerWidth < 80) return;
    const { width, height } = recordedSizeRef.current;
    applyViewportScale(
      replayerRef.current,
      rootRef.current,
      containerWidth,
      width,
      height
    );
  }, []);

  const setPlayingState = useCallback((next: boolean) => {
    playingRef.current = next;
    setPlaying(next);
  }, []);

  const destroyReplayer = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try {
      replayerRef.current?.destroy();
    } catch {
      /* already destroyed */
    }
    replayerRef.current = null;
    playingRef.current = false;
    if (rootRef.current) {
      rootRef.current.innerHTML = '';
      rootRef.current.style.height = '';
    }
    mountedRef.current = false;
  }, []);

  /** rrweb needs pause() before play() — scrubbing worked because seek calls pause(). */
  const startPlayback = useCallback((replayer: Replayer, fromMs?: number) => {
    const total = replayer.getMetaData().totalTime;
    const current = fromMs ?? replayer.getCurrentTime();
    const startAt = total > 0 && current >= total - 50 ? 0 : current;

    replayer.pause(startAt);
    setCurrentMs(startAt);

    requestAnimationFrame(() => {
      if (replayerRef.current !== replayer) return;
      replayer.play(startAt);
    });
  }, []);

  const mountReplayer = useCallback(() => {
    if (!rootRef.current || !shellRef.current || playableEvents.length === 0) return;

    const containerWidth = shellRef.current.clientWidth;
    if (containerWidth < 80) return;

    destroyReplayer();
    setError(null);

    try {
      const recordedWidth = recordedViewport.width;
      const recordedHeight = recordedViewport.height;

      const replayer = new Replayer(playableEvents, {
        root: rootRef.current,
        showWarning: false,
        showDebug: false,
        skipInactive: false,
        UNSAFE_replayCanvas: true,
        mouseTail: {
          strokeStyle: '#e11d48',
          lineWidth: 2,
        },
      });

      replayer.on('resize', (payload: unknown) => {
        const dimension = payload as { width: number; height: number };
        if (!dimension?.width || !dimension?.height) return;
        recordedSizeRef.current = { width: dimension.width, height: dimension.height };
        setRecordedLabel(`${dimension.width}×${dimension.height}`);
        rescaleReplayer();
      });

      replayer.on('finish', () => setPlayingState(false));
      replayer.on('pause', () => setPlayingState(false));
      replayer.on('start', () => setPlayingState(true));

      replayerRef.current = replayer;
      recordedSizeRef.current = { width: recordedWidth, height: recordedHeight };
      setRecordedLabel(`${recordedWidth}×${recordedHeight}`);

      applyViewportScale(
        replayer,
        rootRef.current,
        containerWidth,
        recordedWidth,
        recordedHeight
      );

      // Initialize playback clock at frame 0 so first Play works without scrubbing
      replayer.pause(0);

      const meta = replayer.getMetaData();
      setDurationMs(Math.max(meta.totalTime, 1));
      setCurrentMs(replayer.getCurrentTime());
      setPlayingState(false);
      setReady(true);
      mountedRef.current = true;

      const tick = () => {
        if (replayerRef.current) {
          setCurrentMs(replayerRef.current.getCurrentTime());
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[SessionReplayViewer] mount failed:', err);
      setError(err instanceof Error ? err.message : t('messages.bugReport.replayLoadFailed'));
      setReady(false);
    }
  }, [destroyReplayer, playableEvents, recordedViewport.height, recordedViewport.width, rescaleReplayer, setPlayingState, t]);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setCurrentMs(0);
    setDurationMs(0);

    if (events.length === 0) {
      setError(null);
      destroyReplayer();
      return;
    }

    if (playableEvents.length === 0) {
      setError(t('messages.bugReport.replayNoBaseline'));
      destroyReplayer();
      return;
    }

    const timer = window.setTimeout(() => mountReplayer(), 120);

    const observer = new ResizeObserver(() => {
      if (!mountedRef.current) return;
      rescaleReplayer();
    });

    if (shellRef.current) observer.observe(shellRef.current);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      destroyReplayer();
    };
  }, [destroyReplayer, events, mountReplayer, playableEvents, rescaleReplayer, t]);

  const togglePlay = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;

    if (playingRef.current) {
      replayer.pause();
      return;
    }

    startPlayback(replayer);
  };

  const handleSeekPct = (pct: number) => {
    const replayer = replayerRef.current;
    if (!replayer || durationMs <= 0) return;
    const targetMs = pct * durationMs;
    replayer.pause(targetMs);
    setCurrentMs(replayer.getCurrentTime());
    setPlayingState(false);
  };

  const progress = durationMs > 0 ? currentMs / durationMs : 0;

  if (events.length === 0) {
    return (
      <Text className="text-sm text-gray-500">{t('messages.bugReport.noReplayEvents')}</Text>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Text className="text-[11px] text-gray-400">
        {t('messages.bugReport.replayStats', {
          playable: stats.playable,
          total: stats.total,
          snapshots: stats.fullSnapshots,
        })}
        {recordedLabel && ` · ${recordedLabel}px`}
      </Text>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}

      <div
        ref={shellRef}
        className="overflow-hidden rounded-lg border border-muted bg-gray-100 dark:bg-gray-200/20"
      >
        <div ref={rootRef} className="w-full" />
      </div>

      {ready && (
        <div className="flex items-center gap-3 rounded-xl border border-muted bg-gray-0 px-3 py-2.5 dark:bg-gray-50">
          {/* Play / Pause — matches global AudioPlayer chatInline */}
          <button
            type="button"
            onClick={togglePlay}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground shadow-sm',
              'transition-transform hover:scale-105 active:scale-95'
            )}
            title={playing ? t('messages.bugReport.replayPause') : t('messages.bugReport.replayPlay')}
            aria-label={playing ? t('messages.bugReport.replayPause') : t('messages.bugReport.replayPlay')}
          >
            {playing ? (
              <PiPauseFill className="h-4 w-4" />
            ) : (
              <PiPlayFill className="ms-0.5 h-4 w-4" />
            )}
          </button>

          {/* Time — current / total */}
          <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {formatMs(currentMs)} / {formatMs(durationMs)}
          </span>

          <ReplayScrubber progress={progress} onSeek={handleSeekPct} className="min-w-0 flex-1" />
        </div>
      )}
    </div>
  );
}

function ReplayScrubber({
  progress,
  onSeek,
  className,
}: {
  progress: number;
  onSeek: (pct: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('relative flex h-8 cursor-pointer items-center rounded-md px-1', className)}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(pct);
      }}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20 dark:bg-primary/15">
        <div
          className="h-full rounded-full bg-primary/70 transition-[width] duration-75 dark:bg-primary/60"
          style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
        />
      </div>
    </div>
  );
}
