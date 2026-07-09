'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import cn from '@core/utils/class-names';

interface LazyMountProps {
  children: ReactNode;
  className?: string;
  minHeight?: number;
  rootMargin?: string;
}

/** Mount children only when near viewport — avoids N simultaneous media engines. */
export function LazyMount({
  children,
  className,
  minHeight = 120,
  rootMargin = '200px',
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={cn(className)} style={{ minHeight }}>
      {visible ? (
        children
      ) : (
        <div className="flex h-full min-h-[inherit] items-center justify-center rounded-lg border border-dashed border-muted bg-gray-50/50 text-xs text-gray-400 dark:bg-gray-100/5">
          Scroll to load…
        </div>
      )}
    </div>
  );
}
