'use client';

import { useMemo } from 'react';
import { mediaSessionController } from '../core/media-session-controller';
import { useAudioPlayerStore } from '@/components/audio-player/store/audio-player-store';
import type { StickyControls } from '@/components/audio-player/types';

export interface UseMediaStickyHandlersOptions {
  mediaSessionId?: string;
  /** Fallback when no MPS session (legacy surfaces). */
  fallback?: StickyControls;
}

/**
 * Sticky bar handlers routed through MediaSessionController when MPS is active.
 */
export function useMediaStickyHandlers({
  mediaSessionId,
  fallback,
}: UseMediaStickyHandlersOptions): StickyControls {
  return useMemo(() => {
    if (!mediaSessionId) return fallback ?? {};

    return {
      togglePlay: () => mediaSessionController.togglePlay(mediaSessionId),
      seekTo: (seconds: number) => mediaSessionController.seek(mediaSessionId, seconds),
      onVolumeChange: (volume: number) => {
        mediaSessionController.setVolume(mediaSessionId, volume);
        useAudioPlayerStore.getState().updatePrefs({
          volume,
          isMuted: volume === 0,
        });
        fallback?.onVolumeChange?.(volume);
      },
      onPrev: fallback?.onPrev,
      onNext: fallback?.onNext,
    };
  }, [mediaSessionId, fallback]);
}
