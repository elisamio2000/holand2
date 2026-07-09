'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import {
  parseDeployStreamMessage,
  type DeployStreamEvent,
} from '@/services/admin-remote-nodes.service';
import type { DeployStreamStage } from '@/services/deploy-schema-types';
import { getImportWsBaseUrl } from '@/lib/service-urls';

export type NodeDeployStreamMode =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'done'
  | 'error'
  | 'polling';

export interface UseNodeDeployStreamReturn {
  mode: NodeDeployStreamMode;
  currentStage: DeployStreamStage | string | null;
  completedStages: DeployStreamStage[];
  logLines: string[];
  error: string | null;
  servedName: string | null;
  connect: (wsUrl: string) => Promise<boolean>;
  reset: () => void;
  waitForCompletion: (options: {
    wsUrl?: string;
    nodeId: string;
    servedName: string;
    timeoutMs?: number;
  }) => Promise<{ ok: boolean; servedName?: string }>;
}

function resolveDeployWsUrl(wsUrl: string, accessToken: string): string {
  const trimmed = wsUrl.trim();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    const sep = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${sep}access_token=${encodeURIComponent(accessToken)}`;
  }
  const base = getImportWsBaseUrl();
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const url = `${base}${path}`;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}access_token=${encodeURIComponent(accessToken)}`;
}

export function useNodeDeployStream(): UseNodeDeployStreamReturn {
  const [mode, setMode] = useState<NodeDeployStreamMode>('idle');
  const [currentStage, setCurrentStage] = useState<DeployStreamStage | string | null>(null);
  const [completedStages, setCompletedStages] = useState<DeployStreamStage[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [servedName, setServedName] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const doneResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const cleanup = useCallback(() => {
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

  const reset = useCallback(() => {
    cleanup();
    setMode('idle');
    setCurrentStage(null);
    setCompletedStages([]);
    setLogLines([]);
    setError(null);
    setServedName(null);
    doneResolverRef.current = null;
  }, [cleanup]);

  const handleEvent = useCallback((event: DeployStreamEvent) => {
    if (event.stage && event.type === 'stage') {
      setCurrentStage(event.stage);
      setCompletedStages((prev) => {
        const s = event.stage as DeployStreamStage;
        return prev.includes(s) ? prev : [...prev, s];
      });
    }
    if (event.logLine) {
      setLogLines((prev) => [...prev.slice(-199), event.logLine!]);
    }
    if (event.servedName) setServedName(event.servedName);
    if (event.type === 'error') {
      setMode('error');
      setError(event.message ?? 'Deploy failed');
      doneResolverRef.current?.(false);
      doneResolverRef.current = null;
    }
    if (event.type === 'done') {
      setMode('done');
      setCurrentStage('ready');
      setCompletedStages((prev) => (prev.includes('ready') ? prev : [...prev, 'ready']));
      if (event.servedName) setServedName(event.servedName);
      doneResolverRef.current?.(true);
      doneResolverRef.current = null;
    }
  }, []);

  const connect = useCallback(
    async (wsUrl: string): Promise<boolean> => {
      cleanup();
      setMode('connecting');
      setError(null);
      setLogLines([]);
      setCompletedStages([]);
      setCurrentStage(null);

      try {
        const session = await getSession();
        const token = session?.user?.accessToken as string | undefined;
        if (!token) {
          setMode('polling');
          return false;
        }

        const url = resolveDeployWsUrl(wsUrl, token);
        return await new Promise<boolean>((resolve) => {
          const ws = new WebSocket(url);
          wsRef.current = ws;

          ws.onopen = () => {
            setMode('live');
            resolve(true);
          };

          ws.onmessage = (ev) => {
            const parsed = parseDeployStreamMessage(String(ev.data));
            if (parsed) handleEvent(parsed);
          };

          ws.onerror = () => {
            setMode('polling');
            resolve(false);
          };

          ws.onclose = () => {
            wsRef.current = null;
          };
        });
      } catch {
        setMode('polling');
        return false;
      }
    },
    [cleanup, handleEvent]
  );

  const waitForCompletion = useCallback(
    async (options: {
      wsUrl?: string;
      nodeId: string;
      servedName: string;
      timeoutMs?: number;
    }): Promise<{ ok: boolean; servedName?: string }> => {
      const { wsUrl, nodeId, servedName: probeName, timeoutMs = 10 * 60 * 1000 } = options;

      if (wsUrl) {
        const connected = await connect(wsUrl);
        if (connected) {
          const wsResult = await new Promise<boolean>((resolve) => {
            doneResolverRef.current = resolve;
            setTimeout(() => {
              if (doneResolverRef.current) {
                doneResolverRef.current(false);
                doneResolverRef.current = null;
              }
            }, timeoutMs);
          });
          cleanup();
          if (wsResult) {
            return { ok: true, servedName: servedName ?? probeName };
          }
        }
      }

      setMode('polling');
      const { adminRemoteNodesService } = await import('@/services/admin-remote-nodes.service');
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try {
          const probe = await adminRemoteNodesService.probeModel(nodeId, probeName);
          if (probe.ok) {
            setMode('done');
            setCurrentStage('ready');
            return { ok: true, servedName: probeName };
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setMode('error');
      setError('Deploy timed out');
      return { ok: false };
    },
    [cleanup, connect, servedName]
  );

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    mode,
    currentStage,
    completedStages,
    logLines,
    error,
    servedName,
    connect,
    reset,
    waitForCompletion,
  };
}
