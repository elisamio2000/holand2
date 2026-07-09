import {
  invalidateResourceCache,
  invalidateResourceCacheByPrefix,
} from '@/hooks/use-resource';

/** Invalidate in-memory resource cache entries matching prefix (or all projects keys). */
export function invalidateProjectsCache(prefix?: string): void {
  if (typeof window === 'undefined') return;

  if (!prefix || prefix === 'all') {
    invalidateResourceCacheByPrefix('projects:');
    invalidateResourceCacheByPrefix('tasks:');
  } else {
    invalidateResourceCacheByPrefix(prefix);
    invalidateResourceCache(prefix);
  }

  window.dispatchEvent(new CustomEvent('projects-cache-invalidate', { detail: { prefix: prefix ?? 'all' } }));
}

export function invalidateAllProjectsData(): void {
  invalidateProjectsCache('all');
}
