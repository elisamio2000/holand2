'use client';

import cn from '@core/utils/class-names';

export function TableRowSkeleton({
  rows = 8,
  cols = 6,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('animate-pulse space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/40"
        >
          {Array.from({ length: cols }).map((__, j) => (
            <div
              key={j}
              className="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-700"
              style={{ maxWidth: j === 0 ? '2rem' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
