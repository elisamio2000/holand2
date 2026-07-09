import type { MediaPlaybackSession } from './types';

export type PresentationChromeVariant =
  | 'chatInline'
  | 'ultraCompact'
  | 'compact'
  | 'mini'
  | 'expanded'
  | 'full'
  | 'advanced'
  | 'sticky'
  | 'pip';

const MODAL_CHROME_VARIANTS = new Set<PresentationChromeVariant>([
  'expanded',
  'full',
  'advanced',
  'pip',
]);

const INLINE_CHROME_VARIANTS = new Set<PresentationChromeVariant>([
  'chatInline',
  'ultraCompact',
  'compact',
  'mini',
]);

/**
 * Which chrome surface may attach the playback engine (MPS I3/I5).
 * Shared truth table for audio and video players.
 */
export function ownsPresentationChrome(
  mediaSessionId: string | undefined,
  session: MediaPlaybackSession | undefined,
  variant?: PresentationChromeVariant
): boolean {
  if (!mediaSessionId || !session) return true;
  if (!variant) return true;

  if (variant === 'chatInline') {
    return session.presentation.primary === 'inline';
  }

  if (MODAL_CHROME_VARIANTS.has(variant)) {
    return session.presentation.primary === 'modal';
  }

  if (INLINE_CHROME_VARIANTS.has(variant)) {
    return session.presentation.primary === 'inline';
  }

  return true;
}

export function isModalChromeVariant(variant?: PresentationChromeVariant): boolean {
  return variant ? MODAL_CHROME_VARIANTS.has(variant) : false;
}
