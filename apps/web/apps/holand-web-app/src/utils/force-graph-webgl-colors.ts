/**
 * Color helpers for react-force-graph-3d / three-render-objects (polished).
 * WebGL path only accepts hex, rgb, rgba, hsl, hsla — not 8-digit hex or CSS variables.
 */

const HEX6 = /^#([0-9a-fA-F]{6})$/;
const HEX8 = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/;
const RGB_VAR = /^rgb\(var\(--([^)]+)\)\)$/;

function hex6ToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(HEX6);
  if (!m) return null;
  const h = m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Semi-transparent link stroke equivalent to 2D `${hex}55` (~33% alpha). */
export function hexLinkFadeRgba(hex: string, alpha = 0.33): string {
  const rgb = hex6ToRgb(hex);
  if (!rgb) return toForceGraph3DColor(hex);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Resolves theme tokens and 8-digit hex for three-render-objects / polished. */
export function toForceGraph3DColor(color: string): string {
  const trimmed = color.trim();
  if (!trimmed) return '#6b7280';

  const hex8 = trimmed.match(HEX8);
  if (hex8) {
    const rgb = hex6ToRgb(`#${hex8[1]}`);
    if (!rgb) return '#6b7280';
    const a = parseInt(hex8[2]!, 16) / 255;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  }

  const varMatch = trimmed.match(RGB_VAR);
  if (varMatch) {
    if (typeof window === 'undefined') return trimmed;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(`--${varMatch[1]}`)
      .trim();
    if (raw) return `rgb(${raw})`;
  }

  return trimmed;
}

/** Canvas background: `rgb(var(--token))` → resolved `rgb(r, g, b)`. */
export function resolveThemeBackgroundRgb(
  cssVarName: string,
  lightFallback: string,
  darkFallback: string,
  isDark: boolean
): string {
  if (typeof window === 'undefined') {
    return isDark ? darkFallback : lightFallback;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  if (raw) return `rgb(${raw})`;
  return isDark ? darkFallback : lightFallback;
}
