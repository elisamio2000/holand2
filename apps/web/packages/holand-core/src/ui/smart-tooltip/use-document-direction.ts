'use client';

import { useEffect, useState } from 'react';
import type { TextDirection } from '../floating/types';

/**
 * Tracks `document.documentElement.dir` so floating UI stays aligned with i18n language switches.
 */
export function useDocumentDirection(): TextDirection {
  const [direction, setDirection] = useState<TextDirection>('ltr');

  useEffect(() => {
    const readDirection = () => {
      setDirection(document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr');
    };

    readDirection();

    const observer = new MutationObserver(readDirection);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
    });

    return () => observer.disconnect();
  }, []);

  return direction;
}
