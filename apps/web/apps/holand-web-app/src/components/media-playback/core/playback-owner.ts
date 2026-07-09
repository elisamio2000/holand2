import type { AudioPlayerVariant } from '@/components/audio-player/types';
import { variantUsesMainWaveSurfer } from '@/components/audio-player/constants';
import type { VisualBackend } from './types';
import { useMediaSessionStore } from './media-session-store';

export interface WsPlaybackOwnerInput {
  wsReady: boolean;
  showWaveform: boolean;
  variant: AudioPlayerVariant | undefined;
  mirrorPlayback?: boolean;
}

/** WaveSurfer is the live playback owner (not preload-only). */
export function isWsPlaybackOwner(input: WsPlaybackOwnerInput): boolean {
  const { wsReady, showWaveform, variant, mirrorPlayback } = input;
  if (!wsReady || !showWaveform || mirrorPlayback || !variant) return false;
  if (
    variant === 'mini' ||
    variant === 'ultraCompact' ||
    variant === 'expanded'
  ) {
    return false;
  }
  if (variant === 'chatInline') return true;
  return variantUsesMainWaveSurfer(variant);
}

export function activeVisualForOwner(wsOwner: boolean): VisualBackend {
  return wsOwner ? 'wavesurfer' : 'none';
}

/** Live handoff snapshot — prefer MPS store, then shared HTML element. */
export function resolveHandoffSnapshot(
  sessionId: string | undefined,
  extAudio: HTMLMediaElement | null | undefined
): { currentTime: number; isPlaying: boolean } {
  if (sessionId) {
    const session = useMediaSessionStore.getState().getSession(sessionId);
    if (session) {
      const el = session.elementRef?.current ?? extAudio;
      const storeTime = session.currentTime;
      const elTime = el?.currentTime ?? 0;
      const currentTime =
        Number.isFinite(storeTime) && storeTime > 0
          ? storeTime
          : Number.isFinite(elTime)
            ? elTime
            : 0;
      const isPlaying =
        session.isPlaying || (el ? !el.paused : extAudio ? !extAudio.paused : false);
      return { currentTime, isPlaying };
    }
  }
  return {
    currentTime: extAudio?.currentTime ?? 0,
    isPlaying: extAudio ? !extAudio.paused : false,
  };
}
