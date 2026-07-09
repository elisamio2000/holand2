import { describe, expect, it, vi } from 'vitest';
import {
  handlePlaybackFinish,
  resolvePlaybackFinishAction,
} from '../playback-finish';

describe('resolvePlaybackFinishAction', () => {
  it('returns restart when looping', () => {
    expect(resolvePlaybackFinishAction(true)).toBe('restart');
  });

  it('returns stop when not looping', () => {
    expect(resolvePlaybackFinishAction(false)).toBe('stop');
  });
});

describe('handlePlaybackFinish', () => {
  it('calls restart when looping', () => {
    const restart = vi.fn();
    const stop = vi.fn();
    handlePlaybackFinish(true, { restart, stop });
    expect(restart).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it('calls stop when not looping', () => {
    const restart = vi.fn();
    const stop = vi.fn();
    handlePlaybackFinish(false, { restart, stop });
    expect(stop).toHaveBeenCalledOnce();
    expect(restart).not.toHaveBeenCalled();
  });
});
