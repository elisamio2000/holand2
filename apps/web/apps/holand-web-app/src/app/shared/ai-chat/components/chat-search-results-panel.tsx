'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import { PiArrowsOut, PiMagnifyingGlass, PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { Loader } from 'rizzui';
import FileTypeIcon from '@/components/file-type-icon';
import HighlightedText from '@/app/shared/ai-chat/search/components/highlighted-text';
import SearchFiltersBar from '@/app/shared/ai-chat/search/components/search-filters-bar';
import type { SearchFilters } from '@/app/shared/ai-chat/search/hooks/use-search-filters';
import { buildOneSearchUrl } from '@/app/shared/one-search/utils/search-urls';
import Link from 'next/link';
import {
  SEARCH_RESULT_LIMIT_COMPACT,
  SEARCH_RESULT_LIMIT_EXPANDED,
  type ChatSearchResult,
  type ChatSearchTab,
} from '@/app/shared/ai-chat/hooks/use-chat-search';

export type { ChatSearchTab };

interface ChatSearchResultsPanelProps {
  variant: 'compact' | 'expanded';
  query: string;
  activeTab: ChatSearchTab;
  onTabChange: (tab: ChatSearchTab) => void;
  sessionResults: ChatSearchResult[];
  messageResults: ChatSearchResult[];
  fileResults: ChatSearchResult[];
  isSearching: boolean;
  onQueryChange?: (query: string) => void;
  onSelectSession: (sessionId: string) => void;
  onSelectMessage: (sessionId: string, messageId: string) => void;
  onSelectFile: (
    sessionId: string,
    artifactId: string | undefined,
    fileName: string | undefined,
    mimeType: string | undefined,
    messageId?: string
  ) => void;
  onClear: () => void;
  onExpand?: () => void;
  onClose?: () => void;
  className?: string;
  searchFilters?: SearchFilters;
  onSearchFiltersChange?: (patch: Partial<SearchFilters>) => void;
  onSearchFiltersReset?: () => void;
  showFilters?: boolean;
}

const TABS: ChatSearchTab[] = ['sessions', 'messages', 'files'];

export default function ChatSearchResultsPanel({
  variant,
  query,
  activeTab,
  onTabChange,
  sessionResults,
  messageResults,
  fileResults,
  isSearching,
  onQueryChange,
  onSelectSession,
  onSelectMessage,
  onSelectFile,
  onClear,
  onExpand,
  onClose,
  className,
  searchFilters,
  onSearchFiltersChange,
  onSearchFiltersReset,
  showFilters = false,
}: ChatSearchResultsPanelProps) {
  const { t } = useTranslation();
  const limit =
    variant === 'expanded' ? SEARCH_RESULT_LIMIT_EXPANDED : SEARCH_RESULT_LIMIT_COMPACT;

  const resultsByTab: Record<ChatSearchTab, ChatSearchResult[]> = {
    sessions: sessionResults.slice(0, limit),
    messages: messageResults.slice(0, limit),
    files: fileResults.slice(0, limit),
  };

  const counts: Record<ChatSearchTab, number> = {
    sessions: sessionResults.length,
    messages: messageResults.length,
    files: fileResults.length,
  };

  const results = resultsByTab[activeTab];
  const isCompact = variant === 'compact';

  const handleSelect = (r: ChatSearchResult) => {
    if (r.type === 'message' && r.messageId) {
      onSelectMessage(r.sessionId, r.messageId);
    } else if (r.type === 'file') {
      onSelectFile(r.sessionId, r.artifactId, r.fileName, r.mimeType, r.messageId);
    } else {
      onSelectSession(r.sessionId);
    }
    onClear();
  };

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden bg-gray-0 dark:bg-gray-50',
        isCompact
          ? 'absolute start-0 end-0 top-full z-50 mt-1 rounded-lg border border-muted shadow-lg'
          : 'rounded-xl border border-muted',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-muted px-2 py-1.5">
        {!isCompact && (
          <>
            <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
            {onQueryChange && (
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={t('chatPage.search.placeholder')}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
                aria-label={t('chatPage.search.title')}
                autoFocus
              />
            )}
          </>
        )}
        <div className={cn('flex gap-0.5', !isCompact && 'ms-auto')}>
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                activeTab === key
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/10'
              )}
            >
              {t(`chatPage.search.tab.${key}`)}
              {counts[key] > 0 && (
                <span className="ms-1 opacity-70">({counts[key]})</span>
              )}
            </button>
          ))}
        </div>
        {isSearching && <Loader size="sm" variant="spinner" className="shrink-0" />}
        {isCompact && onExpand && (
          <Tooltip content={t('chatPage.search.expand')} placement="top">
            <button
              type="button"
              onClick={onExpand}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/20"
              aria-label={t('chatPage.search.expand')}
            >
              <PiArrowsOut className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
        {!isCompact && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-200/20"
            aria-label={t('common.close')}
          >
            <PiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {showFilters && searchFilters && onSearchFiltersChange && onSearchFiltersReset && (
        <SearchFiltersBar
          filters={searchFilters}
          onChange={onSearchFiltersChange}
          onReset={onSearchFiltersReset}
          variant={isCompact ? 'compact' : 'expanded'}
        />
      )}

      <ul
        className={cn(
          'overflow-y-auto py-1',
          isCompact ? 'max-h-52' : 'max-h-[60vh]'
        )}
      >
        {results.length === 0 && !isSearching ? (
          <li className="px-3 py-4 text-center text-xs text-gray-400">
            {t('chatPage.search.noResults')}
          </li>
        ) : (
          results.map((r, i) => (
            <li key={`${r.type}-${r.sessionId}-${r.messageId ?? r.artifactId ?? i}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-start hover:bg-gray-50 dark:hover:bg-gray-200/10"
                onClick={() => handleSelect(r)}
              >
                {r.type === 'file' && (
                  <FileTypeIcon
                    mimeType={r.mimeType}
                    filename={r.fileName}
                    size="sm"
                    className="mt-0.5 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                    {r.type === 'file' ? r.fileName || r.snippet : r.sessionTitle}
                  </span>
                  {r.type === 'session' ? null : r.type === 'message' ? (
                    <HighlightedText
                      text={r.snippet}
                      query={query}
                      className="line-clamp-2 text-[10px] leading-snug text-gray-500"
                      as="span"
                    />
                  ) : (
                    <span className="line-clamp-1 text-[10px] leading-snug text-gray-500">
                      {r.sessionTitle}
                      {r.snippet && r.snippet !== r.fileName ? ` · ${r.snippet}` : ''}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))
        )}
      </ul>

      {query.trim() && (
        <div className="border-t border-muted px-3 py-2">
          <Link
            href={buildOneSearchUrl({ q: query, mode: 'text' })}
            className="text-xs text-primary hover:underline"
            onClick={onClear}
          >
            {t('chatPage.search.searchAllSystem')}
          </Link>
        </div>
      )}
    </div>
  );
}
