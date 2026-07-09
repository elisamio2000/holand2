// ============================================
// useStagingUploadWebSocket — Staging session upload progress via WebSocket
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import {
  buildImportWsUrl,
  getReconnectDelay,
  parseStagingUploadMessage,
  type StagingUploadUpdate,
} from '@/utils/import-websocket';

export interface UseStagingUploadWebSocketOptions {
  enabled?: boolean;
  onProgress?: (update: StagingUploadUpdate) => void;
}

export interface UseStagingUploadWebSocketReturn {
  connected: boolean;
  progress: StagingUploadUpdate | null;
  error: Error | null;
}

const MAX_RECONNECT_ATTEMPTS = 4;

export function useStagingUploadWebSocket(
  sessionId: string | null,
  options: UseStagingUploadWebSocketOptions = {}
): UseStagingUploadWebSocketReturn {
  const { enabled = true, onProgress } = options;

  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState<StagingUploadUpdate | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

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
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !sessionId || typeof window === 'undefined') return;

    cleanupSocket();

    try {
      const session = await getSession();
      const token = session?.user?.accessToken as string | undefined;
      if (!token) {
        setConnected(false);
        setError(new Error('No access token'));
        return;
      }

      const url = buildImportWsUrl('staging', { id: sessionId, accessToken: token });
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        const update = parseStagingUploadMessage(String(event.data), sessionId);
        if (update) {
          setProgress(update);
          onProgressRef.current?.(update);
        }
      };

      ws.onerror = () => {
        setError(new Error('Staging upload WebSocket error'));
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (!enabled || !sessionId) return;
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) return;

        const delay = getReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          void connect();
        }, delay);
      };
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('WebSocket setup failed'));
      setConnected(false);
    }
  }, [cleanupSocket, enabled, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      cleanupSocket();
      setConnected(false);
      setProgress(null);
      return;
    }

    void connect();
    return () => cleanupSocket();
  }, [cleanupSocket, connect, enabled, sessionId]);

  return { connected, progress, error };
}
