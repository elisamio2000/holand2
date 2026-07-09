'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AudioPlayerPrefs, AudioPlayerSession, StickyControls, StickyLayout } from '../types';
import { DEFAULT_AUDIO_PREFS } from '../constants';

interface AudioPlayerStore {
  prefs: AudioPlayerPrefs;
  session: AudioPlayerSession;
  stickyControls: StickyControls | null;
  updatePrefs: (partial: Partial<AudioPlayerPrefs>) => void;
  registerSession: (partial: Partial<AudioPlayerSession> & { activeId: string }) => void;
  updateSession: (partial: Partial<AudioPlayerSession>) => void;
  clearSession: () => void;
  setSurfaceVisible: (visible: boolean) => void;
  registerStickyControls: (handlers: StickyControls) => void;
  clearStickyControls: () => void;
}

const EMPTY_SESSION: AudioPlayerSession = {
  activeId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  surfaceVisible: true,
  stickyEnabled: false,
  stickyLayout: 'bar',
  queueIndex: -1,
  queueLength: 0,
};

export const useAudioPlayerStore = create<AudioPlayerStore>()(
  persist(
    (set) => ({
      prefs: { ...DEFAULT_AUDIO_PREFS },
      session: { ...EMPTY_SESSION },
      stickyControls: null,
      updatePrefs: (partial) =>
        set((state) => ({ prefs: { ...state.prefs, ...partial } })),
      registerSession: (partial) =>
        set((state) => ({
          session: {
            ...state.session,
            ...partial,
            activeId: partial.activeId,
          },
        })),
      updateSession: (partial) =>
        set((state) => ({ session: { ...state.session, ...partial } })),
      clearSession: () =>
        set({ session: { ...EMPTY_SESSION }, stickyControls: null }),
      setSurfaceVisible: (surfaceVisible) =>
        set((state) => ({ session: { ...state.session, surfaceVisible } })),
      registerStickyControls: (handlers) => set({ stickyControls: handlers }),
      clearStickyControls: () => set({ stickyControls: null }),
    }),
    {
      name: 'Holand-audio-player-prefs',
      partialize: (state) => ({ prefs: state.prefs }),
    }
  )
);

export const useAudioPlayerPrefs = () => useAudioPlayerStore((s) => s.prefs);
export const useAudioPlayerSession = () => useAudioPlayerStore((s) => s.session);
export const useStickyControls = () => useAudioPlayerStore((s) => s.stickyControls);

/** True when the global sticky bar should render and reserve bottom padding. */
export function isStickyBarVisible(session: AudioPlayerSession): boolean {
  return Boolean(
    session.stickyEnabled && !session.surfaceVisible && session.activeId
  );
}

export function useStickyBarActive(): boolean {
  return isStickyBarVisible(useAudioPlayerSession());
}

export function resolveStickyLayout(
  sessionLayout: StickyLayout | undefined,
  prefsLayout: StickyLayout
): StickyLayout {
  return sessionLayout ?? prefsLayout;
}

