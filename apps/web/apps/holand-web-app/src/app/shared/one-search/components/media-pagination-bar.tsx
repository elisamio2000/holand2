'use client';

import { useTranslation } from 'react-i18next';
import { Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';

export interface MediaPaginationBarProps {
  shownCount: number;
  filteredCount: number;
  totalCount: number;
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  className?: string;
}

export function MediaPaginationBar({
  shownCount,
  filteredCount,
  totalCount,
  hasMore,
  loading,
  onLoadMore,
  className,
}: MediaPaginationBarProps) {
  const { t } = useTranslation();

  if (filteredCount <= 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-muted bg-gray-0/60 px-4 py-3 dark:bg-gray-100/30',
        className
      )}
    >
      <Text className="text-xs text-gray-500 dark:text-gray-400">
        {t('searchHub.mediaPagination.summary', {
          shown: shownCount,
          filtered: filteredCount,
          total: totalCount,
        })}
      </Text>
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          disabled={loading}
          onClick={onLoadMore}
        >
          {loading ? t('common.loading', 'Loading…') : t('searchHub.mediaPagination.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
