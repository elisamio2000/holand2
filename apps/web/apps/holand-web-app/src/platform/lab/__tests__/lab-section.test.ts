import { describe, it, expect, beforeEach, vi } from 'vitest';
import { labChecklistStorageKey } from '../lab-section';

describe('labChecklistStorageKey', () => {
  it('namespaces by module and section', () => {
    expect(labChecklistStorageKey('media-players', 'gallery-audio')).toBe(
      'lab-checklist:media-players:gallery-audio'
    );
  });
});

describe('LabSection checklist persistence', () => {
  beforeEach(() => {
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
    });
  });

  it('uses parameterized storage key format', () => {
    const key = labChecklistStorageKey('one-search', 's1');
    localStorage.setItem(key, JSON.stringify({ a1: true }));
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ a1: true });
  });
});
