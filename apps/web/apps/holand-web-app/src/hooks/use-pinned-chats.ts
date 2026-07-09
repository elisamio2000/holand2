'use client';

import { useCallback, useEffect, useState } from 'react';

const PINNED_CHATS_KEY = 'messages-pinned-chats';
const MAX_PINNED = 5;

export function usePinnedChats() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_CHATS_KEY);
      if (stored) {
        setPinnedIds(new Set(JSON.parse(stored) as string[]));
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(PINNED_CHATS_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  }, []);

  const togglePin = useCallback((partnerId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        if (next.size >= MAX_PINNED) {
          const oldest = Array.from(next)[0];
          next.delete(oldest);
        }
        next.add(partnerId);
      }
      persist(next);
      return next;
    });
  }, [persist]);

  const isPinned = useCallback((partnerId: string) => {
    return pinnedIds.has(partnerId);
  }, [pinnedIds]);

  return {
    pinnedIds,
    togglePin,
    isPinned,
    maxPinned: MAX_PINNED,
  };
}
