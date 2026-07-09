'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import { messagesService } from '@/services/messages.service';
import {
  buildMessengerWsUrl,
  getReconnectDelay,
  parseMessengerWsEvent,
  type MessengerWsChannel,
  type MessengerWsInfo,
} from '@/utils/messenger-websocket';

export interface RealtimeConfig {
  enabled: boolean;
  pollingInterval: number;
  fallbackPollingInterval: number;
}

export interface RealtimeMessage {
  type: 'new_message' | 'message_updated' | 'message_deleted' | 'typing' | 'presence' | 'read_receipt';
  data: unknown;
}

export type MessagesRealtimeMode = 'mailbox' | 'people';

export interface UseMessagesRealtimeOptions {
  mode: MessagesRealtimeMode;
  partnerId?: string | null;
  onEvent: (msg: RealtimeMessage) => void;
  enabled?: boolean;
}

export interface UseMessagesRealtimeReturn {
  connected: boolean;
  reconnecting: boolean;
  usingPolling: boolean;
  error: Error | null;
  wsInfoUnavailable: boolean;
  lastWsUrl: string | null;
  lastCloseCode: number | null;
  sendTyping: (isTyping: boolean) => void;
  retryConnection: () => void;
}

const DEFAULT_CONFIG: RealtimeConfig = {
  enabled:
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_MESSAGES_REALTIME !== 'false',
  pollingInterval: Number(process.env.NEXT_PUBLIC_MESSAGES_POLL_MS ?? 60000),
  fallbackPollingInterval: Number(process.env.NEXT_PUBLIC_MESSAGES_POLL_FALLBACK_MS ?? 120000),
};

const MAX_RECONNECT_ATTEMPTS = 3;
const WS_DISABLED_SESSION_KEY = 'messages-ws-disabled-session';

function isAuthCloseCode(code: number): boolean {
  return code === 1008 || code === 4001 || code === 4401 || code === 4403;
}

function isWsDisabledForSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(WS_DISABLED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function disableWsForSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(WS_DISABLED_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

async function loadFreshAccessToken(): Promise<string | null> {
  const session = await getSession();
  if ((session?.user as { error?: string } | undefined)?.error === 'RefreshTokenExpired') {
    return null;
  }
  return (session?.user?.accessToken as string | undefined) ?? null;
}

export function useMessagesRealtime({
  mode,
  partnerId = null,
  onEvent,
  enabled = DEFAULT_CONFIG.enabled,
}: UseMessagesRealtimeOptions): UseMessagesRealtimeReturn {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [usingPolling, setUsingPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [wsInfoUnavailable, setWsInfoUnavailable] = useState(
    () => messagesService.isWsInfoUnavailable() || isWsDisabledForSession()
  );
  const [lastWsUrl, setLastWsUrl] = useState<string | null>(null);
  const [lastCloseCode, setLastCloseCode] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsInfoRef = useRef<MessengerWsInfo | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectRef = useRef<(() => Promise<void>) | null>(null);
  const wsDisabledRef = useRef(wsInfoUnavailable);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const channel: MessengerWsChannel =
    mode === 'people' && partnerId ? 'partner' : 'inbox';

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setUsingPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    setUsingPolling(true);
    const interval = wsDisabledRef.current
      ? DEFAULT_CONFIG.fallbackPollingInterval
      : DEFAULT_CONFIG.pollingInterval;
    pollingTimerRef.current = setInterval(() => {
      onEventRef.current({ type: 'new_message', data: { polling: true } });
    }, interval);
  }, []);

  const disableRealtimeWs = useCallback(() => {
    wsDisabledRef.current = true;
    disableWsForSession();
    setWsInfoUnavailable(true);
    wsInfoRef.current = null;
    reconnectAttemptRef.current = MAX_RECONNECT_ATTEMPTS;
  }, []);

  const cleanupSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const loadWsInfo = useCallback(async (): Promise<MessengerWsInfo | null> => {
    if (wsDisabledRef.current || messagesService.isWsInfoUnavailable()) {
      setWsInfoUnavailable(true);
      return null;
    }
    if (wsInfoRef.current) return wsInfoRef.current;
    try {
      const info = (await messagesService.getWsInfo()) as MessengerWsInfo;
      wsInfoRef.current = info;
      setWsInfoUnavailable(false);
      return info;
    } catch (err) {
      console.warn('[MessagesRealtime] ws-info unavailable, using polling only', err);
      wsInfoRef.current = null;
      disableRealtimeWs();
      return null;
    }
  }, [disableRealtimeWs]);

  const connect = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') return;
    if (channel === 'partner' && !partnerId) return;
    if (wsDisabledRef.current || isWsDisabledForSession()) {
      disableRealtimeWs();
      startPolling();
      return;
    }

    cleanupSocket();
    stopPolling();

    try {
      const token = await loadFreshAccessToken();
      if (!token) {
        setError(new Error('No access token for messenger WebSocket'));
        startPolling();
        return;
      }

      const info = await loadWsInfo();
      if (!info && wsDisabledRef.current) {
        setError(new Error('Messenger WebSocket unavailable (ws-info failed)'));
        startPolling();
        return;
      }

      const url = buildMessengerWsUrl(info, channel, {
        partnerId: partnerId ?? undefined,
        accessToken: token,
      });
      setLastWsUrl(url);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info('[MessagesRealtime] Connected', { channel, partnerId });
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setReconnecting(false);
        setError(null);
        stopPolling();

        if (channel === 'partner' && partnerId) {
          ws.send(JSON.stringify({ type: 'subscribe', partnerId }));
        } else {
          ws.send(JSON.stringify({ type: 'subscribe', channel: 'inbox' }));
        }
      };

      ws.onmessage = (event) => {
        const parsed = parseMessengerWsEvent(String(event.data));
        if (parsed) onEventRef.current(parsed);
      };

      ws.onerror = () => {
        console.error('[MessagesRealtime] WebSocket error');
        setError(new Error('Messenger WebSocket error'));
      };

      ws.onclose = (event) => {
        console.info('[MessagesRealtime] WebSocket closed', {
          code: event.code,
          reason: event.reason,
        });
        setLastCloseCode(event.code);
        wsRef.current = null;
        setConnected(false);

        if (isAuthCloseCode(event.code)) {
          wsInfoRef.current = null;
        }

        if (wsDisabledRef.current || reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(false);
          disableRealtimeWs();
          console.warn('[MessagesRealtime] WS disabled for session — using polling only');
          startPolling();
          return;
        }

        setReconnecting(true);
        const delay = getReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current?.();
        }, delay);
      };
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Messenger WebSocket setup failed');
      setError(e);
      disableRealtimeWs();
      startPolling();
    }
  }, [
    channel,
    cleanupSocket,
    disableRealtimeWs,
    enabled,
    loadWsInfo,
    partnerId,
    startPolling,
    stopPolling,
  ]);

  connectRef.current = connect;

  useEffect(() => {
    if (!enabled) {
      cleanupSocket();
      stopPolling();
      return;
    }

    if (channel === 'partner' && !partnerId) {
      cleanupSocket();
      stopPolling();
      return;
    }

    if (wsDisabledRef.current || isWsDisabledForSession()) {
      disableRealtimeWs();
      startPolling();
      return () => {
        stopPolling();
      };
    }

    void connect();

    return () => {
      cleanupSocket();
      stopPolling();
    };
  }, [
    enabled,
    channel,
    partnerId,
    connect,
    cleanupSocket,
    disableRealtimeWs,
    startPolling,
    stopPolling,
  ]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN || !partnerId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          partnerId,
          isTyping,
        })
      );
    },
    [partnerId]
  );

  const retryConnection = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(WS_DISABLED_SESSION_KEY);
      } catch {
        /* ignore */
      }
    }
    messagesService.resetWsInfoUnavailable();
    wsDisabledRef.current = false;
    reconnectAttemptRef.current = 0;
    wsInfoRef.current = null;
    setWsInfoUnavailable(false);
    stopPolling();
    void connect();
  }, [connect, stopPolling]);

  return {
    connected,
    reconnecting,
    usingPolling,
    error,
    wsInfoUnavailable,
    lastWsUrl,
    lastCloseCode,
    sendTyping,
    retryConnection,
  };
}
