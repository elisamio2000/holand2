'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import cn from '@core/utils/class-names';
import type { ChecklistItem } from './types';

interface LabSectionProps {
  id: string;
  title: string;
  description?: string;
  checklist?: ChecklistItem[];
  children: ReactNode;
  className?: string;
  /** Namespace for localStorage checklist keys (default: media-players). */
  moduleId?: string;
  /** data-tour anchor (defaults to id) */
  dataTourId?: string;
}

export function labChecklistStorageKey(moduleId: string, sectionId: string) {
  return `lab-checklist:${moduleId}:${sectionId}`;
}

export function LabSection({
  id,
  title,
  description,
  checklist,
  children,
  className,
  moduleId = 'media-players',
  dataTourId,
}: LabSectionProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const storageKey = labChecklistStorageKey(moduleId, id);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = useCallback(
    (itemId: string) => {
      setChecked((prev) => {
        const next = { ...prev, [itemId]: !prev[itemId] };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  return (
    <section
      id={id}
      data-tour={dataTourId ?? id}
      className={cn(
        'scroll-mt-24 rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50',
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {children}
      {checklist && checklist.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-muted pt-3">
          {checklist.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={!!checked[item.id]}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
