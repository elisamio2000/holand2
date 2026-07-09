import { describe, expect, it } from 'vitest';
import { isWsPlaybackOwner } from '../playback-owner';

describe('isWsPlaybackOwner', () => {
  it('returns false for seek-bar mode on full variant', () => {
    expect(
      isWsPlaybackOwner({
        wsReady: true,
        showWaveform: false,
        variant: 'full',
      })
    ).toBe(false);
  });

  it('returns true for waveform mode on full variant', () => {
    expect(
      isWsPlaybackOwner({
        wsReady: true,
        showWaveform: true,
        variant: 'full',
      })
    ).toBe(true);
  });

  it('returns false for chatInline seek-bar', () => {
    expect(
      isWsPlaybackOwner({
        wsReady: true,
        showWaveform: false,
        variant: 'chatInline',
      })
    ).toBe(false);
  });

  it('returns true for chatInline waveform', () => {
    expect(
      isWsPlaybackOwner({
        wsReady: true,
        showWaveform: true,
        variant: 'chatInline',
      })
    ).toBe(true);
  });
});
