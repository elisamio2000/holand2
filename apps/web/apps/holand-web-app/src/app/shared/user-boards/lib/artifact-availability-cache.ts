const TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { ok: boolean; at: number }>();

export function getCachedAvailability(artifactId: string): boolean | undefined {
  const hit = cache.get(artifactId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(artifactId);
    return undefined;
  }
  return hit.ok;
}

export function setCachedAvailability(artifactId: string, ok: boolean): void {
  cache.set(artifactId, { ok, at: Date.now() });
}

export function invalidateAvailabilityCache(artifactId?: string): void {
  if (artifactId) cache.delete(artifactId);
  else cache.clear();
}
