'use client';

import type { ReactNode } from 'react';
import cn from '@core/utils/class-names';

interface VariantCardProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function VariantCard({ label, hint, children, className }: VariantCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-50/30 p-3 dark:bg-gray-100/5',
        className
      )}
    >
      <div className="mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</span>
        {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
