import { invalidateResourceCacheByPrefix } from '@/hooks/use-resource';

export const WORKSPACE_CACHE_INVALIDATE_EVENT = 'Holand:workspace-cache-invalidate';

/** Broadcast cache invalidation when active workspace changes. */
export function invalidateWorkspaceCaches(): void {
  invalidateResourceCacheByPrefix('ws:');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_CACHE_INVALIDATE_EVENT));
  }
}

export function scopedWorkspaceCacheKey(
  base: string,
  groupId: string | null | undefined
): string {
  return `ws:${groupId ?? 'all'}:${base}`;
}

