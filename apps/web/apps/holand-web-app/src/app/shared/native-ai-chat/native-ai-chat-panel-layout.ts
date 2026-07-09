// ============================================
// Smart placement for floating native AI panel (viewport + FAB rect)
// ============================================

import { clampFabPosition, clampNativePanelSize, type FabPos } from './native-ai-chat-bridge';

export type PanelPlacement = { top: number; left: number };

/** Above StickyHeader (z-[990]/z-[9999]); below global modals when needed. */
export const NATIVE_CHAT_PANEL_Z_INDEX = 10000;
export const NATIVE_CHAT_FAB_Z_INDEX = 10000;

const FAB = 56;
const GAP = 10;

/**
 * Place a fixed panel near the FAB so it stays mostly on-screen.
 * Tries below → above → to the right → to the left of the FAB center.
 */
export function computeSmartPanelPosition(
  fabRect: DOMRect,
  panelWidth: number,
  panelHeight: number,
  vw: number,
  vh: number,
  margin = 8
): PanelPlacement {
  const maxW = Math.min(panelWidth, vw - margin * 2);
  const maxH = Math.min(panelHeight, vh - margin * 2);
  const fabCx = fabRect.left + fabRect.width / 2;

  const centerHoriz = (top: number): PanelPlacement => {
    let left = fabCx - maxW / 2;
    left = Math.max(margin, Math.min(left, vw - maxW - margin));
    return { top, left };
  };

  const spaceBelow = vh - fabRect.bottom - margin;
  const spaceAbove = fabRect.top - margin;
  const spaceEnd = vw - fabRect.right - margin;
  const spaceStart = fabRect.left - margin;

  if (spaceBelow >= maxH * 0.35) {
    return centerHoriz(Math.min(fabRect.bottom + GAP, vh - maxH - margin));
  }
  if (spaceAbove >= maxH * 0.35) {
    return centerHoriz(Math.max(margin, fabRect.top - GAP - maxH));
  }
  if (spaceEnd >= maxW * 0.4) {
    return {
      top: Math.max(margin, Math.min(fabRect.top, vh - maxH - margin)),
      left: Math.min(fabRect.right + GAP, vw - maxW - margin),
    };
  }
  if (spaceStart >= maxW * 0.4) {
    return {
      top: Math.max(margin, Math.min(fabRect.top, vh - maxH - margin)),
      left: Math.max(margin, fabRect.left - GAP - maxW),
    };
  }
  // Fallback: top-left of viewport with clamp
  return { top: margin, left: margin };
}

/** Keep a fixed-position panel fully inside the viewport. */
export function clampPanelPlacement(
  pos: PanelPlacement,
  panelW: number,
  panelH: number,
  vw: number,
  vh: number,
  margin = 8
): PanelPlacement {
  const w = Math.min(panelW, vw - margin * 2);
  const h = Math.min(panelH, vh - margin * 2);
  return {
    left: Math.max(margin, Math.min(pos.left, vw - w - margin)),
    top: Math.max(margin, Math.min(pos.top, vh - h - margin)),
  };
}

/**
 * Resize from the bottom-start corner (visual bottom-left in LTR).
 * The opposite anchor (top-end / top-right) stays fixed on screen.
 */
export function resizePanelFromBottomStart(
  origin: PanelPlacement & { width: number; height: number },
  dw: number,
  dh: number,
  vw: number,
  vh: number,
  margin = 8
): { placement: PanelPlacement; size: { width: number; height: number } } {
  const size = clampNativePanelSize(origin.width - dw, origin.height + dh, vw, vh);
  const right = origin.left + origin.width;
  const top = origin.top;
  let left = right - size.width;
  let nextTop = top;
  const placement = clampPanelPlacement({ left, top: nextTop }, size.width, size.height, vw, vh, margin);
  return { placement, size };
}

export { FAB as NATIVE_CHAT_FAB_SIZE_PX };

/**
 * After closing the panel, place the FAB adjacent to where the panel header was
 * (typically top-end of the panel), then clamp to the viewport.
 */
export function computeFabRestoreNearPanel(
  panelRect: DOMRect,
  fabSize: number,
  vw: number,
  vh: number,
  margin: number
): FabPos {
  const headerH = Math.min(56, Math.max(40, panelRect.height * 0.12));
  const candidates: FabPos[] = [
    { left: panelRect.right - fabSize - margin, top: panelRect.top + margin },
    { left: panelRect.right - fabSize - margin, top: panelRect.top + headerH - fabSize },
    { left: panelRect.left + margin, top: panelRect.top + margin },
    { left: panelRect.left + panelRect.width / 2 - fabSize / 2, top: panelRect.top - fabSize - margin },
    { left: panelRect.right - fabSize - margin, top: panelRect.bottom - fabSize - margin },
  ];
  for (const c of candidates) {
    const clamped = clampFabPosition(c, fabSize, vw, vh, margin);
    if (Math.abs(clamped.left - c.left) < 2 && Math.abs(clamped.top - c.top) < 2) {
      return clamped;
    }
  }
  return clampFabPosition(candidates[0], fabSize, vw, vh, margin);
}
