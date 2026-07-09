import { BOOKMARKS_STORAGE_PREFIX } from '../constants';

export function bookmarksStorageKey(artifactId: string): string {
  return `${BOOKMARKS_STORAGE_PREFIX}${artifactId}`;
}

export function readVideoBookmarks(artifactId: string): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(bookmarksStorageKey(artifactId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  } catch {
    return [];
  }
}

export function writeVideoBookmarks(artifactId: string, times: number[]): void {
  if (typeof window === 'undefined') return;
  const unique = [...new Set(times.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b);
  localStorage.setItem(bookmarksStorageKey(artifactId), JSON.stringify(unique));
}

export function addVideoBookmark(artifactId: string, timeSec: number): number[] {
  const next = [...readVideoBookmarks(artifactId), timeSec];
  writeVideoBookmarks(artifactId, next);
  return readVideoBookmarks(artifactId);
}
