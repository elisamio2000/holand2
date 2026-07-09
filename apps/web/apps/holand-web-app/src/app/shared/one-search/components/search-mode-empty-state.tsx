'use client';

import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import type { OneSearchMode } from '@/types/one-search.types';

export interface SearchModeEmptyStateProps {
  mode: OneSearchMode;
  className?: string;
}

export function SearchModeEmptyState({ mode, className }: SearchModeEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('py-20 text-center', className)}>
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {t('searchHub.noResults')}
      </Text>
      <Text className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {t('searchHub.modeEmptyHint', { mode: t(`searchHub.modes.${mode}`) })}
      </Text>
    </div>
  );
}
