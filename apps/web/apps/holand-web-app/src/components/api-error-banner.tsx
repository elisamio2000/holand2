'use client';

import { Button, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  classifyApiError,
  getApiErrorI18nKey,
  type ClassifiedApiError,
} from '@/lib/api-errors';
import cn from '@core/utils/class-names';

export default function ApiErrorBanner({
  error,
  onRetry,
  className,
}: {
  error: unknown | ClassifiedApiError | null;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!error) return null;

  const classified =
    error && typeof error === 'object' && 'category' in error
      ? (error as ClassifiedApiError)
      : classifyApiError(error);

  const i18nKey = getApiErrorI18nKey(classified.category);
  const label = t(i18nKey, { defaultValue: classified.message });

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30',
        className
      )}
    >
      <Text className="text-sm text-red-800 dark:text-red-200">{label}</Text>
      {classified.retryable && onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
