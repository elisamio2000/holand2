'use client';

import { useTranslation } from 'react-i18next';
import { PiCaretDown, PiCaretUp, PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface InThreadFindBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  matchIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  className?: string;
}

export default function InThreadFindBar({
  query,
  onQueryChange,
  matchIndex,
  total,
  onNext,
  onPrev,
  onClose,
  className,
}: InThreadFindBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-muted bg-gray-0/95 px-3 py-2 backdrop-blur dark:bg-gray-50/95',
        className
      )}
      role="search"
      aria-label={t('chatPage.inThreadFind.title')}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('chatPage.inThreadFind.placeholder')}
        className="min-w-0 flex-1 rounded-md border border-muted bg-transparent px-2 py-1 text-sm outline-none focus:border-primary"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span className="shrink-0 text-xs text-gray-500">
        {total > 0
          ? t('chatPage.inThreadFind.count', { current: matchIndex + 1, total })
          : t('chatPage.inThreadFind.noMatches')}
      </span>
      <button
        type="button"
        onClick={onPrev}
        disabled={total === 0}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-200/20"
        aria-label={t('chatPage.inThreadFind.prev')}
      >
        <PiCaretUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={total === 0}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-200/20"
        aria-label={t('chatPage.inThreadFind.next')}
      >
        <PiCaretDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20"
        aria-label={t('common.close')}
      >
        <PiX className="h-4 w-4" />
      </button>
    </div>
  );
}
