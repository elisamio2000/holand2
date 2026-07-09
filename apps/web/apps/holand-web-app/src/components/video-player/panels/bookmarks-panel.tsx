'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { formatTime } from '../utils/format-time';

interface BookmarksPanelProps {
  bookmarks: number[];
  currentTime: number;
  onSeek: (time: number) => void;
  onRemove?: (time: number) => void;
  className?: string;
}

export function BookmarksPanel({
  bookmarks,
  currentTime,
  onSeek,
  onRemove,
  className,
}: BookmarksPanelProps) {
  const { t } = useTranslation();

  if (!bookmarks.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-gray-400">
        {t('videoPlayer.noBookmarks', 'No bookmarks yet')}
      </p>
    );
  }

  const sorted = [...bookmarks].sort((a, b) => a - b);

  return (
    <ul className={cn('max-h-64 overflow-y-auto', className)} role="list">
      {sorted.map((time) => (
        <li key={time} className="flex items-center border-b border-muted">
          <button
            type="button"
            onClick={() => onSeek(time)}
            className={cn(
              'flex-1 px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-200/20',
              Math.abs(currentTime - time) < 1 && 'bg-primary/5 text-primary'
            )}
          >
            {formatTime(time)}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(time)}
              className="px-2 py-2 text-xs text-gray-400 hover:text-red-500"
              aria-label={t('videoPlayer.removeBookmark', 'Remove bookmark')}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
