import { describe, expect, it, beforeEach } from 'vitest';
import { useAudioPlayerStore } from '../audio-player-store';
import { DEFAULT_AUDIO_PREFS } from '../../constants';

describe('audio player prefs sync', () => {
  beforeEach(() => {
    useAudioPlayerStore.setState({
      prefs: { ...DEFAULT_AUDIO_PREFS },
    });
  });

  it('persists volume changes from updatePrefs', () => {
    useAudioPlayerStore.getState().updatePrefs({ volume: 0.5, isMuted: false });
    expect(useAudioPlayerStore.getState().prefs.volume).toBe(0.5);
  });

  it('persists playback rate and loop', () => {
    useAudioPlayerStore.getState().updatePrefs({ playbackRate: 1.5, isLooping: true });
    const prefs = useAudioPlayerStore.getState().prefs;
    expect(prefs.playbackRate).toBe(1.5);
    expect(prefs.isLooping).toBe(true);
  });
});
