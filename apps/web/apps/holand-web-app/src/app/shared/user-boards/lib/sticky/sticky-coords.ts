/** Map pointer client coords to normalized 0–1 sticky ink space. */
export function pointerToStickyNormalized(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): { x: number; y: number } {
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const x = (clientX - rect.left) / w;
  const y = (clientY - rect.top) / h;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

/** CSS pixel size for canvas backing store. */
export function stickyCanvasCssSize(rect: Pick<DOMRect, 'width' | 'height'>) {
  return {
    cssW: Math.max(1, rect.width),
    cssH: Math.max(1, rect.height),
  };
}

export function stickyCanvasDprSize(cssW: number, cssH: number, dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) {
  return {
    width: Math.max(1, Math.round(cssW * dpr)),
    height: Math.max(1, Math.round(cssH * dpr)),
    dpr,
  };
}
