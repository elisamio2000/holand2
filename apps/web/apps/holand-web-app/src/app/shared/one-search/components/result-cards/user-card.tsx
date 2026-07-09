'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit } from '@/types/one-search.types';
import { formatRelativeDate } from '../../utils/format-date';
import { LaneResultIcon } from './lane-result-icon';

export interface UserCardProps {
  data: OneSearchHit;
  onClick?: () => void;
  className?: string;
}

export function UserCard({ data, onClick, className }: UserCardProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return formatRelativeDate(dateString, i18n.language);
  };

  const href = data.href || '#';
  const thumb = typeof data.meta?.thumb_url === 'string' ? data.meta.thumb_url : '';

  const inner = (
    <div
      className={cn(
        'group flex gap-3 rounded-lg border border-transparent p-3 transition-all',
        'hover:border-fuchsia-200/80 hover:bg-fuchsia-50/30 hover:shadow-sm',
        'dark:hover:border-fuchsia-900/45 dark:hover:bg-fuchsia-950/15',
        className
      )}
    >
      {thumb ? (
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-black/[0.06] dark:ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <LaneResultIcon lane="users" />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-[15px] font-medium text-blue-700 group-hover:underline dark:text-blue-400">
          {data.title}
        </h3>
        {data.snippet ? (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{data.snippet}</p>
        ) : null}
        {data.meta?.aliases ? (
          <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{String(data.meta.aliases)}</p>
        ) : null}
        {data.occurredAt ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Last login: {formatDate(data.occurredAt)}</p>
        ) : null}
      </div>
      <span className="hidden shrink-0 text-sm text-primary group-hover:underline sm:inline">{t('common.view')} →</span>
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
