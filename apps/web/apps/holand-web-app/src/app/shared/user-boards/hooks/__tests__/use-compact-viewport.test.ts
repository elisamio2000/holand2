/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompactViewport } from '../use-compact-viewport';

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(ev: MediaQueryListEvent) => void>();

  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_: string, cb: (ev: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_: string, cb: (ev: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
    dispatch(changeTo: boolean) {
      matches = changeTo;
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };

  vi.stubGlobal('matchMedia', (query: string) => {
    void query;
    return mql;
  });

  return mql;
}

describe('useCompactViewport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when media query matches (lg)', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useCompactViewport('lg'));
    expect(result.current).toBe(true);
  });

  it('returns false when media query does not match (lg)', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCompactViewport('lg'));
    expect(result.current).toBe(false);
  });

  it('updates when matchMedia changes', () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useCompactViewport('md'));
    expect(result.current).toBe(false);

    act(() => {
      mql.dispatch(true);
    });
    expect(result.current).toBe(true);
  });
});
