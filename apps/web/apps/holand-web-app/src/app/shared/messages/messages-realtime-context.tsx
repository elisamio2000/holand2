'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { UseMessagesRealtimeReturn } from '@/hooks/use-messages-realtime';

const MessagesRealtimeContext = createContext<UseMessagesRealtimeReturn | null>(null);

export function MessagesRealtimeProvider({
  value,
  children,
}: {
  value: UseMessagesRealtimeReturn;
  children: ReactNode;
}) {
  return (
    <MessagesRealtimeContext.Provider value={value}>
      {children}
    </MessagesRealtimeContext.Provider>
  );
}

export function useMessagesRealtimeContext(): UseMessagesRealtimeReturn {
  const ctx = useContext(MessagesRealtimeContext);
  if (!ctx) {
    return {
      connected: false,
      reconnecting: false,
      usingPolling: false,
      error: null,
      wsInfoUnavailable: false,
      lastWsUrl: null,
      lastCloseCode: null,
      sendTyping: () => undefined,
      retryConnection: () => undefined,
    };
  }
  return ctx;
}
