'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit, OneSearchLaneId } from '@/types/one-search.types';
import { ChatCard, CaseCard, FileCard, UserCard, GraphCard } from '../result-cards';

export interface TextSearchViewProps {
  results: Array<OneSearchHit & { lane: OneSearchLaneId }>;
  className?: string;
}

export function TextSearchView({ results, className }: TextSearchViewProps) {
  const { t } = useTranslation();

  if (results.length === 0) {
    return (
      <div className={cn('py-20 text-center', className)}>
        <p className="text-gray-500 dark:text-gray-400">
          {t('searchHub.noResults')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {results.map((result) => {
        const key = result.id;
        
        switch (result.lane) {
          case 'chat':
            return <ChatCard key={key} data={result} />;
          case 'cases':
            return <CaseCard key={key} data={result} />;
          case 'files':
            return <FileCard key={key} data={result} />;
          case 'storage':
            return <FileCard key={key} data={result} />;
          case 'users':
            return <UserCard key={key} data={result} />;
          case 'graph':
            return <GraphCard key={key} data={result} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
