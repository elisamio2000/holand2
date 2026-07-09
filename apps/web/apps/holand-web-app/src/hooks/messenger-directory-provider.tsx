'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserSummary } from '@/types/messages.types';
import {
  getMessengerDirectorySnapshot,
  registerDirectoryUserIds,
  subscribeMessengerDirectoryUpdates,
} from './use-messenger-user-directory';

const MessengerDirectoryContext = createContext<Map<string, UserSummary> | null>(null);

export function MessengerDirectoryProvider({ children }: { children: ReactNode }) {
  const [directory, setDirectory] = useState(() => getMessengerDirectorySnapshot());

  useEffect(() => subscribeMessengerDirectoryUpdates(() => {
    setDirectory(getMessengerDirectorySnapshot());
  }), []);

  return (
    <MessengerDirectoryContext.Provider value={directory}>
      {children}
    </MessengerDirectoryContext.Provider>
  );
}

export function useMessengerDirectoryContext(): Map<string, UserSummary> {
  const ctx = useContext(MessengerDirectoryContext);
  return ctx ?? getMessengerDirectorySnapshot();
}

export function useRegisterDirectoryUserIds(userIds: string[]): void {
  const stableKey = useMemo(() => [...new Set(userIds)].sort().join(','), [userIds]);
  useEffect(() => {
    if (!stableKey) return;
    registerDirectoryUserIds(stableKey.split(',').filter(Boolean));
  }, [stableKey]);
}

export function useMessengerUserDirectory(userIds: string[]) {
  useRegisterDirectoryUserIds(userIds);
  return useMessengerDirectoryContext();
}
