'use client';

import { useEffect } from 'react';

const MAIN_SCROLL_SELECTOR = '[data-app-main-scroll]';

/**
 * Hydrogen main scroll uses pt-2 / 3xl:pt-4. Sticky ProfileSettingsNav at top-0
 * leaves that padding visible as a gap while scrolling. Zero top padding on the
 * scroll container for profile-settings routes only (same fix as DevTools).
 */
export default function ProfileSettingsScrollFlush({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(MAIN_SCROLL_SELECTOR);
    if (!scrollEl) return;

    scrollEl.dataset.profileSettingsFlush = 'true';
    scrollEl.style.paddingTop = '0';

    return () => {
      delete scrollEl.dataset.profileSettingsFlush;
      scrollEl.style.removeProperty('padding-top');
    };
  }, []);

  return <>{children}</>;
}
