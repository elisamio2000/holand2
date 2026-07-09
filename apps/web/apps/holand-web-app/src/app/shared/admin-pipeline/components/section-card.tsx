// ============================================
// SectionCard — Reusable card wrapper for pipeline admin sections
// Consistent border, background, and header pattern
// ============================================
'use client';

import cn from '@core/utils/class-names';
import { Title } from 'rizzui';

interface SectionCardProps {
  title?: string;
  icon?: React.ReactNode;
  /** Optional badge (e.g. count) rendered beside the title */
  badge?: React.ReactNode;
  /** Actions rendered at the end of the header row */
  headerActions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * SectionCard — Container with optional header row.
 *
 * Follows the established pattern: border-muted, bg-gray-0, dark:bg-gray-50.
 * Used across all pipeline admin tabs for visual consistency.
 */
export default function SectionCard({
  title,
  icon,
  badge,
  headerActions,
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  const hasHeader = title || headerActions;
  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-muted px-5 py-4">
          {title && (
            <Title as="h5" className="flex items-center gap-2 font-semibold">
              {icon}
              {title}
              {badge}
            </Title>
          )}
          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </div>
  );
}
