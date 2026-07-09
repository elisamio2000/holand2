import { normalizeHexColor } from './color-utils';

const SKIP_ROOT_SELECTORS = [
  '[data-color-picker-eyedropper]',
  '[data-color-picker-eyedropper-skip]',
  '[data-board-eyedropper]',
  '[data-board-eyedropper-skip]',
];

const MIN_VISIBLE_ALPHA = 0.04;

const TEXT_LIKE_TAGS = new Set([
  'SPAN',
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LABEL',
  'A',
  'TEXT',
  'TSPAN',
  'LI',
  'TD',
  'TH',
]);

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function shouldSkipElement(el: Element): boolean {
  for (const sel of SKIP_ROOT_SELECTORS) {
    if (el.closest(sel)) return true;
  }
  const portal = el.closest('#headlessui-portal-root');
  if (portal) {
    const role = el.getAttribute('role');
    if (role === 'dialog' || el.tagName === 'ASIDE') return true;
    const fixed = getComputedStyle(el).position === 'fixed';
    const bg = getComputedStyle(el).backgroundColor;
    if (fixed && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      const opacity = parseFloat(getComputedStyle(el).opacity || '1');
      if (opacity > 0 && opacity < 1) return true;
    }
  }
  return false;
}

function rgbPartsToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function parseCssColorWithAlpha(raw: string): RgbaColor | null {
  const v = raw.trim();
  if (!v || v === 'none' || v === 'transparent') return null;
  const hex = normalizeHexColor(v);
  if (hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 1 };
  }
  const m = v.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i
  );
  if (!m) return null;
  const alphaRaw = m[4];
  const a =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith('%')
        ? parseFloat(alphaRaw) / 100
        : parseFloat(alphaRaw);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
}

function isVisibleColor(color: RgbaColor | null): color is RgbaColor {
  return color !== null && color.a >= MIN_VISIBLE_ALPHA;
}

function rgbaToHex(color: RgbaColor): string {
  return rgbPartsToHex(color.r, color.g, color.b);
}

function isTextLikeElement(el: Element): boolean {
  if (typeof SVGTextElement !== 'undefined' && el instanceof SVGTextElement) return true;
  if (typeof SVGTextPathElement !== 'undefined' && el instanceof SVGTextPathElement) return true;
  return el instanceof HTMLElement && TEXT_LIKE_TAGS.has(el.tagName);
}

function sampleFromImage(img: HTMLImageElement, clientX: number, clientY: number): string | null {
  try {
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !img.complete) return null;
    const sx = ((clientX - rect.left) / rect.width) * img.naturalWidth;
    const sy = ((clientY - rect.top) / rect.height) * img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a / 255 < MIN_VISIBLE_ALPHA) return null;
    return rgbPartsToHex(r, g, b);
  } catch {
    return null;
  }
}

function sampleFromCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
  try {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const sx = ((clientX - rect.left) / rect.width) * canvas.width;
    const sy = ((clientY - rect.top) / rect.height) * canvas.height;
    const [r, g, b, a] = ctx.getImageData(Math.floor(sx), Math.floor(sy), 1, 1).data;
    if (a / 255 < MIN_VISIBLE_ALPHA) return null;
    return rgbPartsToHex(r, g, b);
  } catch {
    return null;
  }
}

function isSvgShape(el: Element): boolean {
  if (typeof SVGGraphicsElement !== 'undefined' && el instanceof SVGGraphicsElement) return true;
  return (
    el.namespaceURI === 'http://www.w3.org/2000/svg' &&
    ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan'].includes(
      el.tagName.toLowerCase()
    )
  );
}

export function colorFromElement(el: Element, clientX: number, clientY: number): string | null {
  if (el instanceof HTMLImageElement) {
    return sampleFromImage(el, clientX, clientY);
  }
  if (el instanceof HTMLCanvasElement) {
    return sampleFromCanvas(el, clientX, clientY);
  }

  if (isSvgShape(el)) {
    const style = getComputedStyle(el);
    const candidates = [
      el.getAttribute('fill'),
      style.fill,
      el.getAttribute('stroke'),
      style.stroke,
    ];
    for (const raw of candidates) {
      if (!raw) continue;
      const parsed = parseCssColorWithAlpha(raw);
      if (isVisibleColor(parsed)) return rgbaToHex(parsed);
    }
    return null;
  }

  if (el instanceof HTMLElement) {
    const style = getComputedStyle(el);
    const background = parseCssColorWithAlpha(style.backgroundColor);
    if (isVisibleColor(background)) return rgbaToHex(background);
    if (isTextLikeElement(el)) {
      const foreground = parseCssColorWithAlpha(style.color);
      if (isVisibleColor(foreground)) return rgbaToHex(foreground);
    }
    return null;
  }

  return null;
}

export function sampleColorAtPoint(clientX: number, clientY: number): string | null {
  if (typeof document === 'undefined') return null;
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (shouldSkipElement(el)) continue;
    const color = colorFromElement(el, clientX, clientY);
    if (color) return color;
  }
  return null;
}

export function waitForOverlaysToClear(ms = 320): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
