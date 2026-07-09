'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchMode } from '@/types/one-search.types';
import {
  PiTextAaBold,
  PiImageBold,
  PiMusicNotesBold,
  PiVideoBold,
  PiFileBold,
  PiSquaresFourBold,
} from 'react-icons/pi';

const MODE_CONFIG: Array<{
  id: OneSearchMode;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', icon: PiSquaresFourBold },
  { id: 'text', icon: PiTextAaBold },
  { id: 'image', icon: PiImageBold },
  { id: 'audio', icon: PiMusicNotesBold },
  { id: 'video', icon: PiVideoBold },
  { id: 'file', icon: PiFileBold },
];

export interface ModeSelectorProps {
  activeMode: OneSearchMode;
  onChange: (mode: OneSearchMode) => void;
  className?: string;
}

export function ModeSelector({ activeMode, onChange, className }: ModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex gap-1.5 overflow-x-auto pb-1', className)}>
      {MODE_CONFIG.map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            activeMode === id
              ? 'border-primary bg-primary text-white shadow-sm'
              : 'border-muted bg-gray-0 text-gray-700 hover:bg-gray-100 dark:bg-gray-50 dark:text-gray-700 dark:hover:bg-gray-100'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{t(`searchHub.modes.${id}`)}</span>
        </button>
      ))}
    </div>
  );
}
