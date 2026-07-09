'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import {
  PiSpeakerHighFill,
  PiSpeakerSlashFill,
  PiSpeakerLowFill,
} from 'react-icons/pi';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onMutedChange: (m: boolean) => void;
  compact?: boolean;
}

/** Volume control — click icon to expand slider (matches audio player UX). */
export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onMutedChange,
  compact,
}: VolumeControlProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const effective = isMuted ? 0 : volume;

  const Icon =
    isMuted || volume === 0
      ? PiSpeakerSlashFill
      : volume < 0.5
        ? PiSpeakerLowFill
        : PiSpeakerHighFill;

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Tooltip content={t('videoPlayer.volume', 'Volume')} placement="top">
        <ActionIcon
          variant="text"
          size="sm"
          aria-label={t('videoPlayer.volume', 'Volume')}
          onClick={() => setExpanded((p) => !p)}
          className={cn(
            'shrink-0 transition-colors',
            expanded
              ? 'text-primary dark:text-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          )}
        >
          <Icon className="h-4 w-4" />
        </ActionIcon>
      </Tooltip>

      <div
        className={cn(
          'flex items-center gap-1.5 overflow-hidden transition-all duration-200',
          expanded || compact ? 'max-w-[110px] opacity-100' : 'max-w-0 opacity-0'
        )}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={effective}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onVolumeChange(v);
            if (v > 0 && isMuted) onMutedChange(false);
          }}
          className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary dark:bg-gray-200/30"
          aria-label={t('videoPlayer.volume', 'Volume')}
        />
        {!compact && (
          <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            {Math.round(effective * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
