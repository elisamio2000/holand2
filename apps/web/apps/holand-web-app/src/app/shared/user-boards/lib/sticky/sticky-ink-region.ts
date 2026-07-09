import type { StickyInkLayout, StickyInkRegion } from '../board-types';

export const STICKY_HEADER_H = 22;

export const DEFAULT_STICKY_INK_REGION: StickyInkRegion = {
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  layout: 'overlay',
};

const MIN_FRAC = 0.12;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Clamp region fractions to sane bounds. */
export function normalizeStickyInkRegion(region?: StickyInkRegion | null): StickyInkRegion {
  if (!region) return { ...DEFAULT_STICKY_INK_REGION };
  const w = Math.max(MIN_FRAC, clamp01(region.w));
  const h = Math.max(MIN_FRAC, clamp01(region.h));
  const x = clamp01(region.x);
  const y = clamp01(region.y);
  return {
    x: Math.min(x, 1 - w),
    y: Math.min(y, 1 - h),
    w,
    h,
    layout: region.layout ?? 'overlay',
  };
}

export interface StickyBodyRects {
  bodyW: number;
  bodyH: number;
  ink: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number; w: number; h: number };
  textBehindInk: boolean;
}

/** Pixel rects for ink canvas and text area within the sticky body. */
export function resolveStickyBodyRects(bodyW: number, bodyH: number, region: StickyInkRegion): StickyBodyRects {
  const r = normalizeStickyInkRegion(region);
  const bw = Math.max(1, bodyW);
  const bh = Math.max(1, bodyH);

  switch (r.layout) {
    case 'wrap-start': {
      const inkW = Math.max(MIN_FRAC, r.w) * bw;
      return {
        bodyW: bw,
        bodyH: bh,
        ink: { x: 0, y: 0, w: inkW, h: bh },
        text: { x: inkW, y: 0, w: bw - inkW, h: bh },
        textBehindInk: false,
      };
    }
    case 'wrap-end': {
      const inkW = Math.max(MIN_FRAC, r.w) * bw;
      return {
        bodyW: bw,
        bodyH: bh,
        text: { x: 0, y: 0, w: bw - inkW, h: bh },
        ink: { x: bw - inkW, y: 0, w: inkW, h: bh },
        textBehindInk: false,
      };
    }
    case 'block-below': {
      const inkH = Math.max(MIN_FRAC, r.h) * bh;
      return {
        bodyW: bw,
        bodyH: bh,
        text: { x: 0, y: 0, w: bw, h: bh - inkH },
        ink: { x: 0, y: bh - inkH, w: bw, h: inkH },
        textBehindInk: false,
      };
    }
    case 'block-above': {
      const inkH = Math.max(MIN_FRAC, r.h) * bh;
      return {
        bodyW: bw,
        bodyH: bh,
        ink: { x: 0, y: 0, w: bw, h: inkH },
        text: { x: 0, y: inkH, w: bw, h: bh - inkH },
        textBehindInk: false,
      };
    }
    case 'overlay':
    default:
      return {
        bodyW: bw,
        bodyH: bh,
        text: { x: 0, y: 0, w: bw, h: bh },
        ink: { x: r.x * bw, y: r.y * bh, w: r.w * bw, h: r.h * bh },
        textBehindInk: true,
      };
  }
}

/** Map pointer to body-normalized 0–1 coords (clamped to ink rect). */
export function pointerToBodyNormalized(
  clientX: number,
  clientY: number,
  bodyRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  inkRect: { x: number; y: number; w: number; h: number }
): { x: number; y: number } | null {
  const bw = Math.max(1, bodyRect.width);
  const bh = Math.max(1, bodyRect.height);
  const localX = clientX - bodyRect.left;
  const localY = clientY - bodyRect.top;
  const inInk =
    localX >= inkRect.x &&
    localX <= inkRect.x + inkRect.w &&
    localY >= inkRect.y &&
    localY <= inkRect.y + inkRect.h;
  if (!inInk) return null;
  return {
    x: clamp01(localX / bw),
    y: clamp01(localY / bh),
  };
}

