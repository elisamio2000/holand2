'use client';

import { useState, type ReactNode } from 'react';
import cn from '@core/utils/class-names';

export interface VariantTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface VariantTabsProps {
  tabs: VariantTab[];
  className?: string;
  defaultTabId?: string;
}

export function VariantTabs({ tabs, className, defaultTabId }: VariantTabsProps) {
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id ?? '');

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-muted pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              active === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-200/20'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div key={current?.id}>{current?.content}</div>
    </div>
  );
}
