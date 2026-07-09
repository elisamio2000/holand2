'use client';

import ChatSearchResultsPanel, {
  type ChatSearchTab,
} from '@/app/shared/ai-chat/components/chat-search-results-panel';
import type { ChatSearchResult } from '@/app/shared/ai-chat/hooks/use-chat-search';

interface ChatSidebarSearchResultsProps {
  query: string;
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
  onExpand: () => void;
}

export default function ChatSidebarSearchResults({
  query,
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
  onExpand,
}: ChatSidebarSearchResultsProps) {
  const trimmed = query.trim();
  if (trimmed.length < 1) return null;

  return (
    <ChatSearchResultsPanel
      variant="compact"
      query={query}
      activeTab={activeTab}
      onTabChange={onTabChange}
      sessionResults={sessionResults}
      messageResults={messageResults}
      fileResults={fileResults}
      isSearching={isSearching}
      onSelectSession={onSelectSession}
      onSelectMessage={onSelectMessage}
      onSelectFile={onSelectFile}
      onClear={onClear}
      onExpand={onExpand}
    />
  );
}
