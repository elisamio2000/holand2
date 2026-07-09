'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { SearchFilters, SearchRoleFilter } from '../hooks/use-search-filters';

interface SearchFiltersBarProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
  variant?: 'compact' | 'expanded';
  className?: string;
}

const ROLES: SearchRoleFilter[] = ['all', 'user', 'assistant'];

export default function SearchFiltersBar({
  filters,
  onChange,
  onReset,
  variant = 'expanded',
  className,
}: SearchFiltersBarProps) {
  const { t } = useTranslation();
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 border-b border-muted px-2 py-1.5',
        className
      )}
    >
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange({ role })}
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
            filters.role === role
              ? 'bg-primary/10 text-primary'
              : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-200/10'
          )}
        >
          {t(`chatPage.search.filter.role.${role}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({ hasAttachment: !filters.hasAttachment })}
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
          filters.hasAttachment
            ? 'bg-primary/10 text-primary'
            : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-200/10'
        )}
      >
        {t('chatPage.search.filter.attachments')}
      </button>
      {!isCompact && (
        <>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            className="rounded border border-muted px-1.5 py-0.5 text-[10px]"
            aria-label={t('chatPage.search.filter.dateFrom')}
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            className="rounded border border-muted px-1.5 py-0.5 text-[10px]"
            aria-label={t('chatPage.search.filter.dateTo')}
          />
        </>
      )}
      {(filters.role !== 'all' ||
        filters.hasAttachment ||
        filters.dateFrom ||
        filters.dateTo) && (
        <button
          type="button"
          onClick={onReset}
          className="ms-auto text-[10px] text-primary underline"
        >
          {t('chatPage.search.filter.reset')}
        </button>
      )}
    </div>
  );
}
