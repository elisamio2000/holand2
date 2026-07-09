// ============================================
// Font Configuration — Inter (Latin) + Lexend (Headings) + Vazirmatn (Persian/Arabic)
// Self-hosted via next/font/local — no Google Fonts fetch at build/dev/runtime.
// Canonical files: public/fonts/*.woff2
// ============================================

import localFont from 'next/font/local';

export const inter = localFont({
  src: '../../public/fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});

export const lexendDeca = localFont({
  src: '../../public/fonts/LexendDeca-Variable.woff2',
  variable: '--font-lexend',
  display: 'swap',
  weight: '100 900',
});

/**
 * Vazirmatn — Best Persian/Arabic variable font for web.
 *
 * Designed by Saber Rastikerdar, optimized for screen readability.
 * Supports weights 100-900 (variable). Latin glyphs based on Roboto.
 *
 * @see https://github.com/rastikerdar/vazirmatn
 */
export const vazirmatn = localFont({
  src: '../../public/fonts/Vazirmatn-Variable.woff2',
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: '100 900',
});
