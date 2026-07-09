'use client';

import { useCallback, useEffect, useState } from 'react';

const STARRED_KEY = 'messages-starred-ids';

export function useStarredMessages() {
  const [starred, setStarred] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STARRED_KEY);
      if (raw) setStarred(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setStarred(next);
    try {
      localStorage.setItem(STARRED_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleStar = useCallback(
    (id: string) => {
      const next = new Set(starred);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
    },
    [persist, starred]
  );

  const isStarred = useCallback((id: string) => starred.has(id), [starred]);

  return { starred, toggleStar, isStarred };
}
