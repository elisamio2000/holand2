'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';

import { PiGraphBold } from 'react-icons/pi';

export interface BoardGraphHeaderProps {
  nodeCount: number;
  edgeCount: number;
  /** Inline lead for the shared graph toolbar row (board editor). */
  inline?: boolean;
}

export function BoardGraphHeader({ nodeCount, edgeCount, inline = false }: BoardGraphHeaderProps) {
  const { t } = useTranslation();

  if (inline) {
    return (
      <Tooltip
        content={t('boards.graph.independentLayout', 'Layout is independent from the canvas spatial view')}
        placement="bottom"
      >
        <div className="flex shrink-0 items-center gap-1.5 border-e border-muted pe-2">
          <PiGraphBold className="h-4 w-4 text-gray-500" aria-hidden />
          <span className="hidden text-xs font-semibold text-gray-800 sm:inline">
            {t('boards.graph.summaryTitle', 'Topology summary')}
          </span>
          <span className="font-mono text-[10px] text-gray-500">
            {nodeCount}/{edgeCount}
          </span>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-muted bg-gray-50/80 px-3 py-2 dark:bg-gray-100/5">
      <div className="min-w-0">
        <span className="text-sm font-semibold text-gray-800">
          {t('boards.graph.summaryTitle', 'Topology summary')}
        </span>
        <p className="text-[11px] text-gray-500">
          {t('boards.graph.independentLayout', 'Layout is independent from the canvas spatial view')}
        </p>
      </div>
      <span className="font-mono text-[10px] text-gray-600">
        {t('boards.graph.stats', '{{nodes}} nodes · {{edges}} edges', {
          nodes: nodeCount,
          edges: edgeCount,
        })}
      </span>
    </div>
  );
}
