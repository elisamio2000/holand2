'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiQuestionDuotone,
  PiCaretDownBold,
  PiCaretUpBold,
  PiMagnifyingGlassDuotone,
} from 'react-icons/pi';
import { buildOneSearchUrl, type OneSearchPageVariant } from '../utils/search-urls';

interface PeopleAlsoAskProps {
  questions: Array<{ question: string; answer: string; source?: string }>;
  className?: string;
}

export function PeopleAlsoAsk({ questions, className }: PeopleAlsoAskProps) {
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (questions.length === 0) return null;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50', className)}>
      <div className="flex items-center gap-2.5 border-b border-muted px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PiQuestionDuotone className="h-4 w-4" />
        </div>
        <div>
          <Title as="h2" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.peopleAlsoAsk')}
          </Title>
          <Text className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('searchHub.paaSubtitle', { count: questions.length })}
          </Text>
        </div>
      </div>

      <div className="divide-y divide-muted">
        {questions.map((item, index) => {
          const isExpanded = expandedItems.has(index);
          return (
            <div key={index} className="px-4 py-2.5">
              <button
                type="button"
                onClick={() => toggleItem(index)}
                className="flex w-full items-start justify-between gap-2 text-start transition-colors hover:text-primary"
              >
                <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-700">{item.question}</Text>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-200/20">
                  {isExpanded ? (
                    <PiCaretUpBold className="h-3 w-3 text-gray-500" />
                  ) : (
                    <PiCaretDownBold className="h-3 w-3 text-gray-500" />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-1.5 border-s-2 border-primary/25 ps-3">
                  <Text className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{item.answer}</Text>
                  {item.source && (
                    <Text className="text-[11px] text-gray-500 dark:text-gray-400">
                      {t('searchHub.source')}: {item.source}
                    </Text>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RelatedSearchesProps {
  searches: string[];
  query: string;
  pageVariant?: OneSearchPageVariant;
  className?: string;
}

export function RelatedSearches({ searches, query, pageVariant = 'default', className }: RelatedSearchesProps) {
  const { t } = useTranslation();

  if (searches.length === 0) return null;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50', className)}>
      <div className="flex items-center gap-2.5 border-b border-muted px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PiMagnifyingGlassDuotone className="h-4 w-4" />
        </div>
        <div>
          <Title as="h2" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.relatedSearches')}
          </Title>
          <Text className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('searchHub.relatedSearchesSubtitle', { count: searches.length })}
          </Text>
        </div>
      </div>

      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {searches.map((search, index) => {
            const href = buildOneSearchUrl({ q: search, mode: 'all', variant: pageVariant });
            return (
              <Link
                key={index}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-md border border-muted bg-gray-0 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary dark:bg-gray-50 dark:text-gray-700 dark:hover:border-primary/30 dark:hover:bg-primary/10"
              >
                <PiMagnifyingGlassDuotone className="h-3 w-3 shrink-0 opacity-60" />
                {search}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
