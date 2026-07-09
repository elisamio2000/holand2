/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVideoPlayerSessionStore } from '../../store/video-player-session-store';
import { requestVideoPiP } from '../use-video-pip';

describe('requestVideoPiP', () => {
  beforeEach(() => {
    useVideoPlayerSessionStore.setState({
      pipSession: { active: false, mode: null, payload: null },
    });
  });

  it('opens in-app dock with mediaSessionId (no props clone)', async () => {
    const mode = await requestVideoPiP(null, {
      mediaSessionId: 'sess-1',
      title: 'Clip',
      src: '/v.mp4',
    });
    expect(mode).toBe('in-app');
    const { pipSession } = useVideoPlayerSessionStore.getState();
    expect(pipSession.active).toBe(true);
    expect(pipSession.mode).toBe('in-app');
    expect(pipSession.payload?.mediaSessionId).toBe('sess-1');
    expect(pipSession.payload?.title).toBe('Clip');
  });

  it('prefers native PiP when requestPictureInPicture succeeds', async () => {
    const video = document.createElement('video');
    const requestPiP = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });
    video.requestPictureInPicture = requestPiP;

    const mode = await requestVideoPiP(video, { mediaSessionId: 'sess-2', src: '/v.mp4' });
    expect(mode).toBe('native');
    expect(requestPiP).toHaveBeenCalled();
    expect(useVideoPlayerSessionStore.getState().pipSession.mode).toBe('native');
  });

  it('falls back to in-app when native PiP is denied', async () => {
    const video = document.createElement('video');
    video.requestPictureInPicture = vi.fn().mockRejectedValue(new DOMException('denied'));
    Object.defineProperty(document, 'pictureInPictureEnabled', { value: true, configurable: true });

    const mode = await requestVideoPiP(video, { src: '/v.mp4', title: 'Fallback' });
    expect(mode).toBe('in-app');
    expect(useVideoPlayerSessionStore.getState().pipSession.mode).toBe('in-app');
  });
});
