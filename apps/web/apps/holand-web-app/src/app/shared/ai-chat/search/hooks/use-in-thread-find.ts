'use client';

import { useMemo, useState } from 'react';
import type { UIMessage } from '@/types/chat.types';

export interface InThreadMatch {
  messageId: string;
  index: number;
  snippet: string;
}

export function findInThreadMatches(messages: UIMessage[], query: string): InThreadMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: InThreadMatch[] = [];
  messages.forEach((msg, index) => {
    const content = (msg.content || msg.streamContent || '').toLowerCase();
    if (content.includes(q)) {
      matches.push({
        messageId: msg.id,
        index,
        snippet: (msg.content || msg.streamContent || '').slice(0, 80),
      });
    }
  });
  return matches;
}

export function useInThreadFind(messages: UIMessage[]) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const matches = useMemo(
    () => findInThreadMatches(messages, query),
    [messages, query]
  );

  const activeMatch = matches[activeMatchIndex] ?? null;

  const open = () => setIsOpen(true);
  const close = () => {
    setIsOpen(false);
    setQuery('');
    setActiveMatchIndex(0);
  };

  const next = () => {
    if (matches.length === 0) return null;
    const nextIdx = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(nextIdx);
    return matches[nextIdx];
  };

  const prev = () => {
    if (matches.length === 0) return null;
    const nextIdx = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(nextIdx);
    return matches[nextIdx];
  };

  return {
    query,
    setQuery,
    isOpen,
    open,
    close,
    matches,
    activeMatch,
    activeMatchIndex,
    setActiveMatchIndex,
    next,
    prev,
    total: matches.length,
  };
}
