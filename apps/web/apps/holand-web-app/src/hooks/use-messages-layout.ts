'use client';

import { atom, useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { useMedia } from '@core/hooks/use-media';

function getInitialListOpen(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= 1024;
}

export const isMessagesListOpenAtom = atom(getInitialListOpen());

export function useMessagesLayout() {
  const [isListOpen, setIsListOpen] = useAtom(isMessagesListOpenAtom);
  const isLgUp = useMedia('(min-width: 1024px)', false);

  const toggleList = () => setIsListOpen((prev) => !prev);
  const openList = () => setIsListOpen(true);
  const closeList = () => setIsListOpen(false);

  /** Close sidebar when viewport shrinks from desktop to mobile. */
  const prevLgUpRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevLgUpRef.current;
    prevLgUpRef.current = isLgUp;
    if (prev === true && !isLgUp) {
      setIsListOpen(false);
    }
  }, [isLgUp, setIsListOpen]);

  return {
    isListOpen,
    setIsListOpen,
    toggleList,
    openList,
    closeList,
  };
}
