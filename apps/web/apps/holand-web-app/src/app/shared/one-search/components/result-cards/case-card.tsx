'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import { formatRelativeDate } from '../../utils/format-date';
import { LaneResultIcon } from './lane-result-icon';

export interface CaseCardProps {
  data: OneSearchHit;
  onClick?: () => void;
  className?: string;
}

export function CaseCard({ data, onClick, className }: CaseCardProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return formatRelativeDate(dateString, i18n.language);
  };

  const href = data.href || '#';
  const pathLine = data.href ? data.href.replace(/^https?:\/\/[^/]+/i, '') : '';

  const inner = (
    <div
      className={cn(
        'group flex gap-3 rounded-lg border border-transparent p-3 transition-all',
        'hover:border-violet-200/80 hover:bg-violet-50/35 hover:shadow-sm',
        'dark:hover:border-violet-900/45 dark:hover:bg-violet-950/20',
        className
      )}
    >
      <LaneResultIcon lane="cases" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-[15px] font-medium text-blue-700 group-hover:underline dark:text-blue-400">
          {data.title}
        </h3>
        {pathLine ? (
          <p className="mt-1 truncate font-mono text-xs text-emerald-800 dark:text-emerald-400/90">{pathLine}</p>
        ) : null}
        {data.snippet ? (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{data.snippet}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {data.meta?.status ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300">
              {String(data.meta.status)}
            </span>
          ) : null}
          {data.occurredAt ? <span>{formatDate(data.occurredAt)}</span> : null}
          {data.meta?.case_id ? (
            <span className="truncate font-mono">{String(data.meta.case_id)}</span>
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
