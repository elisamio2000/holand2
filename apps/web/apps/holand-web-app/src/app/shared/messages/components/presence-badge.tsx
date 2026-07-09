'use client';

import cn from '@core/utils/class-names';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/** Deterministic mock presence from user id (until backend presence API exists) */
export function mockPresenceFromUserId(userId: string): PresenceStatus {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bucket = hash % 10;
  if (bucket < 4) return 'online';
  if (bucket < 6) return 'away';
  if (bucket < 7) return 'busy';
  return 'offline';
}

const statusColors: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  busy: 'bg-red-500',
  offline: 'bg-gray-300 dark:bg-gray-600',
};

type PresenceBadgeProps = {
  status: PresenceStatus;
  size?: 'sm' | 'md';
  className?: string;
};

export default function PresenceBadge({ status, size = 'sm', className }: PresenceBadgeProps) {
  const dim = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  return (
    <span
      className={cn(
        'absolute aspect-square shrink-0 rounded-full ring-2 ring-white dark:ring-gray-50',
        dim,
        statusColors[status],
        className
      )}
      aria-hidden
    />
  );
}
