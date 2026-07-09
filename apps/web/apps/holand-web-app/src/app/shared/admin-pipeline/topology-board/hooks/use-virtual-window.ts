'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface VirtualWindowRange {
  start: number;
  end: number;
  offsetY: number;
  totalHeight: number;
}

const DEFAULT_OVERSCAN = 6;

/** Lightweight windowing for long lists without extra dependencies. */
export function useVirtualWindow(
  itemCount: number,
  itemHeight: number,
  scrollRef: RefObject<HTMLElement | null>,
  overscan = DEFAULT_OVERSCAN
): VirtualWindowRange {
  const [range, setRange] = useState<VirtualWindowRange>({
    start: 0,
    end: Math.min(itemCount, 30),
    offsetY: 0,
    totalHeight: itemCount * itemHeight,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const start = Math.floor(el.scrollTop / itemHeight);
      const visible = Math.ceil(el.clientHeight / itemHeight);
      const from = Math.max(0, start - overscan);
      const to = Math.min(itemCount, start + visible + overscan);
      setRange({
        start: from,
        end: to,
        offsetY: from * itemHeight,
        totalHeight: itemCount * itemHeight,
      });
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [itemCount, itemHeight, overscan, scrollRef]);

  return range;
}
