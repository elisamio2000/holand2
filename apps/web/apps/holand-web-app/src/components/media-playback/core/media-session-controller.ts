import type { MediaPlaybackSession, MediaPlaybackSnapshot, PresentationSurface } from './types';
import {
  applySingleResume,
  beginPresentationTransition,
  captureSnapshot,
  completePresentationTransition,
} from './transition-fsm';
import { useMediaSessionStore } from './media-session-store';
import { playRejectionMessage } from './play-rejection';

function getElement(sessionId: string): HTMLMediaElement | null {
  const session = useMediaSessionStore.getState().getSession(sessionId);
  return session?.elementRef?.current ?? null;
}

function getRemoteControls(sessionId: string) {
  return useMediaSessionStore.getState().remoteControls[sessionId];
}

/** Snapshot from the active visual owner (WaveSurfer remote or HTML element). */
function snapshotForSession(session: MediaPlaybackSession): MediaPlaybackSnapshot {
  if (session.activeVisual === 'wavesurfer') {
    const rc = getRemoteControls(session.id);
    return {
      currentTime: rc?.getCurrentTime?.() ?? session.currentTime,
      isPlaying: rc?.isPlaying?.() ?? session.isPlaying,
      duration: rc?.getDuration?.() ?? session.duration,
    };
  }
  const el = session.elementRef?.current ?? getElement(session.id);
  return captureSnapshot(session, el);
}

function isWaveSurferOwner(session: MediaPlaybackSession | undefined): boolean {
  return session?.activeVisual === 'wavesurfer';
}

/** HTML element is not the live owner — skip element-driven store writes. */
function shouldSyncFromHtmlElement(session: MediaPlaybackSession): boolean {
  if (session.lifecycle === 'transitioning') return false;
  if (session.activeVisual === 'wavesurfer') return false;
  return true;
}

