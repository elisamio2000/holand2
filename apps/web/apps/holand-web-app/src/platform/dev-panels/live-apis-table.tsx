'use client';

import { useMemo } from 'react';
import { DevPanelSection } from './dev-panel-section';
import { StatusBadge } from './status-badge';
import type { LiveApiRequirement, LiveApisTableLabels } from './types';

export interface LiveApisTableProps<T extends LiveApiRequirement = LiveApiRequirement> {
  rows: T[];
  labels: LiveApisTableLabels;
  resolveStatus: (row: T) => string;
  resolveStatusLabel: (statusKey: string) => string;
  /** When set, rows are grouped under section headers. */
  groupOrder?: string[];
  groupLabel?: (groupKey: string) => string;
}

function LiveApisTableBody<T extends LiveApiRequirement>({
  rows,
  labels,
  resolveStatus,
  resolveStatusLabel,
}: Omit<LiveApisTableProps<T>, 'groupOrder' | 'groupLabel'>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead>
          <tr className="border-b border-muted bg-gray-50/80 dark:bg-gray-100/40">
            {[labels.columns.id, labels.columns.endpoint, labels.columns.status].map((label) => (
              <th
                key={label}
                className="px-2 py-2 font-medium text-gray-600 dark:text-gray-400"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const statusKey = resolveStatus(row);
            return (
              <tr key={row.id} className="border-b border-muted/60 last:border-0">
                <td className="px-2 py-2 align-top text-[11px] font-medium">{row.id}</td>
                <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-gray-600 dark:text-gray-400">
                  {row.endpoint}
                </td>
                <td className="px-2 py-2 align-top">
                  <StatusBadge
                    status={statusKey}
                    label={resolveStatusLabel(statusKey)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Three-column live API status table with optional domain grouping.
 */
export function LiveApisTable<T extends LiveApiRequirement = LiveApiRequirement>({
  rows,
  labels,
  resolveStatus,
  resolveStatusLabel,
  groupOrder,
  groupLabel,
}: LiveApisTableProps<T>) {
  const grouped = useMemo(() => {
    if (!groupOrder?.length) return null;
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = row.group ?? 'other';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return groupOrder
      .filter((g) => (map.get(g)?.length ?? 0) > 0)
      .map((g) => ({ key: g, rows: map.get(g) ?? [] }));
  }, [rows, groupOrder]);

  if (!grouped) {
    return (
      <LiveApisTableBody
        rows={rows}
        labels={labels}
        resolveStatus={resolveStatus}
        resolveStatusLabel={resolveStatusLabel}
      />
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ key, rows: groupRows }) => (
        <DevPanelSection
          key={key}
          title={groupLabel?.(key) ?? labels.groups?.[key] ?? key}
        >
          <LiveApisTableBody
            rows={groupRows}
            labels={labels}
            resolveStatus={resolveStatus}
            resolveStatusLabel={resolveStatusLabel}
          />
        </DevPanelSection>
      ))}
    </div>
  );
}
