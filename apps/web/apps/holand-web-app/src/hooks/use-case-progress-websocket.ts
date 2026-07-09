// ============================================
// useCaseProgressWebSocket — Per-case import progress via WebSocket
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import {
  buildImportWsUrl,
  getReconnectDelay,
  parseCaseProgressMessage,
  type CaseProgressUpdate,
} from '@/utils/import-websocket';

export interface UseCaseProgressWebSocketOptions {
  enabled?: boolean;
  onProgress?: (update: CaseProgressUpdate) => void;
}

export interface UseCaseProgressWebSocketReturn {
  connected: boolean;
  progress: CaseProgressUpdate | null;
  error: Error | null;
}

const MAX_RECONNECT_ATTEMPTS = 6;

export function useCaseProgressWebSocket(
  caseId: string | null,
  options: UseCaseProgressWebSocketOptions = {}
): UseCaseProgressWebSocketReturn {
  const { enabled = true, onProgress } = options;

  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState<CaseProgressUpdate | null>(null);
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
    if (!enabled || !caseId || typeof window === 'undefined') return;

    cleanupSocket();

    try {
      const session = await getSession();
      const token = session?.user?.accessToken as string | undefined;
      if (!token) {
        setConnected(false);
        setError(new Error('No access token'));
        return;
      }

      const url = buildImportWsUrl('case', { id: caseId, accessToken: token });
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        const update = parseCaseProgressMessage(String(event.data), caseId);
        if (update) {
          setProgress(update);
          onProgressRef.current?.(update);
        }
      };

      ws.onerror = () => {
        setError(new Error('Case progress WebSocket error'));
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (!enabled || !caseId) return;
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError(new Error('Case progress WebSocket reconnect limit reached'));
          return;
        }

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
  }, [caseId, cleanupSocket, enabled]);

  useEffect(() => {
    if (!enabled || !caseId) {
      cleanupSocket();
      setConnected(false);
      setProgress(null);
      return;
    }

    void connect();
    return () => cleanupSocket();
  }, [caseId, cleanupSocket, connect, enabled]);

  return { connected, progress, error };
}
