'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { formatTime } from '../utils/format-time';
import type { VideoChapter } from '../types';

interface ChaptersPanelProps {
  chapters: VideoChapter[];
  currentTime: number;
  onSeek: (time: number) => void;
  className?: string;
}

export function ChaptersPanel({
  chapters,
  currentTime,
  onSeek,
  className,
}: ChaptersPanelProps) {
  const { t } = useTranslation();

  if (!chapters.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-gray-400">
        {t('videoPlayer.noChapters', 'No chapters available')}
      </p>
    );
  }

  return (
    <ul className={cn('max-h-64 overflow-y-auto', className)} role="list">
      {chapters.map((ch) => {
        const active =
          currentTime >= ch.start && (ch.end == null || currentTime < ch.end);
        return (
          <li key={ch.id}>
            <button
              type="button"
              onClick={() => onSeek(ch.start)}
              className={cn(
                'flex w-full items-start gap-2 border-b border-muted px-3 py-2 text-start text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20',
                active && 'bg-primary/5 text-primary'
              )}
            >
              <span
                className={cn(
                  'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                  active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                )}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{ch.title}</span>
              <span className="shrink-0 tabular-nums text-gray-400">
                {formatTime(ch.start)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
