'use client';

import { Badge } from 'rizzui';
import cn from '@core/utils/class-names';

interface UnreadBadgeProps {
  count: number;
  muted?: boolean;
  className?: string;
}

export default function UnreadBadge({ count, muted, className }: UnreadBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <Badge
      size="sm"
      variant="solid"
      className={cn(
        'h-5 min-w-[20px] shrink-0 px-1.5 font-medium',
        muted
          ? 'bg-gray-400 text-white dark:bg-gray-500'
          : 'animate-pulse bg-teal-500 text-white',
        className
      )}
    >
      {displayCount}
    </Badge>
  );
}
