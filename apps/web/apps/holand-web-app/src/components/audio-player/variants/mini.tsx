'use client';

import cn from '@core/utils/class-names';
import { hashCode, seededRandom } from '../utils/seed-bars';
import type { VariantProps } from '../types';

export function MiniVariant(props: VariantProps) {
  const { playback, className, progress, onSeek } = props;
  const { resolvedSrc, srcLoading, loadError, handleRetryLoad } = playback;

  if (srcLoading) {
    return (
      <div className={cn('flex h-8 items-center rounded-md bg-gray-100 px-2 dark:bg-gray-200/20', className)}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <button
        type="button"
        onClick={handleRetryLoad}
        className={cn('h-8 rounded-md bg-red-50 px-2 text-[10px] text-red-600 dark:bg-red-900/20', className)}
      >
        Retry
      </button>
    );
  }

  const seed = resolvedSrc ? hashCode(resolvedSrc) : 0;
  const totalBars = 55;
  const prog = progress ?? 0;
  const cursorBar = Math.floor(prog * totalBars);

  const handleMiniClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  return (
    <div
      className={cn(
        'relative flex h-8 items-center gap-[2px] rounded-md px-1',
        onSeek ? 'cursor-pointer' : '',
        className
      )}
      onClick={handleMiniClick}
      role={onSeek ? 'slider' : undefined}
      aria-valuenow={onSeek ? Math.round(prog * 100) : undefined}
    >
      {Array.from({ length: totalBars }).map((_, i) => {
        const h = 15 + seededRandom(seed + i) * 80;
        const isPlayed = i < cursorBar;
        const isCursor = i === cursorBar && prog > 0;
        return (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-[1px] transition-colors duration-75',
              isPlayed
                ? 'bg-primary/70 dark:bg-primary/60'
                : isCursor
                  ? 'bg-primary dark:bg-primary'
                  : 'bg-primary/20 dark:bg-primary/15'
            )}
            style={{ height: `${h}%` }}
          />
        );
      })}
      {prog > 0 && prog < 1 && (
        <div
          className="pointer-events-none absolute top-0 h-full w-[2px] rounded-full bg-primary shadow-sm"
          style={{ left: `calc(${prog * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}
