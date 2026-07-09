'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { Button } from 'rizzui';
import { PiWarningCircle, PiDownloadBold, PiArrowCounterClockwise } from 'react-icons/pi';

export type MediaLoadErrorKind = 'audio' | 'video';

export interface MediaLoadErrorProps {
  kind: MediaLoadErrorKind;
  /** When true, format cannot play in-browser (download only). */
  unsupported?: boolean;
  format?: string;
  compact?: boolean;
  onRetry?: () => void;
  onDownload?: () => void;
  className?: string;
}

/**
 * Shared load-failure UX for audio and video surfaces.
 */
export function MediaLoadError({
  kind,
  unsupported = false,
  format,
  compact = false,
  onRetry,
  onDownload,
  className,
}: MediaLoadErrorProps) {
  const { t } = useTranslation();
  const ns = kind === 'audio' ? 'audioPlayer' : 'videoPlayer';

  const message = unsupported
    ? t(`${ns}.unsupportedFormat`, 'This format cannot be played in the browser')
    : t(`${ns}.loadError`, 'Failed to load. Please try again.');

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 text-sm',
        compact
          ? 'rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200'
          : 'flex-col justify-center rounded-lg border border-muted bg-gray-50 px-6 py-10 text-center dark:bg-gray-100/30',
        className
      )}
    >
      <PiWarningCircle
        className={cn('shrink-0 text-gray-400', !compact && 'h-10 w-10')}
        aria-hidden
      />
      <p className={cn('font-medium', compact ? 'flex-1 truncate text-xs' : 'text-gray-700 dark:text-gray-300')}>
        {message}
      </p>
      {format && !compact && (
        <p className="text-xs text-gray-400">
          {t(`${ns}.formatLabel`, 'Format')}: {format.toUpperCase()}
        </p>
      )}
      <div className={cn('flex gap-2', compact && 'shrink-0')}>
        {onRetry && !unsupported && (
          <Button
            size="sm"
            variant={compact ? 'text' : 'outline'}
            onClick={onRetry}
            aria-label={t(`${ns}.retry`, 'Retry')}
          >
            {compact ? (
              <PiArrowCounterClockwise className="h-4 w-4" />
            ) : (
              t(`${ns}.retry`, 'Retry')
            )}
          </Button>
        )}
        {onDownload && (
          <Button size="sm" variant={compact ? 'text' : 'solid'} onClick={onDownload}>
            {!compact && <PiDownloadBold className="me-1.5 h-4 w-4" />}
            {t(`${ns}.download`, 'Download')}
          </Button>
        )}
      </div>
    </div>
  );
}
