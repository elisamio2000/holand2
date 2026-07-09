import { warnVideoEngineRegistryLeak } from './dev-invariants';

const LEAK_WARN_THRESHOLD = 50;

/**
 * One video engine per MPS session — survives inline ↔ modal chrome handoff.
 * Cleared when the session is destroyed.
 */
export interface RegisteredVideoEngine {
  destroy: (resetMedia?: boolean) => void;
  getState: () => unknown;
}

const engines = new Map<string, RegisteredVideoEngine>();

export const videoEngineRegistry = {
  get(sessionId: string): RegisteredVideoEngine | undefined {
    return engines.get(sessionId);
  },

  set(sessionId: string, engine: RegisteredVideoEngine): void {
    engines.set(sessionId, engine);
    warnVideoEngineRegistryLeak(engines.size, LEAK_WARN_THRESHOLD);
  },

  clear(sessionId: string, resetMedia = false): void {
    const engine = engines.get(sessionId);
    if (engine) {
      try {
        engine.destroy(resetMedia);
      } catch {
        /* noop */
      }
    }
    engines.delete(sessionId);
  },

  has(sessionId: string): boolean {
    return engines.has(sessionId);
  },
};
