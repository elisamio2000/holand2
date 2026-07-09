'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';

interface LiveDvrBadgeProps {
  isLive: boolean;
  seekableStart?: number;
  seekableEnd?: number;
  className?: string;
}

/**
 * Live DVR UI stub — shows seek window when BE provides seekable range (Vidstack pattern).
 */
export function LiveDvrBadge({
  isLive,
  seekableStart = 0,
  seekableEnd,
  className,
}: LiveDvrBadgeProps) {
  const { t } = useTranslation();
  if (!isLive) return null;

  const canDvr = seekableEnd != null && seekableEnd - seekableStart > 30;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
        canDvr ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500',
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', canDvr ? 'bg-primary' : 'animate-pulse bg-red-500')} />
      {canDvr ? t('videoPlayer.liveDvr', 'Live DVR') : t('videoPlayer.live', 'Live')}
    </span>
  );
}
