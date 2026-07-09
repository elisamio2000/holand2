'use client';

import cn from '@core/utils/class-names';
import { formatTime } from '../utils/format-time';
import type { VideoChapter } from '../types';

interface ChapterTimelineProps {
  chapters: VideoChapter[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  className?: string;
}

/**
 * Secondary timeline with chapter dots, labels, and timestamps (mock advanced row).
 */
export function ChapterTimeline({
  chapters,
  duration,
  currentTime,
  onSeek,
  className,
}: ChapterTimelineProps) {
  if (!duration || chapters.length === 0) return null;

  return (
    <div className={cn('relative px-2 py-2', className)}>
      <div className="relative h-1 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-primary/40"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
        {chapters.map((ch) => {
          const left = (ch.start / duration) * 100;
          const active = currentTime >= ch.start && (ch.end == null || currentTime < ch.end);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSeek(ch.start)}
              className={cn(
                'absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-gray-0 rtl:translate-x-1/2 dark:ring-gray-50',
                active ? 'bg-primary scale-110' : 'bg-primary/70 hover:bg-primary'
              )}
              style={{ insetInlineStart: `${left}%` }}
              aria-label={ch.title}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {chapters.map((ch) => {
          const active = currentTime >= ch.start && (ch.end == null || currentTime < ch.end);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSeek(ch.start)}
              className={cn(
                'flex items-center gap-1.5 text-[10px] transition-colors',
                active ? 'font-semibold text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-primary' : 'bg-gray-300')} />
              <span className="max-w-[120px] truncate">{ch.title}</span>
              <span className="tabular-nums opacity-70">{formatTime(ch.start)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