export const mediaSessionController = {
  play(sessionId: string): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session) return;
    if (session.lifecycle === 'transitioning') return;

    if (isWaveSurferOwner(session)) {
      const rc = getRemoteControls(sessionId);
      rc?.play?.();
      this.syncFromVisualOwner(sessionId);
      return;
    }

    const el = getElement(sessionId);
    if (el) {
      void el.play().catch((err) => {
        store.patchPlayback(sessionId, { isPlaying: false });
        store.updateSession(sessionId, {
          lifecycle: 'paused',
          status: 'error',
          errorMessage: playRejectionMessage(err),
        });
      });
    }
    store.patchPlayback(sessionId, { isPlaying: true });
    store.updateSession(sessionId, { lifecycle: 'playing', status: 'ready' });
  },

  setVolume(sessionId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    const el = getElement(sessionId);
    if (el) {
      el.volume = clamped;
      el.muted = clamped === 0;
    }
    const rc = getRemoteControls(sessionId);
    rc?.setVolume?.(clamped);
  },

  pause(sessionId: string): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session) return;
    if (session.lifecycle === 'transitioning') return;

    if (isWaveSurferOwner(session)) {
      const rc = getRemoteControls(sessionId);
      rc?.pause?.();
      this.syncFromVisualOwner(sessionId);
      return;
    }

    const el = getElement(sessionId);
    el?.pause();
    const time = el?.currentTime ?? session.currentTime;
    store.patchPlayback(sessionId, { isPlaying: false, currentTime: time });
    store.updateSession(sessionId, { lifecycle: 'paused' });
  },

  togglePlay(sessionId: string): void {
    const session = useMediaSessionStore.getState().getSession(sessionId);
    if (!session) return;
    if (isWaveSurferOwner(session)) {
      const rc = getRemoteControls(sessionId);
      if (rc?.togglePlay) {
        rc.togglePlay();
      } else if (session.isPlaying) {
        this.pause(sessionId);
      } else {
        this.play(sessionId);
      }
      this.syncFromVisualOwner(sessionId);
      return;
    }
    if (session.isPlaying) this.pause(sessionId);
    else this.play(sessionId);
  },

  seek(sessionId: string, seconds: number): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session) return;
    if (session.lifecycle === 'transitioning') return;

    if (isWaveSurferOwner(session)) {
      getRemoteControls(sessionId)?.seekTo?.(seconds);
      this.syncFromVisualOwner(sessionId);
      return;
    }

    const el = getElement(sessionId);
    if (el) {
      const dur = el.duration && Number.isFinite(el.duration) ? el.duration : undefined;
      const t = dur != null ? Math.max(0, Math.min(dur, seconds)) : Math.max(0, seconds);
      try {
        el.currentTime = t;
      } catch {
        /* ignore */
      }
      store.patchPlayback(sessionId, { currentTime: t });
      return;
    }
    store.patchPlayback(sessionId, { currentTime: seconds });
  },

  syncFromElement(sessionId: string): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session || session.lifecycle === 'transitioning') return;
    if (isWaveSurferOwner(session)) {
      this.syncFromVisualOwner(sessionId);
      return;
    }
    if (!shouldSyncFromHtmlElement(session)) return;
    const el = getElement(sessionId);
    if (!el) return;
    store.patchPlayback(sessionId, {
      currentTime: el.currentTime,
      isPlaying: !el.paused,
      duration: Number.isFinite(el.duration) ? el.duration : session.duration,
    });
    store.updateSession(sessionId, {
      lifecycle: el.paused ? 'paused' : 'playing',
      status: 'ready',
    });
  },

  /** Sync store from WaveSurfer remote controls when WS is the active visual owner. */
  syncFromVisualOwner(sessionId: string): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session || session.lifecycle === 'transitioning') return;

    if (isWaveSurferOwner(session)) {
      const rc = getRemoteControls(sessionId);
      const currentTime = rc?.getCurrentTime?.() ?? session.currentTime;
      const isPlaying = rc?.isPlaying?.() ?? session.isPlaying;
      const duration = rc?.getDuration?.() ?? session.duration;
      store.patchPlayback(sessionId, { currentTime, isPlaying, duration });
      store.updateSession(sessionId, {
        lifecycle: isPlaying ? 'playing' : 'paused',
        status: 'ready',
      });
      return;
    }

    this.syncFromElement(sessionId);
  },

  /** Push WS time/playing into MPS store (WaveSurfer is visual owner). */
  patchPlaybackFromWs(
    sessionId: string,
    currentTime: number,
    isPlaying: boolean,
    duration?: number
  ): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session || session.lifecycle === 'transitioning') return;
    store.patchPlayback(sessionId, {
      currentTime,
      isPlaying,
      ...(duration !== undefined && duration > 0 ? { duration } : {}),
    });
    store.updateSession(sessionId, {
      activeVisual: 'wavesurfer',
      lifecycle: isPlaying ? 'playing' : 'paused',
      status: 'ready',
    });
  },

  setActiveVisual(sessionId: string, activeVisual: 'none' | 'wavesurfer'): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session || session.activeVisual === activeVisual) return;
    store.updateSession(sessionId, { activeVisual });
  },

  /** Atomic expand/collapse — one snapshot; chrome-only handoff. */
  transitionPresentation(sessionId: string, nextPrimary: PresentationSurface): void {
    const store = useMediaSessionStore.getState();
    const session = store.getSession(sessionId);
    if (!session) return;

    const el = getElement(sessionId);
    const wasWsOwner = isWaveSurferOwner(session);
    const snapshot = snapshotForSession(session);

    const transitioning = beginPresentationTransition(session, nextPrimary, snapshot);
    store.updateSession(sessionId, transitioning);

    const { session: completed, shouldResume } = completePresentationTransition(
      store.getSession(sessionId) ?? transitioning,
      el
    );
    store.updateSession(sessionId, completed);

    if (wasWsOwner) {
      const rc = getRemoteControls(sessionId);
      rc?.pause?.();
      const liveSnapshot = snapshotForSession(store.getSession(sessionId) ?? completed);
      store.patchPlayback(sessionId, liveSnapshot);

      if (el) {
        try {
          el.currentTime = liveSnapshot.currentTime;
        } catch {
          /* metadata may not be ready */
        }
      }

      if (nextPrimary === 'inline') {
        store.updateSession(sessionId, { activeVisual: 'none' });
        applySingleResume(el, liveSnapshot.isPlaying);
        if (el) this.syncFromElement(sessionId);
      } else {
        store.updateSession(sessionId, { activeVisual: 'none' });
      }
      return;
    }

    store.updateSession(sessionId, { activeVisual: 'none' });

    if (el && snapshot.currentTime >= 0) {
      try {
        el.currentTime = snapshot.currentTime;
      } catch {
        /* ignore */
      }
    }
    applySingleResume(el, shouldResume);
    if (el) this.syncFromElement(sessionId);
  },

  expandToModal(sessionId: string): void {
    this.transitionPresentation(sessionId, 'modal');
  },

  collapseToInline(sessionId: string): void {
    this.transitionPresentation(sessionId, 'inline');
  },

  /** Close MPS modal — snapshot + collapse BEFORE React unmount tears down players. */
  closeModalWithHandoff(
    sessionId: string,
    onHandoff?: (currentTime: number, isPlaying: boolean, viewFlag?: boolean) => void,
    viewFlag?: boolean
  ): void {
    this.syncFromVisualOwner(sessionId);
    const snap = this.getPlaybackSnapshot(sessionId);
    const session = useMediaSessionStore.getState().getSession(sessionId);
    onHandoff?.(
      snap?.currentTime ?? 0,
      snap?.isPlaying ?? false,
      session?.view.showWaveform ?? session?.view.showAdvanced ?? viewFlag
    );
    this.collapseToInline(sessionId);
  },

  /** Read current playback state for modal close handoff. */
  getPlaybackSnapshot(sessionId: string): MediaPlaybackSnapshot | null {
    const session = useMediaSessionStore.getState().getSession(sessionId);
    if (!session) return null;
    return snapshotForSession(session);
  },
};
