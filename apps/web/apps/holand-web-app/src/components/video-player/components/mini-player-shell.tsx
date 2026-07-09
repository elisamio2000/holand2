'use client';

import type { ReactNode } from 'react';
import cn from '@core/utils/class-names';
import { PiPlayFill, PiPauseFill } from 'react-icons/pi';
import { vpTokens } from '../helpers/variant-visual-tokens';

interface MiniPlayerShellProps {
  poster?: string;
  title: ReactNode;
  timeLabel?: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  progress?: ReactNode;
  volume?: ReactNode;
  settings?: ReactNode;
  expand?: ReactNode;
  menu?: ReactNode;
  videoStage?: ReactNode;
  className?: string;
  disabled?: boolean;
}

/** Compact mini player — play FAB + progress row (map-chat / One Search). */
export function MiniPlayerShell({
  poster,
  title,
  timeLabel,
  isPlaying,
  onTogglePlay,
  progress,
  volume,
  settings,
  expand,
  menu,
  videoStage,
  className,
  disabled,
}: MiniPlayerShellProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {videoStage}
      <div className={cn(vpTokens.miniCard, disabled && 'pointer-events-none opacity-90')}>
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled || !onTogglePlay}
          className={cn(vpTokens.playFab, vpTokens.playFabMd)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <PiPauseFill className="h-4 w-4" />
          ) : (
            <PiPlayFill className="ml-0.5 h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className={vpTokens.miniTitle}>{title}</p>
          {timeLabel && (
            <p className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{timeLabel}</p>
          )}
        </div>

        {progress && <div className="min-w-0 flex-[2]">{progress}</div>}

        <div className="flex shrink-0 items-center gap-0.5">
          {volume}
          {settings}
          {expand}
          {menu}
        </div>
      </div>
      {poster && (
        <span className="sr-only" aria-hidden>
          {poster}
        </span>
      )}
    </div>
  );
}
