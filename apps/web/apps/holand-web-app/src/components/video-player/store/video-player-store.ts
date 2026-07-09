'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoPlayerSettings } from '../types';
import { DEFAULT_VIDEO_SETTINGS } from '../constants';

interface VideoPlayerStore {
  prefs: VideoPlayerSettings;
  updatePrefs: (partial: Partial<VideoPlayerSettings>) => void;
}

export const useVideoPlayerStore = create<VideoPlayerStore>()(
  persist(
    (set) => ({
      prefs: { ...DEFAULT_VIDEO_SETTINGS },
      updatePrefs: (partial) =>
        set((state) => ({ prefs: { ...state.prefs, ...partial } })),
    }),
    {
      name: 'Holand-video-player-prefs',
      partialize: (state) => ({ prefs: state.prefs }),
    }
  )
);

export const useVideoPlayerPrefs = () => useVideoPlayerStore((s) => s.prefs);

