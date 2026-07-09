'use client';

import { useCallback, useMemo } from 'react';
import type { VideoPlayerProps, VideoPlayerSettings } from '../types';
import { DEFAULT_VIDEO_SETTINGS } from '../constants';
import { useVideoPlayerStore } from '../store/video-player-store';

export function useVideoSettings(
  props: Pick<
    VideoPlayerProps,
    'volume' | 'playbackRate' | 'isMuted' | 'onSettingsChange'
  > & { loop?: boolean }
) {
  const storePrefs = useVideoPlayerStore((s) => s.prefs);
  const updatePrefs = useVideoPlayerStore((s) => s.updatePrefs);

  const volume = props.volume ?? storePrefs.volume;
  const playbackRate = props.playbackRate ?? storePrefs.playbackRate;
  const isMuted = props.isMuted ?? storePrefs.isMuted;
  const loop = props.loop ?? storePrefs.loop ?? false;

  const settings = useMemo<VideoPlayerSettings>(
    () => ({ volume, playbackRate, isMuted, loop }),
    [volume, playbackRate, isMuted, loop]
  );

  const emitSettingsChange = useCallback(
    (next: Partial<VideoPlayerSettings>) => {
      const merged = { ...settings, ...next };
      if (props.volume === undefined) updatePrefs(next);
      props.onSettingsChange?.(merged);
    },
    [settings, props, updatePrefs]
  );

  return {
    volume,
    playbackRate,
    isMuted,
    loop,
    settings,
    emitSettingsChange,
    defaults: DEFAULT_VIDEO_SETTINGS,
  };
}
