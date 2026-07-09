import { describe, expect, it, beforeEach } from 'vitest';
import { useMediaSessionStore } from '../media-session-store';

describe('useMediaSessionStore', () => {
  beforeEach(() => {
    useMediaSessionStore.setState({ sessions: {}, remoteControls: {} });
  });

  it('patchPlayback is a no-op when snapshot values are unchanged', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    useMediaSessionStore.getState().updateSession(id, {
      currentTime: 3.5,
      isPlaying: true,
      duration: 90,
    });

    const before = useMediaSessionStore.getState().sessions;
    useMediaSessionStore.getState().patchPlayback(id, {
      currentTime: 3.5,
      isPlaying: true,
      duration: 90,
    });
    const after = useMediaSessionStore.getState().sessions;

    expect(after).toBe(before);
  });

  it('patchPlayback updates when any playback field changes', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    useMediaSessionStore.getState().updateSession(id, {
      currentTime: 0,
      isPlaying: false,
      duration: 60,
    });

    useMediaSessionStore.getState().patchPlayback(id, { currentTime: 1.2 });
    const session = useMediaSessionStore.getState().getSession(id)!;
    expect(session.currentTime).toBe(1.2);
    expect(session.isPlaying).toBe(false);
  });
});
