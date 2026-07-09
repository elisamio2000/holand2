'use client';

import { useAudioPlayback } from './hooks/use-audio-playback';
import { useAudioKeyboard } from './hooks/use-audio-keyboard';
import { ChatInlineVariant } from './variants/chat-inline';
import { UltraCompactVariant } from './variants/ultra-compact';
import { MiniVariant } from './variants/mini';
import { CompactVariant } from './variants/compact';
import { ExpandedVariant } from './variants/expanded';
import { FullVariant } from './variants/full';
import { AdvancedVariant } from './variants/advanced';
import { DEFAULT_AUDIO_SETTINGS, DEFAULT_AUDIO_PREFS } from './constants';
import { warnStickyVariantMisuse, warnDualMediaOwnership } from '@/components/media-playback/core/dev-invariants';
import type { AudioPlayerProps } from './types';

export type {
  AudioPlayerProps,
  AudioPlayerControls,
  AudioPlayerSettings,
  AudioPlayerPrefs,
  AudioRegion,
  AudioPlayerVariant,
  PlaybackStrategy,
  StickyLayout,
  StickyControls,
} from './types';

export { DEFAULT_AUDIO_SETTINGS, DEFAULT_AUDIO_PREFS };
export { useAudioStickyAnchor } from './hooks/use-audio-sticky-anchor';
export {
  useAudioPlayerPrefs,
  useAudioPlayerSession,
  useStickyBarActive,
} from './store/audio-player-store';

/**
 * AudioPlayer — Global audio player with multi-variant support.
 *
 * Variants: chatInline, ultraCompact, compact, mini, expanded, full, advanced
 */
export function AudioPlayer(props: AudioPlayerProps) {
  const { variant = 'full', mediaSessionId, syncAudioRef } = props;

  warnDualMediaOwnership('AudioPlayer', Boolean(mediaSessionId), Boolean(syncAudioRef));

  const isStickyMisuse = variant === 'sticky';
  if (isStickyMisuse) {
    warnStickyVariantMisuse();
  }

  const playback = useAudioPlayback(props);
  useAudioKeyboard(playback, variant !== 'mini' && variant !== 'ultraCompact');

  if (isStickyMisuse) {
    return null;
  }

  const variantProps = { ...props, playback };

  switch (variant) {
    case 'chatInline':
      return <ChatInlineVariant {...variantProps} />;
    case 'ultraCompact':
      return <UltraCompactVariant {...variantProps} />;
    case 'compact':
      return <CompactVariant {...variantProps} />;
    case 'mini':
      return <MiniVariant {...variantProps} />;
    case 'expanded':
      return <ExpandedVariant {...variantProps} />;
    case 'full':
      return <FullVariant {...variantProps} />;
    case 'advanced':
      return <AdvancedVariant {...variantProps} />;
    default:
      return <FullVariant {...variantProps} />;
  }
}

export default AudioPlayer;
