import type { MediaPlaybackSession, SessionLifecycle } from './types';

/** Only controller may drive play while transitioning. */
export function assertNotTransitioning(session: MediaPlaybackSession, action: string): void {
  if (session.lifecycle === 'transitioning') {
    throw new Error(`[MediaSession] ${action} blocked during TRANSITIONING`);
  }
}

export function assertSinglePrimarySurface(session: MediaPlaybackSession): void {
  if (!session.presentation.primary) {
    throw new Error('[MediaSession] primary presentation surface required');
  }
}

export function canPlay(lifecycle: SessionLifecycle): boolean {
  return lifecycle !== 'transitioning' && lifecycle !== 'idle';
}

export function mergePlaybackTime(wsTime: number, htmlTime: number, wsPlaying: boolean): number {
  return wsPlaying ? wsTime : Math.max(wsTime, htmlTime);
}

export function mergePlayingState(wsPlaying: boolean, htmlPlaying: boolean): boolean {
  return wsPlaying || htmlPlaying;
}
