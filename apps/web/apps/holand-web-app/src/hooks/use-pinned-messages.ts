'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const PINNED_KEY = 'messages-pinned';

type PinnedStore = Record<string, string[]>;

export function usePinnedMessages(threadId: string | null) {
  const [store, setStore] = useState<PinnedStore>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      if (raw) setStore(JSON.parse(raw) as PinnedStore);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: PinnedStore) => {
    setStore(next);
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const pinnedIds = useMemo(
    () => (threadId ? store[threadId] ?? [] : []),
    [threadId, store]
  );

  const isPinned = useCallback(
    (messageId: string) => pinnedIds.includes(messageId),
    [pinnedIds]
  );

  const togglePin = useCallback(
    (messageId: string) => {
      if (!threadId) return;
      const current = store[threadId] ?? [];
      const next = current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId];
      persist({ ...store, [threadId]: next });
    },
    [persist, store, threadId]
  );

  return { pinnedIds, isPinned, togglePin };
}
