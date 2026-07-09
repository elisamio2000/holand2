'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { OneSearchHit } from '@/types/one-search.types';
import { formatRelativeDate } from '../../utils/format-date';
import cn from '@core/utils/class-names';
import { LaneResultIcon } from './lane-result-icon';

export interface ChatCardProps {
  data: OneSearchHit;
  onClick?: () => void;
  className?: string;
}

export function ChatCard({ data, onClick, className }: ChatCardProps) {
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
        'hover:border-sky-200/80 hover:bg-sky-50/40 hover:shadow-sm',
        'dark:hover:border-sky-900/50 dark:hover:bg-sky-950/20',
        className
      )}
    >
      <LaneResultIcon lane="chat" />
      <div className="min-w-0 flex-1">
        {pathLine ? (
          <p className="truncate font-mono text-[11px] text-emerald-800 dark:text-emerald-400/90">{pathLine}</p>
        ) : null}
        <h3 className="mt-0.5 line-clamp-2 text-[15px] font-medium text-blue-700 group-hover:underline dark:text-blue-400">
          {data.title}
        </h3>
        {data.snippet ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{data.snippet}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          {data.occurredAt ? <span>{formatDate(data.occurredAt)}</span> : null}
          <span>·</span>
          <span>{t('searchHub.lanes.chat')}</span>
          {data.meta?.session_id != null ? (
            <>
              <span>·</span>
              <span className="truncate font-mono">session: {String(data.meta.session_id)}</span>
            </>
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
