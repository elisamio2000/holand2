'use client';

import { Tooltip } from '@/components/tooltip';
import cn from '@core/utils/class-names';

import { useTranslation } from 'react-i18next';
import {
  PiFileTextBold,
  PiTagSimpleBold,
  PiTextTBold,
} from 'react-icons/pi';
import type { MediaMatchKind } from '@/app/shared/one-search/utils/media-hit-meta';

const MATCH_STYLE: Record<
  MediaMatchKind,
  { Icon: typeof PiTextTBold; chip: string; icon: string }
> = {
  transcript: {
    Icon: PiFileTextBold,
    chip:
      'border-violet-200/80 bg-violet-50/90 text-violet-700 dark:border-violet-900/35 dark:bg-violet-950/25 dark:text-violet-300',
    icon: 'text-violet-600 dark:text-violet-400',
  },
  metadata: {
    Icon: PiTagSimpleBold,
    chip:
      'border-sky-200/80 bg-sky-50/90 text-sky-800 dark:border-sky-900/35 dark:bg-sky-950/20 dark:text-sky-300',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  filename: {
    Icon: PiTextTBold,
    chip:
      'border-gray-200/90 bg-gray-50/90 text-gray-600 dark:border-gray-300/20 dark:bg-gray-100/40 dark:text-gray-400',
    icon: 'text-gray-500 dark:text-gray-400',
  },
};

export interface MediaMatchBadgeProps {
  kind: MediaMatchKind;
  /** card = compact on result rows; filter = labels in toolbar filter list */
  variant?: 'card' | 'filter';
  className?: string;
}

/** Why this hit matched the query — transcript text, filename, or other metadata. */
export function MediaMatchBadge({
  kind,
  variant = 'card',
  className,
}: MediaMatchBadgeProps) {
  const { t } = useTranslation();

  if (variant === 'card' && kind === 'filename') {
    return null;
  }

  const { Icon, chip, icon } = MATCH_STYLE[kind];
  const label = t(`searchHub.mediaMatch.short.${kind}`);
  const hint = t(`searchHub.mediaMatch.hint.${kind}`);

  if (variant === 'filter') {
    return <span className={className}>{t(`searchHub.mediaMatch.${kind}`)}</span>;
  }

  return (
    <Tooltip content={hint} placement="top">
      <span
        className={cn(
          'inline-flex max-w-[9rem] shrink-0 items-center gap-1 rounded-full border px-2 py-0.5',
          'text-[10px] font-normal leading-none tracking-normal normal-case',
          chip,
          className
        )}
        aria-label={hint}
      >
        <Icon className={cn('h-3 w-3 shrink-0', icon)} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    </Tooltip>
  );
}
