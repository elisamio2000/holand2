'use client';

import type { ReactNode } from 'react';
import cn from '@core/utils/class-names';

interface DevBannerProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function DevBanner({ title = 'Dev lab.', children, className }: DevBannerProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100',
        className
      )}
    >
      <strong>{title}</strong> {children}
    </div>
  );
}
