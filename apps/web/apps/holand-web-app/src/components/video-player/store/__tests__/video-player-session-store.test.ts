import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoPlayerSessionStore } from '../video-player-session-store';

describe('video-player-session-store', () => {
  beforeEach(() => {
    useVideoPlayerSessionStore.setState({ pipSession: { active: false, mode: null, payload: null } });
  });

  it('opens in-app pip session with minimal payload', () => {
    useVideoPlayerSessionStore.getState().openInAppPip({
      mediaSessionId: 'mps-1',
      src: '/v.mp4',
      title: 'Test',
    });
    const { pipSession } = useVideoPlayerSessionStore.getState();
    expect(pipSession.active).toBe(true);
    expect(pipSession.mode).toBe('in-app');
    expect(pipSession.payload?.mediaSessionId).toBe('mps-1');
    expect(pipSession.payload?.src).toBe('/v.mp4');
  });

  it('closes pip session', () => {
    useVideoPlayerSessionStore.getState().openPip({ src: '/v.mp4' });
    useVideoPlayerSessionStore.getState().closePip();
    expect(useVideoPlayerSessionStore.getState().pipSession.active).toBe(false);
  });
});
