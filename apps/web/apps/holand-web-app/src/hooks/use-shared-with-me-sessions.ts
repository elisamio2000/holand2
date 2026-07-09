'use client';

import { useCallback, useEffect, useState } from 'react';
import { chatService } from '@/services/chat.service';
import type { SharedWithMeSession } from '@/types/chat.types';

export function useSharedWithMeSessions(enabled = true) {
  const [sessions, setSessions] = useState<SharedWithMeSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSessions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await chatService.listSharedWithMe();
      setSessions(list);
    } catch (err) {
      setError(err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, isLoading, error, refresh };
}
