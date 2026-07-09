// ============================================
// CaseStatusBadge — Status badge component for case import lifecycle
// Displays colored badge with icon for each case status
// ============================================

'use client';

import { Badge } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiClockDuotone,
  PiMagnifyingGlassDuotone,
  PiCubeDuotone,
  PiFloppyDiskDuotone,
  PiCheckCircleDuotone,
  PiXCircleDuotone,
  PiPauseDuotone,
  PiShieldCheckDuotone,
} from 'react-icons/pi';
import type { CaseStatus } from '@/types/case-importer.types';

/**
 * Status configuration for each case lifecycle stage.
 * Maps status to display label, color, and icon.
 */
const STATUS_CONFIG: Record<
  CaseStatus | 'unknown',
  {
    label: string;
    color: 'warning' | 'info' | 'secondary' | 'primary' | 'success' | 'danger';
    icon: React.ReactNode;
  }
> = {
  pending: {
    label: 'Pending',
    color: 'warning',
    icon: <PiClockDuotone className="h-4 w-4" />,
  },
  analyzing: {
    label: 'Analyzing',
    color: 'info',
    icon: <PiMagnifyingGlassDuotone className="h-4 w-4" />,
  },
  embedding: {
    label: 'Embedding',
    color: 'secondary',
    icon: <PiCubeDuotone className="h-4 w-4" />,
  },
  storing: {
    label: 'Storing',
    color: 'primary',
    icon: <PiFloppyDiskDuotone className="h-4 w-4" />,
  },
  security: {
    label: 'Security',
    color: 'info',
    icon: <PiShieldCheckDuotone className="h-4 w-4" />,
  },
  paused: {
    label: 'Paused',
    color: 'warning',
    icon: <PiPauseDuotone className="h-4 w-4" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'secondary',
    icon: <PiXCircleDuotone className="h-4 w-4" />,
  },
  completed: {
    label: 'Completed',
    color: 'success',
    icon: <PiCheckCircleDuotone className="h-4 w-4" />,
  },
  failed: {
    label: 'Failed',
    color: 'danger',
    icon: <PiXCircleDuotone className="h-4 w-4" />,
  },
  unknown: {
    label: 'Unknown',
    color: 'secondary',
    icon: <PiClockDuotone className="h-4 w-4" />,
  },
};

/**
 * CaseStatusBadge — Renders a colored badge for case import status.
 *
 * Shows a status-appropriate icon and label with animation for active states.
 *
 * @requires rizzui Badge component
 *
 * @example
 * ```tsx
 * <CaseStatusBadge status="analyzing" />
 * <CaseStatusBadge status="completed" showIcon={false} />
 * ```
 */
export default function CaseStatusBadge({
  status,
  showIcon = true,
  className,
}: {
  /** Current case status */
  status: CaseStatus;
  /** Whether to show the status icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status as CaseStatus] || STATUS_CONFIG.unknown;
  // Pulse animation for active processing states
  const isActive = status === 'analyzing' || status === 'embedding' || status === 'storing';
  const statusLabel = t(`cases.status.${status}`, config.label);

  return (
    <Badge
      variant="flat"
      color={config.color}
      className={cn(
        'gap-1.5',
        isActive && 'animate-pulse',
        className
      )}
    >
      {showIcon && config.icon}
      <span className="capitalize">{statusLabel}</span>
      {!(status in STATUS_CONFIG) && (
        <span className="text-xs opacity-60">({status})</span>
      )}
    </Badge>
  );
}

/**
 * Get the status configuration for a given status.
 * Useful for external components that need status colors/labels.
 */
export function getStatusConfig(status: CaseStatus | string) {
  return STATUS_CONFIG[status as CaseStatus] || STATUS_CONFIG.unknown;
}
