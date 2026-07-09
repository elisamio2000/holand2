'use client';

import type { ReactNode } from 'react';
import { Title } from 'rizzui';
import cn from '@core/utils/class-names';

export interface DevPanelSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/** Grouped section inside a dev panel (e.g. Live APIs by domain). */
export function DevPanelSection({ title, children, className }: DevPanelSectionProps) {
  return (
    <div className={cn('mb-4 last:mb-0', className)}>
      <Title as="h4" className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {title}
      </Title>
      {children}
    </div>
  );
}

export interface DevPanelHeaderProps {
  title: string;
  subtitle?: string;
}

/** Panel title block above section tables. */
export function DevPanelHeader({ title, subtitle }: DevPanelHeaderProps) {
  return (
    <div className="mb-3">
      <Title as="h3" className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </Title>
      {subtitle ? (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

export interface DevPanelFooterProps {
  children: ReactNode;
  className?: string;
}

/** Small footer note (source path, last updated). */
export function DevPanelFooter({ children, className }: DevPanelFooterProps) {
  return (
    <p className={cn('mt-2 text-[10px] text-gray-400', className)}>{children}</p>
  );
}

export interface DevPanelTabsProps {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}

/** Simple two-tab switcher for APIs vs gaps sections. */
export function DevPanelTabs({ tabs, activeId, onChange }: DevPanelTabsProps) {
  return (
    <div className="mb-3 flex flex-wrap gap-1 border-b border-muted pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
            activeId === tab.id
              ? 'bg-primary/10 text-primary'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-100/40'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
