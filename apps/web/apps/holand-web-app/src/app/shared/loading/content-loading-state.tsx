'use client';

import { Loader, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@core/ui/skeleton';

export type ContentLoadingVariant = 'inline' | 'overlay' | 'page';

export type ContentLoadingSkeleton = 'none' | 'list' | 'chat-messages';

export interface ContentLoadingStateProps {
  /** inline = panel/section; overlay = absolute over parent; page = centered block */
  variant?: ContentLoadingVariant;
  /** Defaults to common.loading */
  label?: string;
  className?: string;
  skeleton?: ContentLoadingSkeleton;
  /** sm = toolbar/row hint; lg = default centered block */
  size?: 'sm' | 'lg';
  /** Hide label text (spinner only) */
  showLabel?: boolean;
}

function ListSkeleton() {
  return (
    <div className="mt-6 w-full max-w-xs space-y-2 px-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

function ChatMessagesSkeleton() {
  return (
    <div className="mx-auto mt-8 w-full max-w-3xl space-y-4 px-4 opacity-60">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
          <Skeleton
            className={cn(
              'rounded-2xl',
              i % 2 === 0 ? 'h-10 w-40' : 'h-16 w-72'
            )}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Centralized loading UI — rizzui Loader + optional skeleton.
 * Use across modules for consistent loading feedback.
 */
export default function ContentLoadingState({
  variant = 'inline',
  label,
  className,
  skeleton = 'none',
  size = 'lg',
  showLabel = true,
}: ContentLoadingStateProps) {
  const { t } = useTranslation();
  const message = label ?? t('common.loading');

  const core = (
    <>
      <Loader size={size} variant="spinner" />
      {showLabel && (
        <Text className="text-sm text-gray-500 dark:text-gray-400">{message}</Text>
      )}
    </>
  );

  if (variant === 'overlay') {
    return (
      <div
        className={cn(
          'absolute inset-0 z-10 flex flex-col items-center justify-center',
          'bg-gray-0/85 backdrop-blur-[2px] dark:bg-gray-50/85',
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3">{core}</div>
        {skeleton === 'list' && <ListSkeleton />}
        {skeleton === 'chat-messages' && <ChatMessagesSkeleton />}
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div
        className={cn(
          'flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16',
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {core}
        {skeleton === 'list' && <ListSkeleton />}
        {skeleton === 'chat-messages' && <ChatMessagesSkeleton />}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center justify-center',
          size === 'lg' ? 'flex-col gap-3 py-12' : 'flex-row gap-0 py-0',
          className
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={showLabel ? undefined : message}
      >
        {core}
        {size === 'lg' && skeleton === 'list' && <ListSkeleton />}
        {size === 'lg' && skeleton === 'chat-messages' && <ChatMessagesSkeleton />}
      </div>
    );
  }

  return null;
}
