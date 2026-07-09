import { useMemo, useState } from 'react';

export function useVirtualWindow<T>(items: T[], itemHeight: number, viewportHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);

  const { start, end, offsetY, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight;
    const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 4;
    const endIdx = Math.min(items.length, startIdx + visibleCount);
    return {
      start: startIdx,
      end: endIdx,
      offsetY: startIdx * itemHeight,
      totalHeight: total,
    };
  }, [items.length, itemHeight, viewportHeight, scrollTop]);

  const slice = useMemo(() => items.slice(start, end), [items, start, end]);

  return {
    slice,
    start,
    offsetY,
    totalHeight,
    onScroll: (top: number) => setScrollTop(top),
  };
}
