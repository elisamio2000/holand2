// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEventMock = vi.fn();

vi.mock('@/services/analytics.service', () => ({
  analyticsService: {
    trackEvent: (...args: unknown[]) => trackEventMock(...args),
  },
}));

import { useFunnelTracking } from './use-funnel-tracking';

describe('useFunnelTracking', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        clear: () => store.clear(),
      },
      configurable: true,
    });
    window.localStorage.clear();
    trackEventMock.mockReset();
    trackEventMock.mockResolvedValue({});
  });

  it('creates and persists a session id', () => {
    const { result } = renderHook(() => useFunnelTracking());
    const first = result.current.sessionId;
    expect(first).toBeTruthy();
    expect(window.localStorage.getItem('holand_funnel_session_id')).toBe(first);
  });

  it('tracks funnel step with session id', async () => {
    const { result } = renderHook(() => useFunnelTracking());

    await act(async () => {
      result.current.trackStep('start', 'assessment_module_opened', 123);
    });

    expect(trackEventMock).toHaveBeenCalledWith({
      session_id: result.current.sessionId,
      event_name: 'assessment_module_opened',
      step: 'start',
      duration_ms: 123,
    });
  });
});
