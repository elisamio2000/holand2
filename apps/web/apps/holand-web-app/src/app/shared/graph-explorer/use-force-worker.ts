// ============================================
// useForceWorker — Hook for Web Worker force simulation
// Manages lifecycle of the D3 force Web Worker
// ============================================

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  WorkerInMessage,
  WorkerOutMessage,
  WorkerNodeData,
  WorkerLinkData,
} from './graph-worker.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForceWorkerConfig {
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  alphaDecay?: number;
  velocityDecay?: number;
}

export interface ForceWorkerCallbacks {
  /** Called on each simulation tick with updated node positions */
  onTick: (positions: Map<string, { x: number; y: number }>, alpha: number) => void;
  /** Called when simulation has fully converged */
  onDone?: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useForceWorker — Offload D3 force simulation to a Web Worker.
 *
 * Creates and manages a Web Worker that runs force simulation off the main
 * thread. Provides methods to init, update config, pin/unpin nodes, and
 * stop/resume the simulation.
 *
 * WHY: For graphs > 1K nodes, D3 force on the main thread causes ~15ms+ per
 * tick, dropping FPS below 30. The worker keeps the main thread free for
 * rendering at 60fps.
 *
 * NOTE: The worker is only created when `enabled` is true, so small graphs
 * can bypass the worker overhead entirely.
 *
 * @param enabled - Whether to use the worker (false = use built-in force)
 * @param callbacks - Tick and done callbacks
 * @returns Worker control methods
 *
 * @example
 * ```tsx
 * const { initWorker, pinNode, stopWorker } = useForceWorker(
 *   nodeCount > 1000,
 *   { onTick: (positions) => updateNodePositions(positions) }
 * );
 * ```
 */
export function useForceWorker(
  enabled: boolean,
  callbacks: ForceWorkerCallbacks
) {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef(callbacks);
  const [isRunning, setIsRunning] = useState(false);

  // Keep callbacks ref updated without restarting worker
  callbacksRef.current = callbacks;

  // ─── Create/destroy worker ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      // Clean up if switching from enabled to disabled
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        setIsRunning(false);
      }
      return;
    }

    try {
      // WHY URL constructor: webpack/Next.js can resolve worker imports this way
      const worker = new Worker(
        new URL('./graph-force.worker.ts', import.meta.url)
      );

      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;

        if (msg.type === 'tick') {
          const positions = new Map<string, { x: number; y: number }>();
          for (let i = 0; i < msg.nodeIds.length; i++) {
            positions.set(msg.nodeIds[i], {
              x: msg.positions[i * 2],
              y: msg.positions[i * 2 + 1],
            });
          }
          callbacksRef.current.onTick(positions, msg.alpha);
        } else if (msg.type === 'done') {
          setIsRunning(false);
          callbacksRef.current.onDone?.();
        }
      };

      worker.onerror = (error) => {
        console.error('[useForceWorker] Worker error:', error);
        setIsRunning(false);
      };

      workerRef.current = worker;
      console.info('[useForceWorker] Worker created');
    } catch (error) {
      console.error('[useForceWorker] Failed to create worker:', error);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        setIsRunning(false);
        console.info('[useForceWorker] Worker terminated');
      }
    };
  }, [enabled]);

  // ─── Post message helper ────────────────────────────────────────────────
  const postMessage = useCallback((msg: WorkerInMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  // ─── Public API ─────────────────────────────────────────────────────────

  const initWorker = useCallback(
    (nodes: WorkerNodeData[], links: WorkerLinkData[], config: ForceWorkerConfig) => {
      if (!workerRef.current) return;

      console.info('[useForceWorker] Initializing simulation:', {
        nodes: nodes.length,
        links: links.length,
      });

      postMessage({
        type: 'init',
        nodes,
        links,
        config: {
          chargeStrength: config.chargeStrength,
          linkDistance: config.linkDistance,
          collisionRadius: config.collisionRadius,
          alphaDecay: config.alphaDecay ?? 0.0228,
          velocityDecay: config.velocityDecay ?? 0.4,
        },
      });

      setIsRunning(true);
    },
    [postMessage]
  );

  const updateConfig = useCallback(
    (config: Partial<ForceWorkerConfig>) => {
      postMessage({ type: 'updateConfig', config });
    },
    [postMessage]
  );

  const pinNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      postMessage({ type: 'pin', nodeId, x, y });
    },
    [postMessage]
  );

  const unpinNode = useCallback(
    (nodeId: string) => {
      postMessage({ type: 'unpin', nodeId });
    },
    [postMessage]
  );

  const stopWorker = useCallback(() => {
    postMessage({ type: 'stop' });
    setIsRunning(false);
  }, [postMessage]);

  const resumeWorker = useCallback(() => {
    postMessage({ type: 'resume' });
    setIsRunning(true);
  }, [postMessage]);

  const reheatWorker = useCallback(
    (alpha?: number) => {
      postMessage({ type: 'reheat', alpha });
      setIsRunning(true);
    },
    [postMessage]
  );

  return {
    initWorker,
    updateConfig,
    pinNode,
    unpinNode,
    stopWorker,
    resumeWorker,
    reheatWorker,
    isRunning,
    isAvailable: enabled && workerRef.current !== null,
  };
}
