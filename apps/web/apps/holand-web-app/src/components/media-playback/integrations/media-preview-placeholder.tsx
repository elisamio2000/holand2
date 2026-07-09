'use client';

import { PiPauseFill, PiPlayFill } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { formatTime } from '@/components/audio-player/utils/format-time';
import { useMediaSession } from '../core/media-session-store';

export interface MediaPreviewPlaceholderProps {
  sessionId: string;
  kind: 'audio' | 'video';
  title?: string;
  className?: string;
}

/**
 * Display-only chrome while modal owns controls — no engine, no hooks beyond subscribe.
 */
export function MediaPreviewPlaceholder({
  sessionId,
  kind,
  title,
  className,
}: MediaPreviewPlaceholderProps) {
  const session = useMediaSession(sessionId);
  const currentTime = session?.currentTime ?? 0;
  const duration = session?.duration ?? 0;
  const isPlaying = session?.isPlaying ?? false;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      data-testid="media-preview-placeholder"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-muted bg-gray-0 px-3 py-2.5 opacity-90 dark:bg-gray-50',
        'pointer-events-none',
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isPlaying
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-200/30'
        )}
      >
        {isPlaying ? (
          <PiPauseFill className="h-4 w-4" />
        ) : (
          <PiPlayFill className="ml-0.5 h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
          {title || (kind === 'audio' ? 'Audio' : 'Video')}
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-300/30">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
