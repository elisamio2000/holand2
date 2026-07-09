'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseControlAutoHideOptions {
  isPlaying: boolean;
  enabled?: boolean;
  idleMs?: number;
}

/**
 * Fade chrome while playing; show on mouse move, touch, or pause (Plyr/Vidstack pattern).
 */
export function useControlAutoHide({
  isPlaying,
  enabled = true,
  idleMs = 3000,
}: UseControlAutoHideOptions) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (enabled && isPlaying) {
      timerRef.current = setTimeout(() => setVisible(false), idleMs);
    }
  }, [enabled, idleMs, isPlaying]);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }
    if (!isPlaying) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    reveal();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, isPlaying, reveal]);

  return { controlsVisible: visible, revealControls: reveal };
}
