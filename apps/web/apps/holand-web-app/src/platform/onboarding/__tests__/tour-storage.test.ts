import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTourStorage } from '../tour-storage';

describe('createTourStorage', () => {
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

  it('tracks seen state', () => {
    const storage = createTourStorage('test-tour');
    expect(storage.hasSeen()).toBe(false);
    storage.markSeen();
    expect(storage.hasSeen()).toBe(true);
    storage.reset();
    expect(storage.hasSeen()).toBe(false);
  });
});
