import { describe, expect, it, vi } from 'vitest';
import { mergePlaybackTime } from '../invariants';
import {
  applySingleResume,
  beginPresentationTransition,
  captureSnapshot,
  completePresentationTransition,
} from '../transition-fsm';
import { createEmptySession } from '../types';

describe('transition-fsm', () => {
  it('preserves HTML time when WS preload would be 0', () => {
    expect(mergePlaybackTime(0, 4.2, false)).toBe(4.2);
  });

  it('beginPresentationTransition sets TRANSITIONING and pending resume', () => {
    const session = createEmptySession('s1', { kind: 'audio', src: '/a.mp3' });
    const snapshot = { currentTime: 3.5, isPlaying: true, duration: 10 };
    const next = beginPresentationTransition(session, 'modal', snapshot);
    expect(next.lifecycle).toBe('transitioning');
    expect(next.presentation.primary).toBe('modal');
    expect(next.pendingResume?.isPlaying).toBe(true);
  });

  it('completePresentationTransition resumes playing intent once', () => {
    const session = createEmptySession('s1', { kind: 'audio', src: '/a.mp3' });
    const withPending = beginPresentationTransition(session, 'modal', {
      currentTime: 2,
      isPlaying: true,
      duration: 8,
    });
    const { session: done, shouldResume } = completePresentationTransition(withPending, null);
    expect(shouldResume).toBe(true);
    expect(done.pendingResume).toBeNull();
    expect(done.lifecycle).toBe('playing');
  });

  it('captureSnapshot prefers element currentTime', () => {
    const session = createEmptySession('s1', { kind: 'audio' });
    const mockEl = { currentTime: 5.1, paused: false, duration: 12 } as HTMLMediaElement;
    const snap = captureSnapshot(session, mockEl);
    expect(snap.currentTime).toBe(5.1);
    expect(snap.isPlaying).toBe(true);
  });

  it('applySingleResume calls play when shouldResume is true', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const mockEl = { play, pause, paused: true } as unknown as HTMLMediaElement;
    applySingleResume(mockEl, true);
    expect(play).toHaveBeenCalled();
  });

  it('applySingleResume pauses when shouldResume is false', () => {
    const play = vi.fn();
    const pause = vi.fn();
    const mockEl = { play, pause, paused: false } as unknown as HTMLMediaElement;
    applySingleResume(mockEl, false);
    expect(pause).toHaveBeenCalled();
  });
});
