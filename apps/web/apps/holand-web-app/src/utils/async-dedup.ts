/**
 * Coalesce concurrent async calls and optionally cache results for a short TTL.
 * Used by messenger list/detail and user-directory batch resolve.
 */

const inFlight = new Map<string, Promise<unknown>>();

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const resultCache = new Map<string, CacheEntry<unknown>>();

export function dedupeAsync<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/**
 * Returns a cached result when still fresh; otherwise runs fn (deduped while in-flight).
 */
export function cachedAsync<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const now = Date.now();
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value as T);
  }

  return dedupeAsync(key, async () => {
    const value = await fn();
    resultCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

export function clearDedupeKey(key: string): void {
  inFlight.delete(key);
  resultCache.delete(key);
}

/** Invalidate cached entries whose key starts with prefix (e.g. `messenger:list:`). */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of resultCache.keys()) {
    if (key.startsWith(prefix)) resultCache.delete(key);
  }
}

export function clearAllAsyncCache(): void {
  inFlight.clear();
  resultCache.clear();
}
