'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MediaChromePortalProps {
  /** When set, chrome renders into this container (e.g. modal body). */
  container: HTMLElement | null;
  children: React.ReactNode;
}

/**
 * Portals player chrome without unmounting the session media element host.
 */
export function MediaChromePortal({ container, children }: MediaChromePortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !container) return null;
  return createPortal(children, container);
}
