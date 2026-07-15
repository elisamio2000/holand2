import { useEffect, useRef } from 'react';

export default function useAutosave(callback: () => Promise<void>, delay = 500) {
  const timer = useRef<number | null>(null);

  function schedule() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { callback(); timer.current = null; }, delay);
  }

  useEffect(() => {
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, []);

  return { schedule };
}
