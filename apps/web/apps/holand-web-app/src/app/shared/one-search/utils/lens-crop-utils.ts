// ============================================
// One Search — Lens crop rectangle normalization
// ============================================

export interface LensCropPercent {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalize negative width/height from drag direction; clamp to 0–100%. */
export function normalizeLensCrop(selection: LensCropPercent): LensCropPercent {
  let { x, y, width, height } = selection;

  if (width < 0) {
    x += width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y += height;
    height = Math.abs(height);
  }

  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));
  width = Math.max(0, Math.min(100 - x, width));
  height = Math.max(0, Math.min(100 - y, height));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function lensCropFromPointer(
  container: DOMRect,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  return {
    x: ((clientX - container.left) / container.width) * 100,
    y: ((clientY - container.top) / container.height) * 100,
  };
}

export function isLensSelectionValid(
  selection: LensCropPercent | null,
  minPercent = 5
): selection is LensCropPercent {
  if (!selection) return false;
  return Math.abs(selection.width) > minPercent && Math.abs(selection.height) > minPercent;
}
