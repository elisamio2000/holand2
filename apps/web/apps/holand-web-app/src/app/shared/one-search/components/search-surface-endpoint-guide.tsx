'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  ENDPOINT_GUIDE_DOC_PATH,
  SURFACE_ENDPOINT_GUIDE,
  type SurfaceEndpointStatus,
} from '@/app/shared/one-search/config/surface-endpoint-guide';
import type { OneSearchMode } from '@/types/one-search.types';

export type SearchSurfaceEndpointGuideVariant = 'default' | 'advanced' | 'compact';

export interface SearchSurfaceEndpointGuideProps {
  mode: OneSearchMode;
  variant?: SearchSurfaceEndpointGuideVariant;
  className?: string;
}

const STATUS_COLOR: Record<SurfaceEndpointStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  live: 'success',
  resolved: 'success',
  workaround: 'warning',
  binding: 'danger',
  missing: 'danger',
  optional: 'info',
};

export default function SearchSurfaceEndpointGuide({
  mode,
  variant = 'default',
  className,
}: SearchSurfaceEndpointGuideProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const bullets = SURFACE_ENDPOINT_GUIDE[mode] ?? [];

  if (variant === 'compact') {
    const missing = bullets.filter((b) => b.status === 'missing').length;
    const workaround = bullets.filter((b) => b.status === 'workaround').length;
    const binding = bullets.filter((b) => b.status === 'binding').length;
    const resolved = bullets.filter((b) => b.status === 'resolved').length;
    return (
      <p className={cn('text-[11px] text-gray-500 dark:text-gray-400', className)}>
        {t('searchHub.surfaceGuide.compactLine', {
          live: bullets.filter((b) => b.status === 'live').length,
          resolved,
          workaround,
          binding,
          missing,
        })}
      </p>
    );
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-muted bg-gray-0/60 dark:bg-gray-100/30',
        variant === 'advanced' ? 'mt-6 p-4' : 'mt-6 p-3 @md:p-4',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-start"
        aria-expanded={open}
      >
        <div>
          <Title as="h4" className="text-xs font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.surfaceGuide.title', { mode: t(`searchHub.modes.${mode}`) })}
          </Title>
          <Text className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {t('searchHub.surfaceGuide.subtitle')}
          </Text>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-primary">
          {open ? t('searchHub.surfaceGuide.collapse') : t('searchHub.surfaceGuide.expand')}
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {bullets.map((bullet) => (
            <li
              key={`${bullet.endpoint}-${bullet.noteKey}`}
              className="flex flex-wrap items-start gap-2 rounded-md border border-muted/60 px-2 py-1.5"
            >
              <Badge color={STATUS_COLOR[bullet.status]} rounded="md" className="text-[10px]">
                {t(`searchHub.surfaceGuide.status.${bullet.status}`)}
              </Badge>
              <span className="font-mono text-[10px] text-gray-700 dark:text-gray-300">
                {bullet.endpoint}
              </span>
              <span className="w-full text-[11px] text-gray-500 dark:text-gray-400">
                {t(`searchHub.surfaceGuide.bullets.${bullet.noteKey}`)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Text className="mt-3 font-mono text-[10px] text-gray-400">{ENDPOINT_GUIDE_DOC_PATH}</Text>
    </section>
  );
}
