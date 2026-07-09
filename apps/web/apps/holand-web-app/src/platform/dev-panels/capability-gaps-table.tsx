'use client';

import { Fragment, useState } from 'react';
import { Badge } from 'rizzui';
import { PiCaretDownBold, PiCaretRightBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { JsonSpecBlock } from './json-spec-block';
import { PriorityBadge } from './priority-badge';
import type { CapabilityGap, CapabilityGapColumnLabels, CapabilityGapsTableLabels } from './types';

export interface CapabilityGapsTableProps<T extends CapabilityGap = CapabilityGap> {
  gaps: T[];
  columns: CapabilityGapColumnLabels;
  labels: CapabilityGapsTableLabels;
  gapI18nKey: (id: string) => string;
  translate: (key: string, fallback: string) => string;
  copyLabel?: string;
}

function GapRow<T extends CapabilityGap>({
  gap,
  columns,
  labels,
  gapI18nKey,
  translate,
  copyLabel,
  expanded,
  onToggle,
}: {
  gap: T;
  columns: CapabilityGapColumnLabels;
  labels: CapabilityGapsTableLabels;
  gapI18nKey: (id: string) => string;
  translate: (key: string, fallback: string) => string;
  copyLabel?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const baseKey = gapI18nKey(gap.id);
  const capability = translate(`${baseKey}.capability`, gap.capability);
  const acceptance = gap.resolved
    ? gap.resolvedNote ?? translate(`${baseKey}.acceptance`, gap.acceptance)
    : translate(`${baseKey}.acceptance`, gap.acceptance);
  const surfaceLabel =
    labels.surfaces[gap.uiSurface] ??
    translate(`surfaces.${gap.uiSurface}`, gap.uiSurface);

  const colCount = 7;

  return (
    <Fragment>
      <tr
        className={cn(
          'border-b border-muted/60 cursor-pointer transition hover:bg-gray-50/60 dark:hover:bg-gray-100/20',
          expanded && 'bg-gray-50/40 dark:bg-gray-100/10'
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-2 align-top text-[11px] font-medium">
          <span className="line-clamp-2">{capability}</span>
        </td>
        <td className="px-2 py-2 align-top text-[10px] text-gray-500">
          <span className="line-clamp-2">{gap.feWorkaround}</span>
        </td>
        <td className="px-2 py-2 align-top">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-muted px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-expanded={expanded}
          >
            {expanded ? (
              <PiCaretDownBold className="size-3 shrink-0" />
            ) : (
              <PiCaretRightBold className="size-3 shrink-0" />
            )}
            {expanded ? labels.collapseContract : labels.expandContract}
          </button>
        </td>
        <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-primary">
          <span className="line-clamp-2">{gap.requiredApi}</span>
        </td>
        <td className="px-2 py-2 align-top" onClick={(e) => e.stopPropagation()}>
          {gap.resolved ? (
            <Badge color="success" rounded="md" className="text-[10px]">
              {labels.resolved}
            </Badge>
          ) : (
            <PriorityBadge
              priority={gap.priority}
              label={labels.priority[gap.priority]}
            />
          )}
        </td>
        <td className="px-2 py-2 align-top text-[10px] text-gray-500">{surfaceLabel}</td>
        <td className="px-2 py-2 align-top text-[10px] text-gray-500">
          <span className="line-clamp-2">{acceptance}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-muted/60 bg-gray-50/30 dark:bg-gray-100/5">
          <td colSpan={colCount} className="px-2 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <JsonSpecBlock
                label={labels.requestSample}
                data={gap.feRequest}
                copyLabel={copyLabel}
              />
              <JsonSpecBlock
                label={labels.responseSample}
                data={gap.expectedResponse}
                copyLabel={copyLabel}
              />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * Compact capability gaps table — request/response samples expand per row.
 */
export function CapabilityGapsTable<T extends CapabilityGap = CapabilityGap>({
  gaps,
  columns,
  labels,
  gapI18nKey,
  translate,
  copyLabel,
}: CapabilityGapsTableProps<T>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-muted bg-gray-50/80 dark:bg-gray-100/40">
            {[
              columns.capability,
              columns.workaround,
              columns.contract,
              columns.api,
              columns.priority,
              columns.surface,
              columns.acceptance,
            ].map((label) => (
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
          {gaps.map((gap) => (
            <GapRow
              key={gap.id}
              gap={gap}
              columns={columns}
              labels={labels}
              gapI18nKey={gapI18nKey}
              translate={translate}
              copyLabel={copyLabel}
              expanded={expandedId === gap.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === gap.id ? null : gap.id))
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
