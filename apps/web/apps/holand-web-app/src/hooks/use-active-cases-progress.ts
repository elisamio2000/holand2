// ============================================
// useActiveCasesProgress — WebSocket progress for multiple active cases (list view)
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import {
  buildImportWsUrl,
  parseCaseProgressMessage,
  type CaseProgressUpdate,
} from '@/utils/import-websocket';

const MAX_CASE_CONNECTIONS = 5;

export interface UseActiveCasesProgressOptions {
  caseIds: string[];
  enabled?: boolean;
  onProgress: (update: CaseProgressUpdate) => void;
}

export interface UseActiveCasesProgressReturn {
  /** True when at least one per-case WebSocket is open (realtime is truly live). */
  anyConnected: boolean;
  /** Number of currently open per-case WebSocket connections. */
  connectedCount: number;
}

/**
 * Manage up to MAX_CASE_CONNECTIONS WebSocket clients for active case rows.
 *
 * Exposes real connection state so the list can choose the correct refresh
 * strategy: rely on WebSocket when truly connected, otherwise fall back to
 * faster REST polling (so progress bars keep updating even when WS is blocked).
 *
 * Connections are only re-synced when the SET of active case IDs changes
 * (not on every progress message), preventing reconnect churn.
 */
export function useActiveCasesProgress(
  options: UseActiveCasesProgressOptions
): UseActiveCasesProgressReturn {
  const { caseIds, enabled = true, onProgress } = options;
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  // Track live connection identities to derive a stable "anyConnected" flag.
  const connectedIdsRef = useRef<Set<string>>(new Set());
  const [connectedCount, setConnectedCount] = useState(0);

  const markConnected = useCallback((id: string) => {
    if (!connectedIdsRef.current.has(id)) {
      connectedIdsRef.current.add(id);
      setConnectedCount(connectedIdsRef.current.size);
    }
  }, []);

  const markDisconnected = useCallback((id: string) => {
    if (connectedIdsRef.current.delete(id)) {
      setConnectedCount(connectedIdsRef.current.size);
    }
  }, []);

  // Stable content key so the effect only re-runs when the active ID set changes.
  const idsKey = [...caseIds].sort().join(',');
  const caseIdsRef = useRef(caseIds);
  caseIdsRef.current = caseIds;

  useEffect(() => {
    const sockets = socketsRef.current;
    if (!enabled || typeof window === 'undefined') {
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      });
      sockets.clear();
      connectedIdsRef.current.clear();
      setConnectedCount(0);
      return;
    }

    let cancelled = false;

    const syncConnections = async () => {
      const session = await getSession();
      const token = session?.user?.accessToken as string | undefined;
      if (!token || cancelled) return;

      const targetIds = caseIdsRef.current.slice(0, MAX_CASE_CONNECTIONS);
      const targetSet = new Set(targetIds);

      for (const [id, ws] of socketsRef.current.entries()) {
        if (!targetSet.has(id)) {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          socketsRef.current.delete(id);
          markDisconnected(id);
        }
      }

      for (const caseId of targetIds) {
        if (socketsRef.current.has(caseId)) continue;

        try {
          const url = buildImportWsUrl('case', { id: caseId, accessToken: token });
          const ws = new WebSocket(url);

          ws.onopen = () => {
            markConnected(caseId);
          };

          ws.onmessage = (event) => {
            const update = parseCaseProgressMessage(String(event.data), caseId);
            if (update) onProgressRef.current(update);
          };

          ws.onerror = () => {
            markDisconnected(caseId);
          };

          ws.onclose = () => {
            markDisconnected(caseId);
            if (socketsRef.current.get(caseId) === ws) {
              socketsRef.current.delete(caseId);
            }
          };

          socketsRef.current.set(caseId, ws);
        } catch (err) {
          console.warn('[useActiveCasesProgress] Failed to connect:', { caseId, err });
        }
      }
    };

    void syncConnections();

    return () => {
      cancelled = true;
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      });
      sockets.clear();
      connectedIdsRef.current.clear();
      setConnectedCount(0);
    };
  }, [idsKey, enabled, markConnected, markDisconnected]);

  return {
    anyConnected: connectedCount > 0,
    connectedCount,
  };
}

