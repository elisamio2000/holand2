'use client';

import { Badge } from 'rizzui';
import type { DevApiStatus } from './types';

/** Maps API status strings to RizzUI badge colors. */
export function liveStatusBadgeColor(
  status: string
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'live' || status === 'available') return 'success';
  if (status === 'partial' || status === 'unknown') return 'warning';
  return 'danger';
}

export interface StatusBadgeProps {
  status: DevApiStatus | string;
  label: string;
}

/** Standard status badge for live API tables. */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge color={liveStatusBadgeColor(status)} rounded="md" className="text-[10px]">
      {label}
    </Badge>
  );
}
