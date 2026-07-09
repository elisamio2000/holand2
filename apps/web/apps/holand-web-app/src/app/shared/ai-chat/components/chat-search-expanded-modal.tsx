'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ChatSearchResultsPanel, {
  type ChatSearchTab,
} from '@/app/shared/ai-chat/components/chat-search-results-panel';
import type { ChatSearchResult } from '@/app/shared/ai-chat/hooks/use-chat-search';

interface ChatSearchExpandedModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  activeTab: ChatSearchTab;
  onTabChange: (tab: ChatSearchTab) => void;
  sessionResults: ChatSearchResult[];
  messageResults: ChatSearchResult[];
  fileResults: ChatSearchResult[];
  isSearching: boolean;
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
  searchFilters?: import('@/app/shared/ai-chat/search/hooks/use-search-filters').SearchFilters;
  onSearchFiltersChange?: (
    patch: Partial<import('@/app/shared/ai-chat/search/hooks/use-search-filters').SearchFilters>
  ) => void;
  onSearchFiltersReset?: () => void;
}

export default function ChatSearchExpandedModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  activeTab,
  onTabChange,
  sessionResults,
  messageResults,
  fileResults,
  isSearching,
  onSelectSession,
  onSelectMessage,
  onSelectFile,
  onClear,
  searchFilters,
  onSearchFiltersChange,
  onSearchFiltersReset,
}: ChatSearchExpandedModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/40 px-4 pt-[10vh] max-lg:inset-0 max-lg:items-stretch max-lg:bg-gray-0 max-lg:px-0 max-lg:pt-safe dark:max-lg:bg-gray-50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl shadow-2xl max-lg:max-w-none max-lg:flex max-lg:h-full max-lg:flex-col max-lg:shadow-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('chatPage.search.expandedTitle')}
      >
        <ChatSearchResultsPanel
          variant="expanded"
          query={query}
          activeTab={activeTab}
          onTabChange={onTabChange}
          sessionResults={sessionResults}
          messageResults={messageResults}
          fileResults={fileResults}
          isSearching={isSearching}
          onQueryChange={onQueryChange}
          onSelectSession={onSelectSession}
          onSelectMessage={onSelectMessage}
          onSelectFile={onSelectFile}
          onClear={onClear}
          onClose={onClose}
          showFilters
          searchFilters={searchFilters}
          onSearchFiltersChange={onSearchFiltersChange}
          onSearchFiltersReset={onSearchFiltersReset}
          className="max-lg:h-full max-lg:rounded-none max-lg:border-0"
        />
      </div>
    </div>,
    document.body
  );
}
