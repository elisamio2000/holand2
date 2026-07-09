// ============================================
// EmptyState — Reusable empty/no-data placeholder
// Consistent with GPU dashboard pattern
// ============================================
'use client';

import cn from '@core/utils/class-names';
import { Text, Button } from 'rizzui';

interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState — Rendered when a list/table has no data.
 *
 * Centered layout with icon, message, and optional CTA button.
 */
export default function EmptyState({
  icon,
  message,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('p-12 text-center', className)}>
      <div className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-500">
        {icon}
      </div>
      <Text className="mt-3 font-medium text-gray-500">{message}</Text>
      {description && (
        <Text className="mt-1 text-sm text-gray-400">{description}</Text>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
