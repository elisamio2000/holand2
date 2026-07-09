// ============================================
// useImportQueueWebSocket — Realtime queue updates via WebSocket
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import type { QueueStatusResponse } from '@/types/case-importer.types';
import { caseImporterService } from '@/services/case-importer.service';
import {
  buildImportWsUrl,
  getReconnectDelay,
  parseQueueStatusMessage,
  shouldRefreshQueueFromWsMessage,
} from '@/utils/import-websocket';

export interface UseImportQueueWebSocketOptions {
  enabled?: boolean;
  onQueueUpdate?: (status: QueueStatusResponse) => void;
  /** Debounce REST refetch when WS sends non-snapshot events (ms) */
  invalidateDebounceMs?: number;
  /** Minimum interval between WS-triggered REST invalidation refreshes. */
  minInvalidateRefreshMs?: number;
  /** Skip REST refresh on mount — WS snapshot is enough for dashboard perf */
  skipInitialRest?: boolean;
}

export interface UseImportQueueWebSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  error: Error | null;
  queueStatus: QueueStatusResponse | null;
  lastUpdate: number;
  /** Force REST refresh of queue status */
  refreshQueue: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
}

const MAX_RECONNECT_ATTEMPTS = 8;

export function useImportQueueWebSocket(
  options: UseImportQueueWebSocketOptions = {}
): UseImportQueueWebSocketReturn {
  const {
    enabled = true,
    onQueueUpdate,
    invalidateDebounceMs = 300,
    minInvalidateRefreshMs = 15000,
    skipInitialRest = true,
  } = options;

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidateRefreshAtRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const onQueueUpdateRef = useRef(onQueueUpdate);
  onQueueUpdateRef.current = onQueueUpdate;

  const applyQueueStatus = useCallback((status: QueueStatusResponse) => {
    setQueueStatus(status);
    setLastUpdate(Date.now());
    onQueueUpdateRef.current?.(status);
  }, []);

  /**
   * REST fallback refresh for queue status.
   *
   * - Dedupe: repeated calls reuse in-flight request.
   * - Force mode: aborts previous request and starts a new one.
   */
  const refreshQueue = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const silent = options?.silent ?? true;
      const force = options?.force ?? false;

      if (force && refreshAbortRef.current) {
        try {
          refreshAbortRef.current.abort();
        } catch {
          /* ignore */
        }
      } else if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      const controller = new AbortController();
      refreshAbortRef.current = controller;

      const task = (async () => {
        try {
          const status = await caseImporterService.getQueueStatus({
            signal: controller.signal,
          });
          applyQueueStatus(status);
          setError(null);
        } catch (err: unknown) {
          if ((err as { name?: string })?.name === 'CanceledError') {
            return;
          }
          const e = err instanceof Error ? err : new Error('Failed to refresh queue');
          if (!silent) {
            console.error('[useImportQueueWebSocket] Queue refresh failed:', e);
          }
          setError(e);
        } finally {
          if (refreshInFlightRef.current === task) {
            refreshInFlightRef.current = null;
          }
          if (refreshAbortRef.current === controller) {
            refreshAbortRef.current = null;
          }
        }
      })();

      refreshInFlightRef.current = task;
      return task;
    },
    [applyQueueStatus]
  );

  const scheduleInvalidateRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastInvalidateRefreshAtRef.current < minInvalidateRefreshMs) {
      return;
    }
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      lastInvalidateRefreshAtRef.current = Date.now();
      void refreshQueue();
    }, invalidateDebounceMs);
  }, [invalidateDebounceMs, minInvalidateRefreshMs, refreshQueue]);

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
    if (refreshAbortRef.current) {
      try {
        refreshAbortRef.current.abort();
      } catch {
        /* ignore */
      }
      refreshAbortRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') return;

    cleanupSocket();

    try {
      const session = await getSession();
      const token = session?.user?.accessToken as string | undefined;
      if (!token) {
        setConnected(false);
        setError(new Error('No access token'));
        return;
      }

      const url = buildImportWsUrl('queue', { accessToken: token });
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info('[useImportQueueWebSocket] Connected');
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setReconnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        const raw = String(event.data);
        const parsed = parseQueueStatusMessage(raw);
        if (parsed) {
          applyQueueStatus(parsed);
        } else {
          // Avoid flooding REST fallback for non-state WS events (heartbeat/ping/ack).
          if (shouldRefreshQueueFromWsMessage(raw)) {
            scheduleInvalidateRefresh();
          }
        }
      };

      ws.onerror = () => {
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (!enabled) return;

        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(false);
          setError(new Error('WebSocket reconnect limit reached'));
          return;
        }

        setReconnecting(true);
        const delay = getReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          void connect();
        }, delay);
      };
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('WebSocket setup failed');
      setError(e);
      setConnected(false);
    }
  }, [applyQueueStatus, cleanupSocket, enabled, scheduleInvalidateRefresh]);

  useEffect(() => {
    if (!enabled) {
      cleanupSocket();
      setConnected(false);
      setReconnecting(false);
      return;
    }

    void connect();
    if (!skipInitialRest) {
      void refreshQueue();
    }

    return () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
      cleanupSocket();
    };
  }, [cleanupSocket, connect, enabled, refreshQueue, skipInitialRest]);

  return {
    connected,
    reconnecting,
    error,
    queueStatus,
    lastUpdate,
    refreshQueue,
  };
}
