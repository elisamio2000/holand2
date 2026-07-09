// ============================================
// trace-cache — in-memory cache for trace API responses
// Prevents N+1 GET /traces/{id} when multiple components load the same trace.
// ============================================

import { traceService } from '@/services/trace.service';
import type { TraceDetail } from '@/types/chat.types';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;

interface CacheEntry {
  data: TraceDetail;
  fetchedAt: number;
}

const traceCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<TraceDetail>>();

function cacheKey(traceId: string, full: boolean): string {
  return `${traceId}:${full ? 'full' : 'summary'}`;
}

function pruneIfNeeded(): void {
  if (traceCache.size <= MAX_ENTRIES) return;
  const sorted = [...traceCache.entries()].sort(
    (a, b) => (a[1].fetchedAt ?? 0) - (b[1].fetchedAt ?? 0)
  );
  const removeCount = traceCache.size - MAX_ENTRIES;
  for (let i = 0; i < removeCount; i++) {
    traceCache.delete(sorted[i][0]);
  }
}

/**
 * Fetch trace detail with session-scoped in-memory deduplication.
 */
export async function getCachedTrace(traceId: string, full = true): Promise<TraceDetail> {
  const key = cacheKey(traceId, full);
  const cached = traceCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = traceService
    .getTrace(traceId, full)
    .then((data) => {
      traceCache.set(key, { data, fetchedAt: Date.now() });
      pruneIfNeeded();
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, request);
  return request;
}

/** Drop cached trace (e.g. after session delete). */
export function invalidateTraceCache(traceId?: string): void {
  if (!traceId) {
    traceCache.clear();
    inflight.clear();
    return;
  }
  for (const key of traceCache.keys()) {
    if (key.startsWith(`${traceId}:`)) traceCache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(`${traceId}:`)) inflight.delete(key);
  }
}
