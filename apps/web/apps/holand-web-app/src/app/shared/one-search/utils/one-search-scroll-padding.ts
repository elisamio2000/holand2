// ============================================
// One Search — main scroll container helpers
// ============================================

const SCROLL_ATTR = 'data-app-main-scroll';
const TOP_PADDING_CLASSES = ['pt-2', '3xl:pt-4'] as const;

export function getAppMainScrollElement(): HTMLElement | null {
  const el = document.querySelector(`[${SCROLL_ATTR}]`);
  return el instanceof HTMLElement ? el : null;
}

/** Hydrogen main scroll container horizontal padding — keep in sync with layouts/hydrogen/layout.tsx */
export const ONE_SEARCH_SCROLL_BLEED_X =
  '-mx-4 md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10';

export const ONE_SEARCH_SCROLL_INSET_X =
  'px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10';

/** Drop layout scroll-container top padding while One Search is mounted. */
export function bindOneSearchScrollPadding(): () => void {
  const el = getAppMainScrollElement();
  if (!el) return () => undefined;

  const prevPaddingTop = el.style.paddingTop;
  el.style.paddingTop = '0px';
  el.classList.remove(...TOP_PADDING_CLASSES);

  return () => {
    el.style.paddingTop = prevPaddingTop;
    if (!prevPaddingTop) {
      el.classList.add(...TOP_PADDING_CLASSES);
    }
  };
}
