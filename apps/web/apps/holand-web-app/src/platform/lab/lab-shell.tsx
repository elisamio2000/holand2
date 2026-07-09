'use client';

import { useEffect, useState } from 'react';
import cn from '@core/utils/class-names';
import type { LabAnchor, LabShellProps } from './types';

function tabForHash<T extends string>(anchors: LabAnchor<T>[] | undefined, hash: string): T | null {
  const anchor = anchors?.find((a) => a.href === hash);
  return anchor?.tab ?? null;
}

export function LabShell<T extends string>({
  moduleId: _moduleId,
  tabs,
  anchors,
  defaultTab,
  banner,
  onUnmount,
  headerExtra,
}: LabShellProps<T>) {
  const [tab, setTab] = useState<T>(defaultTab);

  useEffect(() => {
    return () => {
      onUnmount?.();
    };
  }, [onUnmount]);

  useEffect(() => {
    if (!anchors?.length) return;
    const syncFromHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const nextTab = tabForHash(anchors, hash);
      if (nextTab) setTab(nextTab);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [anchors]);

  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div className="space-y-6">
      {banner}

      <div className="sticky top-16 z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-muted bg-gray-0/95 px-3 py-2 backdrop-blur dark:bg-gray-50/95">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            data-tour={item.dataTourId}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              tab === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-200/20'
            )}
          >
            {item.label}
          </button>
        ))}
        {headerExtra}
        {anchors && anchors.length > 0 && (
          <>
            <span className="mx-1 hidden h-4 w-px bg-muted sm:inline" />
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                onClick={() => setTab(a.tab)}
                className="hidden text-xs text-gray-500 hover:text-primary sm:inline"
              >
                {a.label}
              </a>
            ))}
          </>
        )}
      </div>

      <div key={activeTab?.id}>{activeTab?.content}</div>
    </div>
  );
}
