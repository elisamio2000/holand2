'use client';

import { useEffect, useRef } from 'react';
import type { UseAudioStickyAnchorOptions } from '../types';
import { useAudioPlayerStore } from '../store/audio-player-store';
/**
 * Wires a scroll anchor to the global sticky bar:
 * - IntersectionObserver → surfaceVisible
 * - Registers remote control handlers (no second playback engine)
 */
export function useAudioStickyAnchor(options: UseAudioStickyAnchorOptions) {
  const {
    enabled,
    sessionId,
    anchorRef,
    anchorKey,
    stickyLayout,
    queueIndex = -1,
    queueLength = 0,
    handlers,
    threshold = 0.15,
    rootMargin = '0px',
  } = options;

  const updateSession = useAudioPlayerStore((s) => s.updateSession);
  const registerStickyControls = useAudioPlayerStore((s) => s.registerStickyControls);
  const clearStickyControls = useAudioPlayerStore((s) => s.clearStickyControls);
  const setSurfaceVisible = useAudioPlayerStore((s) => s.setSurfaceVisible);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !sessionId) {
      updateSession({ stickyEnabled: false });
      clearStickyControls();
      return;
    }

    updateSession({
      activeId: sessionId,
      stickyEnabled: true,
      stickyLayout,
      queueIndex,
      queueLength,
    });

    registerStickyControls({
      togglePlay: () => handlersRef.current.togglePlay?.(),
      seekTo: (seconds) => handlersRef.current.seekTo?.(seconds),
      onPrev: () => handlersRef.current.onPrev?.(),
      onNext: () => handlersRef.current.onNext?.(),
      onVolumeChange: (vol) => handlersRef.current.onVolumeChange?.(vol),
    });

    return () => {
      clearStickyControls();
      updateSession({ stickyEnabled: false, surfaceVisible: true });
    };
  }, [
    enabled,
    sessionId,
    stickyLayout,
    queueIndex,
    queueLength,
    updateSession,
    registerStickyControls,
    clearStickyControls,
  ]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setSurfaceVisible(true);
      return;
    }

    const el = anchorRef.current;
    if (!el) {
      setSurfaceVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setSurfaceVisible(entry.isIntersecting),
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, sessionId, anchorRef, anchorKey, threshold, rootMargin, setSurfaceVisible]);
}
