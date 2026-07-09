'use client';

import { useCallback, useMemo } from 'react';
import type { AudioPlayerProps, AudioPlayerPrefs, AudioPlayerSettings } from '../types';
import { DEFAULT_AUDIO_PREFS } from '../constants';
import { useAudioPlayerStore } from '../store/audio-player-store';

export function useAudioSettings(props: Pick<
  AudioPlayerProps,
  'volume' | 'playbackRate' | 'isMuted' | 'isLooping' | 'onSettingsChange'
>) {
  const storePrefs = useAudioPlayerStore((s) => s.prefs);
  const updatePrefs = useAudioPlayerStore((s) => s.updatePrefs);

  const volume = props.volume ?? storePrefs.volume;
  const playbackRate = props.playbackRate ?? storePrefs.playbackRate;
  const isMuted = props.isMuted ?? storePrefs.isMuted;
  const isLooping = props.isLooping ?? storePrefs.isLooping;

  const settings = useMemo<AudioPlayerSettings>(
    () => ({ volume, playbackRate, isMuted, isLooping }),
    [volume, playbackRate, isMuted, isLooping]
  );

  const emitSettingsChange = useCallback(
    (next: Partial<AudioPlayerSettings>) => {
      const merged = { ...settings, ...next };
      const prefsPatch: Partial<AudioPlayerPrefs> = {};
      if (props.volume === undefined && next.volume !== undefined) {
        prefsPatch.volume = next.volume;
      }
      if (props.playbackRate === undefined && next.playbackRate !== undefined) {
        prefsPatch.playbackRate = next.playbackRate;
      }
      if (props.isMuted === undefined && next.isMuted !== undefined) {
        prefsPatch.isMuted = next.isMuted;
      }
      if (props.isLooping === undefined && next.isLooping !== undefined) {
        prefsPatch.isLooping = next.isLooping;
      }
      if (Object.keys(prefsPatch).length > 0) updatePrefs(prefsPatch);
      props.onSettingsChange?.(merged);
    },
    [settings, props, updatePrefs]
  );

  return {
    volume,
    playbackRate,
    isMuted,
    isLooping,
    settings,
    emitSettingsChange,
    defaults: DEFAULT_AUDIO_PREFS,
  };
}