export function mapBodyPointToInkPixels(
  p: { x: number; y: number },
  strokeNormalized: boolean | undefined,
  bodyW: number,
  bodyH: number,
  ink: { x: number; y: number; w: number; h: number }
): { x: number; y: number } {
  const bw = Math.max(1, bodyW);
  const bh = Math.max(1, bodyH);
  if (strokeNormalized) {
    return {
      x: p.x * bw - ink.x,
      y: p.y * bh - ink.y,
    };
  }
  return { x: p.x - ink.x, y: p.y - ink.y };
}

/** Max CSS size for inspector ink preview (minimap-style, never grows with note). */
export const STICKY_INK_PREVIEW_MAX_W = 240;
export const STICKY_INK_PREVIEW_MAX_H = 140;
export const STICKY_INK_PREVIEW_PAD = 8;

export interface StickyInkPreviewLayout {
  canvasW: number;
  canvasH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Fit ink content into a capped preview canvas (minimap parity). */
export function computeStickyInkPreviewLayout(
  bodyW: number,
  bodyH: number,
  ink: { x: number; y: number; w: number; h: number },
  strokes: { normalized?: boolean; points: { x: number; y: number }[] }[],
  maxW = STICKY_INK_PREVIEW_MAX_W,
  maxH = STICKY_INK_PREVIEW_MAX_H,
  pad = STICKY_INK_PREVIEW_PAD
): StickyInkPreviewLayout {
  const bw = Math.max(1, bodyW);
  const bh = Math.max(1, bodyH);
  const iw = Math.max(1, ink.w);
  const ih = Math.max(1, ink.h);

  let minX = 0;
  let minY = 0;
  let maxX = iw;
  let maxY = ih;

  for (const s of strokes) {
    for (const p of s.points) {
      const lp = mapBodyPointToInkPixels(p, s.normalized, bw, bh, ink);
      if (lp.x < minX) minX = lp.x;
      if (lp.y < minY) minY = lp.y;
      if (lp.x > maxX) maxX = lp.x;
      if (lp.y > maxY) maxY = lp.y;
    }
  }

  const boundsW = Math.max(1, maxX - minX);
  const boundsH = Math.max(1, maxY - minY);
  const innerMaxW = Math.max(1, maxW - pad * 2);
  const innerMaxH = Math.max(1, maxH - pad * 2);
  const scale = Math.min(innerMaxW / boundsW, innerMaxH / boundsH);
  const canvasW = Math.min(maxW, Math.round(boundsW * scale + pad * 2));
  const canvasH = Math.min(maxH, Math.round(boundsH * scale + pad * 2));

  return {
    canvasW,
    canvasH,
    scale,
    offsetX: pad - minX * scale,
    offsetY: pad - minY * scale,
    bounds: { minX, minY, maxX, maxY },
  };
}

export function mapInkLocalToPreview(
  p: { x: number; y: number },
  preview: Pick<StickyInkPreviewLayout, 'scale' | 'offsetX' | 'offsetY'>
): { x: number; y: number } {
  return {
    x: p.x * preview.scale + preview.offsetX,
    y: p.y * preview.scale + preview.offsetY,
  };
}

export const STICKY_INK_LAYOUTS: { value: StickyInkLayout; labelKey: string; fallback: string }[] = [
  { value: 'overlay', labelKey: 'boards.sticky.ink.layoutOverlay', fallback: 'Draw anywhere' },
  { value: 'wrap-start', labelKey: 'boards.sticky.ink.layoutWrapStart', fallback: 'Ink left, text wraps' },
  { value: 'wrap-end', labelKey: 'boards.sticky.ink.layoutWrapEnd', fallback: 'Ink right, text wraps' },
  { value: 'block-below', labelKey: 'boards.sticky.ink.layoutBlockBelow', fallback: 'Ink below text' },
  { value: 'block-above', labelKey: 'boards.sticky.ink.layoutBlockAbove', fallback: 'Ink above text' },
];
