'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import {
  adminRemoteNodesService,
  parseGpuStreamMessage,
  type NodeGpuStreamSnapshot,
} from '@/services/admin-remote-nodes.service';
import { buildNodeGpuWsUrl, getReconnectDelay } from '@/utils/node-gpu-websocket';

export interface UseNodeGpuStreamOptions {
  enabled?: boolean;
  fallbackOnDisconnect?: boolean;
}

export interface UseNodeGpuStreamReturn {
  snapshot: NodeGpuStreamSnapshot | null;
  connected: boolean;
  reconnecting: boolean;
  polling: boolean;
  error: Error | null;
  lastUpdate: number;
  refreshOnce: () => Promise<boolean>;
}

const MAX_RECONNECT_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

export function useNodeGpuStream(
  nodeId: string | null,
  options: UseNodeGpuStreamOptions = {}
): UseNodeGpuStreamReturn {
  const { enabled = true, fallbackOnDisconnect = true } = options;

  const [snapshot, setSnapshot] = useState<NodeGpuStreamSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackDoneRef = useRef(false);
  const restOkRef = useRef(false);

  const applySnapshot = useCallback((next: NodeGpuStreamSnapshot) => {
    setSnapshot(next);
    setLastUpdate(Date.now());
    setError(null);
    restOkRef.current = true;
  }, []);

  const refreshOnce = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    try {
      const gpu = await adminRemoteNodesService.getNodeGpu(nodeId);
      applySnapshot({
        devices: gpu.devices,
        summary: gpu.summary,
        ts: new Date().toISOString(),
      });
      setPolling(true);
      return true;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('GPU snapshot failed');
      if (!restOkRef.current) setError(e);
      return false;
    }
  }, [applySnapshot, nodeId]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(() => {
      void refreshOnce();
    }, POLL_INTERVAL_MS);
  }, [refreshOnce, stopPolling]);

  const cleanupSocket = useCallback(() => {
    stopPolling();
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
  }, [stopPolling]);

  const connect = useCallback(async () => {
    if (!enabled || !nodeId || typeof window === 'undefined') return;

    cleanupSocket();

    try {
      const session = await getSession();
      const token = session?.user?.accessToken as string | undefined;
      if (!token) {
        setConnected(false);
        if (fallbackOnDisconnect && !fallbackDoneRef.current) {
          fallbackDoneRef.current = true;
          const ok = await refreshOnce();
          if (ok) startPolling();
        } else if (!restOkRef.current) {
          setError(new Error('No access token'));
        }
        return;
      }

      const url = buildNodeGpuWsUrl(nodeId, token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        fallbackDoneRef.current = false;
        stopPolling();
        setConnected(true);
        setReconnecting(false);
        setPolling(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        const parsed = parseGpuStreamMessage(String(event.data));
        if (parsed) {
          applySnapshot(parsed);
          setPolling(false);
        }
      };

      ws.onerror = () => {
        if (!restOkRef.current) {
          setError(new Error('WebSocket connection error'));
        }
      };

      ws.onclose = async () => {
        setConnected(false);
        wsRef.current = null;

        if (!enabled) return;

        if (fallbackOnDisconnect && !fallbackDoneRef.current) {
          fallbackDoneRef.current = true;
          const ok = await refreshOnce();
          if (ok) {
            setError(null);
            startPolling();
          }
        }

        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(false);
          if (restOkRef.current) {
            setError(null);
            startPolling();
          } else {
            setError(new Error('WebSocket reconnect limit reached'));
          }
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
      setConnected(false);
      if (fallbackOnDisconnect && !fallbackDoneRef.current) {
        fallbackDoneRef.current = true;
        const ok = await refreshOnce();
        if (ok) {
          setError(null);
          startPolling();
        } else if (!restOkRef.current) {
          setError(e);
        }
      } else if (!restOkRef.current) {
        setError(e);
      }
    }
  }, [
    applySnapshot,
    cleanupSocket,
    enabled,
    fallbackOnDisconnect,
    nodeId,
    refreshOnce,
    startPolling,
    stopPolling,
  ]);

  useEffect(() => {
    fallbackDoneRef.current = false;
    restOkRef.current = false;
    if (!enabled || !nodeId) {
      cleanupSocket();
      setConnected(false);
      setReconnecting(false);
      setPolling(false);
      setSnapshot(null);
      return;
    }

    void connect();

    return () => {
      cleanupSocket();
    };
  }, [cleanupSocket, connect, enabled, nodeId]);

  return {
    snapshot,
    connected,
    reconnecting,
    polling,
    error,
    lastUpdate,
    refreshOnce,
  };
}
