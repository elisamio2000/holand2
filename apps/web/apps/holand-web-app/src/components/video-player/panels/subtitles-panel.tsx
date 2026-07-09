'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { VideoSubtitleTrack } from '../types';

interface SubtitlesPanelProps {
  tracks: VideoSubtitleTrack[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

export function SubtitlesPanel({
  tracks,
  activeId,
  onSelect,
  className,
}: SubtitlesPanelProps) {
  const { t } = useTranslation();

  if (!tracks.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-gray-400">
        {t('videoPlayer.noSubtitles', 'No subtitles available')}
      </p>
    );
  }

  return (
    <ul className={cn('max-h-64 overflow-y-auto', className)} role="list">
      <li>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'w-full px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-200/20',
            activeId === null && 'bg-primary/5 font-medium text-primary'
          )}
        >
          {t('videoPlayer.subtitlesOff', 'Off')}
        </button>
      </li>
      {tracks.map((track) => (
        <li key={track.id}>
          <button
            type="button"
            onClick={() => onSelect(track.id)}
            className={cn(
              'w-full px-3 py-2 text-start text-xs hover:bg-gray-100 dark:hover:bg-gray-200/20',
              activeId === track.id && 'bg-primary/5 font-medium text-primary'
            )}
          >
            {track.label}
            {track.language ? (
              <span className="ms-1 text-gray-400">({track.language})</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
