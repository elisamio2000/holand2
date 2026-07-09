// ============================================
// useFunnelTracking — client hook to instrument the assessment-completion funnel
// Persists a per-browser session id in localStorage and fires funnel events
// to the analytics service without blocking the UI (fire-and-forget).
// ============================================

'use client';

import { useCallback, useMemo } from 'react';
import { analyticsService } from '@/services/analytics.service';

const STORAGE_KEY = 'holand_funnel_session_id';

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId();
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const created = generateSessionId();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}

export function useFunnelTracking() {
  const sessionId = useMemo(getOrCreateSessionId, []);

  const trackStep = useCallback(
    (step: string, eventName: string, durationMs?: number) => {
      analyticsService
        .trackEvent({ session_id: sessionId, event_name: eventName, step, duration_ms: durationMs })
        .catch((error) => {
          // Analytics failures must never break the user-facing flow.
          console.warn('[useFunnelTracking] Failed to track funnel event', {
            error,
            sessionId,
            step,
            eventName,
          });
        });
    },
    [sessionId]
  );

  return { sessionId, trackStep };
}
