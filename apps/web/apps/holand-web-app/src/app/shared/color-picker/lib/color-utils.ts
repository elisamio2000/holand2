/** Shared hex normalization for app-wide color pickers. */

export const COLOR_PRESETS = [
  '#1e293b',
  '#dc2626',
  '#2563eb',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#f8fafc',
  '#64748b',
  '#000000',
  '#ffffff',
] as const;

/** @deprecated Use COLOR_PRESETS — kept for board imports */
export const BOARD_COLOR_PRESETS = COLOR_PRESETS;

export function normalizeHexColor(value: string): string | null {
  const v = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const [, r, g, b] = v;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v}`.toLowerCase();
  return null;
}

export function resolveDisplayHex(value: string, fallback = '#94a3b8'): string {
  return normalizeHexColor(value) ?? normalizeHexColor(fallback) ?? '#94a3b8';
}
