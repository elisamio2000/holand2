import { describe, expect, it, vi } from 'vitest';
import { destroyWaveSurferWithHandoff } from '../audio-engine';

function mockWaveSurfer(time: number, playing: boolean) {
  return {
    getCurrentTime: () => time,
    isPlaying: () => playing,
    pause: vi.fn(),
    destroy: vi.fn(),
  };
}

function mockAudio(time: number, paused: boolean) {
  const audio = {
    currentTime: time,
    paused,
    pause: vi.fn(function (this: { paused: boolean }) {
      this.paused = true;
    }),
  };
  return audio;
}

describe('destroyWaveSurferWithHandoff', () => {
  it('preserves shared HTML time when WS was preloaded at 0 (seek-bar mode)', () => {
    const audio = mockAudio(4.2, true);

    const ws = mockWaveSurfer(0, false);
    const onMediaStateChange = vi.fn();
    const destroyedRef = { current: false };

    destroyWaveSurferWithHandoff({
      ws: ws as never,
      destroyedRef,
      syncAudioRef: { current: audio as never },
      onMediaStateChange,
    });

    expect(audio.currentTime).toBe(4.2);
    expect(onMediaStateChange).toHaveBeenCalledWith(4.2, false);
    expect(ws.destroy).toHaveBeenCalled();
  });

  it('reports playing when HTML audio was active even if WS was idle', () => {
    const audio = mockAudio(2.5, false);

    const ws = mockWaveSurfer(0, false);
    const onMediaStateChange = vi.fn();

    destroyWaveSurferWithHandoff({
      ws: ws as never,
      destroyedRef: { current: false },
      syncAudioRef: { current: audio as never },
      onMediaStateChange,
    });

    expect(onMediaStateChange).toHaveBeenCalledWith(2.5, true);
  });

  it('prefers WS time when WS was the active engine', () => {
    const audio = mockAudio(1, true);

    const ws = mockWaveSurfer(6.7, true);
    const onMediaStateChange = vi.fn();

    destroyWaveSurferWithHandoff({
      ws: ws as never,
      destroyedRef: { current: false },
      syncAudioRef: { current: audio as never },
      onMediaStateChange,
    });

    expect(audio.currentTime).toBe(6.7);
    expect(onMediaStateChange).toHaveBeenCalledWith(6.7, true);
  });

  it('does not pause HTML audio when WS was idle at 0 during handoff', () => {
    const audio = mockAudio(4.2, false);

    const ws = mockWaveSurfer(0, false);
    const onMediaStateChange = vi.fn();

    destroyWaveSurferWithHandoff({
      ws: ws as never,
      destroyedRef: { current: false },
      syncAudioRef: { current: audio as never },
      onMediaStateChange,
    });

    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(4.2);
  });
});
