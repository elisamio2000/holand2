'use client';

import { Badge } from 'rizzui';
import type { DevGapPriority } from './types';

/** Maps gap priority to RizzUI badge color. */
export function priorityBadgeColor(
  priority: DevGapPriority
): 'danger' | 'warning' | 'secondary' {
  if (priority === 'P0') return 'danger';
  if (priority === 'P1') return 'warning';
  return 'secondary';
}

export interface PriorityBadgeProps {
  priority: DevGapPriority;
  label: string;
}

/** Standard priority badge for capability gap tables. */
export function PriorityBadge({ priority, label }: PriorityBadgeProps) {
  return (
    <Badge color={priorityBadgeColor(priority)} rounded="md" className="text-[10px]">
      {label}
    </Badge>
  );
}
