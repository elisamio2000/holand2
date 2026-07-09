import type {
  MediaPlaybackSession,
  MediaPlaybackSnapshot,
  PresentationSurface,
} from './types';

export interface TransitionResult {
  session: MediaPlaybackSession;
  snapshot: MediaPlaybackSnapshot;
  shouldResume: boolean;
}

/** Capture live state from session + optional HTML element. */
export function captureSnapshot(
  session: MediaPlaybackSession,
  element?: HTMLMediaElement | null
): MediaPlaybackSnapshot {
  const htmlTime = element?.currentTime ?? session.currentTime;
  const htmlPlaying = element ? !element.paused : session.isPlaying;
  return {
    currentTime: htmlTime,
    isPlaying: htmlPlaying,
    duration: element?.duration && Number.isFinite(element.duration)
      ? element.duration
      : session.duration,
  };
}

/** Begin presentation change — enters TRANSITIONING, stores resume intent. */
export function beginPresentationTransition(
  session: MediaPlaybackSession,
  nextPrimary: PresentationSurface,
  snapshot: MediaPlaybackSnapshot
): MediaPlaybackSession {
  return {
    ...session,
    lifecycle: 'transitioning',
    currentTime: snapshot.currentTime,
    duration: snapshot.duration || session.duration,
    isPlaying: snapshot.isPlaying,
    pendingResume: snapshot,
    presentation: {
      ...session.presentation,
      primary: nextPrimary,
    },
  };
}

/** Finish transition — apply snapshot to element, optionally resume once. */
export function completePresentationTransition(
  session: MediaPlaybackSession,
  element?: HTMLMediaElement | null
): TransitionResult {
  const snapshot = session.pendingResume ?? captureSnapshot(session, element);
  const shouldResume = snapshot.isPlaying;

  if (element && snapshot.currentTime >= 0) {
    try {
      element.currentTime = snapshot.currentTime;
    } catch {
      /* metadata may not be ready */
    }
  }

  const nextLifecycle = shouldResume ? 'playing' : session.isPlaying ? 'playing' : 'paused';

  return {
    snapshot,
    shouldResume,
    session: {
      ...session,
      lifecycle: nextLifecycle === 'playing' ? 'playing' : 'paused',
      currentTime: snapshot.currentTime,
      isPlaying: shouldResume,
      pendingResume: null,
      status: session.status === 'idle' ? 'ready' : session.status,
    },
  };
}

export function applySingleResume(
  element: HTMLMediaElement | null | undefined,
  shouldResume: boolean
): void {
  if (!element || !shouldResume) {
    element?.pause();
    return;
  }
  void element.play().catch(() => {
    /* autoplay policy */
  });
}
