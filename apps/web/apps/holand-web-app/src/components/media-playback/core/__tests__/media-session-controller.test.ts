import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { RefObject } from 'react';
import { mediaSessionController } from '../media-session-controller';
import { useMediaSessionStore } from '../media-session-store';

describe('mediaSessionController', () => {
  beforeEach(() => {
    useMediaSessionStore.setState({ sessions: {}, remoteControls: {} });
  });

  it('syncFromElement does not regress WS time when activeVisual is wavesurfer', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    useMediaSessionStore.getState().updateSession(id, {
      activeVisual: 'wavesurfer',
      currentTime: 4.5,
      isPlaying: true,
      duration: 10,
    });
    useMediaSessionStore.getState().registerRemoteControls(id, {
      getCurrentTime: () => 4.5,
      isPlaying: () => true,
      getDuration: () => 10,
    });

    const mockEl = {
      currentTime: 0,
      paused: true,
      duration: 10,
    } as HTMLMediaElement;
    useMediaSessionStore.getState().updateSession(id, {
      elementRef: { current: mockEl } as RefObject<HTMLMediaElement | null>,
    });

    mediaSessionController.syncFromElement(id);
    const session = useMediaSessionStore.getState().getSession(id)!;
    expect(session.currentTime).toBe(4.5);
    expect(session.isPlaying).toBe(true);
  });

  it('patchPlaybackFromWs updates store and sets activeVisual wavesurfer', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    mediaSessionController.patchPlaybackFromWs(id, 2.3, true, 60);
    const session = useMediaSessionStore.getState().getSession(id)!;
    expect(session.currentTime).toBe(2.3);
    expect(session.isPlaying).toBe(true);
    expect(session.activeVisual).toBe('wavesurfer');
    expect(session.duration).toBe(60);
  });

  it('transitionPresentation resumes HTML element when snapshot was playing', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const mockEl = {
      currentTime: 3.2,
      paused: false,
      duration: 12,
      play,
      pause,
    } as unknown as HTMLMediaElement;

    useMediaSessionStore.getState().updateSession(id, {
      elementRef: { current: mockEl } as RefObject<HTMLMediaElement | null>,
      currentTime: 3.2,
      isPlaying: true,
      lifecycle: 'playing',
      activeVisual: 'none',
    });

    mediaSessionController.expandToModal(id);
    expect(play).toHaveBeenCalled();
    const session = useMediaSessionStore.getState().getSession(id)!;
    expect(session.presentation.primary).toBe('modal');
    expect(session.activeVisual).toBe('none');
  });

  it('syncFromElement updates store from HTML in modal seek-bar mode', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    const mockEl = {
      currentTime: 5.1,
      paused: false,
      duration: 20,
    } as unknown as HTMLMediaElement;

    useMediaSessionStore.getState().updateSession(id, {
      elementRef: { current: mockEl } as RefObject<HTMLMediaElement | null>,
      activeVisual: 'none',
      presentation: { primary: 'modal', mirrors: [] },
      currentTime: 0,
      isPlaying: false,
    });

    mediaSessionController.syncFromElement(id);
    const session = useMediaSessionStore.getState().getSession(id)!;
    expect(session.currentTime).toBe(5.1);
    expect(session.isPlaying).toBe(true);
  });

  it('pause delegates to remote controls without recursing through controller', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    const pause = vi.fn();
    useMediaSessionStore.getState().updateSession(id, {
      activeVisual: 'wavesurfer',
      isPlaying: true,
      lifecycle: 'playing',
    });
    useMediaSessionStore.getState().registerRemoteControls(id, {
      pause,
      getCurrentTime: () => 1,
      isPlaying: () => true,
      getDuration: () => 10,
    });

    mediaSessionController.pause(id);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('transitionPresentation collapses WS owner to HTML on inline', () => {
    const id = useMediaSessionStore.getState().createSession({ kind: 'audio', src: '/a.mp3' });
    const play = vi.fn().mockResolvedValue(undefined);
    const mockEl = {
      currentTime: 0,
      paused: true,
      duration: 20,
      play,
      pause: vi.fn(),
    } as unknown as HTMLMediaElement;

    useMediaSessionStore.getState().updateSession(id, {
      elementRef: { current: mockEl } as RefObject<HTMLMediaElement | null>,
      activeVisual: 'wavesurfer',
      currentTime: 7.5,
      isPlaying: true,
      lifecycle: 'playing',
      presentation: { primary: 'modal', mirrors: [] },
    });
    useMediaSessionStore.getState().registerRemoteControls(id, {
      pause: vi.fn(),
      getCurrentTime: () => 7.5,
      isPlaying: () => true,
      getDuration: () => 20,
    });

    mediaSessionController.collapseToInline(id);
    expect(mockEl.currentTime).toBe(7.5);
    expect(play).toHaveBeenCalled();
    const session = useMediaSessionStore.getState().getSession(id)!;
    expect(session.presentation.primary).toBe('inline');
    expect(session.activeVisual).toBe('none');
  });
});
