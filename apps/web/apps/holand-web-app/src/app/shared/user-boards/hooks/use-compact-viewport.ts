import { useEffect, useState } from 'react';

export type CompactViewportBreakpoint = 'md' | 'lg';

const MAX_WIDTH: Record<CompactViewportBreakpoint, number> = {
  md: 767,
  lg: 1023,
};

function queryFor(breakpoint: CompactViewportBreakpoint) {
  return `(max-width: ${MAX_WIDTH[breakpoint]}px)`;
}

/** True when viewport is below the breakpoint (md: <768px, lg: <1024px). */
export function useCompactViewport(breakpoint: CompactViewportBreakpoint = 'lg'): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(queryFor(breakpoint));
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return compact;
}
