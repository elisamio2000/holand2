'use client';

import { useMemo, useState } from 'react';
import type { ChatSearchResult } from '@/app/shared/ai-chat/hooks/use-chat-search';

export type SearchRoleFilter = 'all' | 'user' | 'assistant';

export interface SearchFilters {
  role: SearchRoleFilter;
  hasAttachment: boolean;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  role: 'all',
  hasAttachment: false,
  dateFrom: '',
  dateTo: '',
};

export function useSearchFilters() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const reset = () => setFilters(DEFAULT_FILTERS);

  const applyToMessages = useMemo(
    () =>
      (results: ChatSearchResult[], messagesBySession?: Map<string, { role?: string; created_at?: string; hasAttachment?: boolean }[]>) => {
        return results.filter((r) => {
          if (r.type !== 'message') return true;
          if (filters.hasAttachment) {
            // Client file results already typed as file; for messages we'd need metadata
            return false;
          }
          if (filters.role !== 'all' && messagesBySession) {
            const msgs = messagesBySession.get(r.sessionId);
            const msg = msgs?.find((m) => (m as { id?: string }).id === r.messageId);
            if (msg && (msg as { role?: string }).role !== filters.role) return false;
          }
          return true;
        });
      },
    [filters]
  );

  const backendScope = useMemo((): 'all' | 'titles' | 'messages' | 'files' => {
    if (filters.hasAttachment) return 'files';
    if (filters.role === 'user' || filters.role === 'assistant') return 'messages';
    return 'all';
  }, [filters]);

  return {
    filters,
    setFilters,
    reset,
    applyToMessages,
    backendScope,
    hasActiveFilters:
      filters.role !== 'all' ||
      filters.hasAttachment ||
      Boolean(filters.dateFrom || filters.dateTo),
  };
}
