'use client';

import Link from 'next/link';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import { LaneResultIcon } from './lane-result-icon';

export interface GraphCardProps {
  data: OneSearchHit;
  onClick?: () => void;
  className?: string;
}

export function GraphCard({ data, onClick, className }: GraphCardProps) {
  const href = data.href || '#';
  const pathLine = data.href ? data.href.replace(/^https?:\/\/[^/]+/i, '') : '';

  const inner = (
    <div
      className={cn(
        'group flex gap-3 rounded-lg border border-transparent p-3 font-mono transition-all',
        'hover:border-rose-200/80 hover:bg-rose-50/35 hover:shadow-sm',
        'dark:hover:border-rose-900/45 dark:hover:bg-rose-950/15',
        className
      )}
    >
      <LaneResultIcon lane="graph" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-blue-700 group-hover:underline dark:text-blue-400">
          {data.title}
        </h3>
        {pathLine ? (
          <p className="mt-1 truncate text-xs text-emerald-800 dark:text-emerald-400/90">{pathLine}</p>
        ) : null}
        {data.snippet ? (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{data.snippet}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          {data.meta?.node_type != null ? <span>type={String(data.meta.node_type)}</span> : null}
          {data.meta?.edge_count !== undefined ? <span>edges={String(data.meta.edge_count)}</span> : null}
          {data.score !== undefined ? (
            <span className="hidden sm:inline">score={data.score.toFixed(2)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" className="block w-full text-start" onClick={onClick}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
      {inner}
    </Link>
  );
}
