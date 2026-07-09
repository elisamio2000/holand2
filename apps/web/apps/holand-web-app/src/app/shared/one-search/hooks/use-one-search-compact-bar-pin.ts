'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { getAppMainScrollElement } from '@/app/shared/one-search/utils/one-search-scroll-padding';

export interface OneSearchCompactBarPinState {
  active: boolean;
  style: CSSProperties;
  placeholderHeight: number;
}

/** Pin compact bar with position:fixed once it scrolls past the scroll container top. */
export function useOneSearchCompactBarPin(enabled: boolean): {
  sentinelRef: RefObject<HTMLDivElement>;
  barRef: RefObject<HTMLDivElement>;
  pin: OneSearchCompactBarPinState;
} {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState<OneSearchCompactBarPinState>({
    active: false,
    style: {},
    placeholderHeight: 0,
  });

  const update = useCallback(() => {
    if (!enabled) {
      setPin({ active: false, style: {}, placeholderHeight: 0 });
      return;
    }

    const scrollEl = getAppMainScrollElement();
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!scrollEl || !sentinel || !bar) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();
    const barHeight = bar.getBoundingClientRect().height;
    const active = sentinelRect.top < scrollRect.top - 0.5;

    setPin({
      active,
      style: active
        ? {
            position: 'fixed',
            top: scrollRect.top,
            left: scrollRect.left,
            width: scrollRect.width,
            zIndex: 80,
          }
        : {},
      placeholderHeight: active ? barHeight : 0,
    });
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) return;

    update();
    const raf = requestAnimationFrame(update);

    const scrollEl = getAppMainScrollElement();
    if (!scrollEl) return () => cancelAnimationFrame(raf);

    scrollEl.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);
    if (barRef.current) ro.observe(barRef.current);

    const sentinel = sentinelRef.current;
    const io =
      sentinel &&
      new IntersectionObserver(() => update(), {
        root: scrollEl,
        threshold: [0, 1],
      });
    if (io && sentinel) io.observe(sentinel);

    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
      io?.disconnect();
    };
  }, [enabled, update]);

  return { sentinelRef, barRef, pin };
}
