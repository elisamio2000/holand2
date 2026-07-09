/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  addVideoBookmark,
  bookmarksStorageKey,
  readVideoBookmarks,
  writeVideoBookmarks,
} from '@/components/video-player/utils/bookmarks-storage';

describe('bookmarks-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
  });

  it('reads and writes bookmarks per artifact', () => {
    writeVideoBookmarks('art-1', [10, 20]);
    expect(readVideoBookmarks('art-1')).toEqual([10, 20]);
    expect(bookmarksStorageKey('art-1')).toContain('art-1');
  });

  it('dedupes on add', () => {
    addVideoBookmark('art-2', 5);
    addVideoBookmark('art-2', 5);
    expect(readVideoBookmarks('art-2')).toEqual([5]);
  });
});
