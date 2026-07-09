'use client';

import { useEffect, useState } from 'react';

/** True when document tab is visible (pause polling when hidden). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}
