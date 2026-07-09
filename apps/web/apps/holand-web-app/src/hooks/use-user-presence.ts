/**
 * useUserPresence — manage the current user's presence/status.
 *
 * Persists to localStorage; when backend is ready, sync via
 * POST /tools/plugin_user_messenger_/execute { action: 'set_presence', status }.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserPresenceStatus } from '@/app/shared/messages/components/user-status-picker';

const STORAGE_KEY = 'user-presence-status';

export function useUserPresence() {
  const [status, setStatusState] = useState<UserPresenceStatus>(() => {
    if (typeof window === 'undefined') return 'online';
    return (localStorage.getItem(STORAGE_KEY) as UserPresenceStatus) ?? 'online';
  });

  const setStatus = useCallback((next: UserPresenceStatus) => {
    setStatusState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
    // TODO(backend): POST /tools/plugin_user_messenger_/execute
    //   { action: 'set_presence', status: next }
  }, []);

  // Restore on mount in case of SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as UserPresenceStatus | null;
    if (stored && stored !== status) setStatusState(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, setStatus };
}
