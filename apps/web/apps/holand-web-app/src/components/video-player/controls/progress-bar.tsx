'use client';

import { useCallback, useRef, useState } from 'react';
import cn from '@core/utils/class-names';
import { formatTime } from '../utils/format-time';
import type { VideoChapter } from '../types';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  chapters?: VideoChapter[];
  onSeek: (time: number) => void;
  /** Show a hover time bubble (defaults true). */
  showHoverPreview?: boolean;
  /** Optional scrub thumbnail style from sprite sheet. */
  scrubPreviewStyle?: React.CSSProperties | null;
  /** Notifies parent of hover seek ratio (for sprite scrub preview). */
  onHoverRatioChange?: (ratio: number | null) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Seekable progress bar with buffered range, chapter markers, drag scrubbing
 * and a hover time bubble. RTL-aware.
 */
export function ProgressBar({
  currentTime,
  duration,
  buffered = 0,
  chapters = [],
  onSeek,
  showHoverPreview = true,
  scrubPreviewStyle,
  onHoverRatioChange,
  className,
  disabled,
}: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const ratioFromEvent = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const raw = (clientX - rect.left) / rect.width;
    const ratio = isRtl ? 1 - raw : raw;
    return Math.max(0, Math.min(1, ratio));
  }, []);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      if (!duration) return;
      onSeek(ratioFromEvent(clientX) * duration);
    },
    [duration, onSeek, ratioFromEvent]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !duration) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !duration) return;
    const ratio = ratioFromEvent(e.clientX);
    if (showHoverPreview) {
      setHoverRatio(ratio);
      onHoverRatioChange?.(ratio);
    }
    if (draggingRef.current) seekFromEvent(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(duration, currentTime + 5));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, currentTime - 5));
    }
  };

  const hoverPct = hoverRatio != null ? hoverRatio * 100 : null;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setHoverRatio(null);
        onHoverRatioChange?.(null);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative h-1.5 w-full cursor-pointer touch-none rounded-full bg-gray-200 dark:bg-gray-700',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 start-0 rounded-full bg-gray-300 dark:bg-gray-600"
        style={{ width: `${bufPct}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 start-0 rounded-full bg-primary"
        style={{ width: `${pct}%` }}
      />

      {chapters.map((ch) => {
        const left = duration > 0 ? (ch.start / duration) * 100 : 0;
        return (
          <button
            key={ch.id}
            type="button"
            aria-label={ch.title}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSeek(ch.start);
            }}
            className="absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-gray-0 rtl:translate-x-1/2 dark:ring-gray-50"
            style={{ insetInlineStart: `${left}%` }}
          />
        );
      })}

      <div
        className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100 rtl:translate-x-1/2"
        style={{ insetInlineStart: `${pct}%` }}
      />

      {showHoverPreview && hoverPct != null && duration > 0 && (
        <div
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${hoverPct}%` }}
        >
          {scrubPreviewStyle && (
            <span
              className="mb-1 block overflow-hidden rounded border border-white/20 bg-black shadow-lg"
              style={scrubPreviewStyle}
            />
          )}
          <div className="rounded bg-gray-900/90 px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-white">
            {formatTime(hoverRatio! * duration)}
          </div>
        </div>
      )}
    </div>
  );
}
