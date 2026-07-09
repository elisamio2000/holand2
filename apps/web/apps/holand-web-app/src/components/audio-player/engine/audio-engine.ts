import type WaveSurfer from 'wavesurfer.js';
import type { MutableRefObject, RefObject } from 'react';
import type { AudioPlayerControls } from '../types';

/** Monotonic attach sequence — stale callbacks ignore events after re-init. */
export function bumpAttachSeq(instanceIdRef: MutableRefObject<number>): number {
  instanceIdRef.current += 1;
  return instanceIdRef.current;
}

export function isAttachStale(
  instanceIdRef: MutableRefObject<number>,
  myInstanceId: number
): boolean {
  return myInstanceId !== instanceIdRef.current;
}

export function wireWaveSurferControls(
  ws: WaveSurfer,
  controlsRef?: MutableRefObject<AudioPlayerControls | null>
) {
  if (!controlsRef) return;
  controlsRef.current = {
    play: () => ws.play(),
    pause: () => ws.pause(),
    togglePlay: () => ws.playPause(),
    seekTo: (seconds: number) => {
      const d = ws.getDuration();
      if (d > 0) ws.seekTo(Math.max(0, Math.min(1, seconds / d)));
    },
    getCurrentTime: () => ws.getCurrentTime(),
    getDuration: () => ws.getDuration(),
    isPlaying: () => ws.isPlaying(),
  };
}

export function loadWaveSurferSrc(
  ws: WaveSurfer,
  src: string,
  destroyedRef: { current: boolean }
) {
  const loadResult = ws.load(src);
  if (loadResult && typeof (loadResult as Promise<void>).catch === 'function') {
    (loadResult as Promise<void>).catch((err: Error) => {
      if (err?.name === 'AbortError' || destroyedRef.current) return;
    });
  }
}

export interface DestroyWaveSurferOptions {
  ws: WaveSurfer;
  destroyedRef: { current: boolean };
  handoffInProgressRef?: { current: boolean };
  controlsRef?: MutableRefObject<AudioPlayerControls | null>;
  syncAudioRef?: RefObject<HTMLAudioElement | null>;
  onMediaStateChange?: (time: number, playing: boolean) => void;
}

/** Tear down WaveSurfer while syncing time back to shared HTML audio when present. */
export function destroyWaveSurferWithHandoff(options: DestroyWaveSurferOptions) {
  const { ws, destroyedRef, handoffInProgressRef, controlsRef, syncAudioRef, onMediaStateChange } =
    options;

  destroyedRef.current = true;
  if (handoffInProgressRef) handoffInProgressRef.current = true;
  if (controlsRef) controlsRef.current = null;

  const shared = syncAudioRef?.current;
  try {
    const wsTime = ws.getCurrentTime();
    const wsPlaying = ws.isPlaying();
    const htmlTime = shared?.currentTime ?? 0;
    const htmlPlaying = shared ? !shared.paused : false;

    // Inline chatInline preloads WaveSurfer at 0:00 while HTML audio is the real engine.
    // Never regress shared <audio> to WS preload position when WS was not actively playing.
    const time = wsPlaying ? wsTime : Math.max(wsTime, htmlTime);
    const wasPlaying = wsPlaying || htmlPlaying;

    if (shared) {
      try {
        shared.currentTime = time;
      } catch {
        /* seek may fail before metadata */
      }
    }
    onMediaStateChange?.(time, wasPlaying);
    ws.pause();
    // WS preload at 0:00 is visual only — never stop the shared HTML engine during handoff.
    if (wsPlaying) {
      shared?.pause();
    }
  } catch {
    /* swallow handoff errors during destroy */
  }

  try {
    ws.destroy();
  } catch {
    /* swallow sync destroy errors */
  }

  if (handoffInProgressRef) handoffInProgressRef.current = false;
}
