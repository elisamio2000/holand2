/**
 * Platform z-index tiers (documented anchors — keep in sync with layout modules).
 *
 * Tooltips use {@link resolveTooltipZIndexFromStack}: max(MIN, triggerStack + 1).
 */
export const PLATFORM_Z_INDEX = {
  /** Sticky header layouts (hydrogen/carbon override) */
  stickyHeader: 990,
  /** Popovers, dropdowns, drawer chrome */
  overlayChrome: 9999,
  /** Native AI chat panel / FAB */
  floatingPanel: 10000,
  /** Selection quote toolbar and similar contextual floats */
  contextualFloat: 10001,
} as const;

/** Floor for portaled tooltips when trigger has no positioned ancestor. */
export const TOOLTIP_Z_INDEX_MIN = PLATFORM_Z_INDEX.overlayChrome;

/**
 * Resolves tooltip z-index from the trigger's ancestor stack.
 *
 * Algorithm: max(TOOLTIP_Z_INDEX_MIN, effectiveStackZ + 1)
 * — one layer above the trigger's stacking context, never below overlay chrome.
 */
export function resolveTooltipZIndexFromStack(stackZ: number): number {
  return Math.max(TOOLTIP_Z_INDEX_MIN, stackZ + 1);
}

/**
 * Walks ancestors and returns the highest explicit `z-index` on the path.
 * Used because portaled tooltips are outside the trigger's DOM subtree.
 */
export function getEffectiveStackZIndex(node: HTMLElement | null): number {
  if (!node || typeof window === 'undefined') {
    return 0;
  }

  let max = 0;
  let current: HTMLElement | null = node;

  while (current && current !== document.documentElement) {
    const { zIndex } = window.getComputedStyle(current);
    if (zIndex !== 'auto') {
      const parsed = Number.parseInt(zIndex, 10);
      if (!Number.isNaN(parsed) && parsed > max) {
        max = parsed;
      }
    }
    current = current.parentElement;
  }

  return max;
}

/**
 * Computes tooltip z-index for a live trigger element.
 */
export function resolveTooltipZIndex(trigger: HTMLElement | null): number {
  return resolveTooltipZIndexFromStack(getEffectiveStackZIndex(trigger));
}
