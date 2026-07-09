'use client';

import { create } from 'zustand';
import type { RefObject } from 'react';
import {
  createEmptySession,
  type CreateSessionInput,
  type MediaPlaybackSession,
  type MediaPlaybackSnapshot,
  type MediaSessionRemoteControls,
  type MediaViewFlags,
  type PresentationSurface,
} from './types';
import { videoEngineRegistry } from './video-engine-registry';

interface MediaSessionStoreState {
  sessions: Record<string, MediaPlaybackSession>;
  remoteControls: Record<string, MediaSessionRemoteControls>;
  createSession: (input: CreateSessionInput) => string;
  destroySession: (id: string) => void;
  getSession: (id: string) => MediaPlaybackSession | undefined;
  updateSession: (id: string, partial: Partial<MediaPlaybackSession>) => void;
  patchPlayback: (id: string, partial: Partial<MediaPlaybackSnapshot>) => void;
  bindElementRef: (id: string, ref: RefObject<HTMLMediaElement | null>) => void;
  setPresentation: (id: string, primary: PresentationSurface, mirrors?: PresentationSurface[]) => void;
  setViewFlags: (id: string, view: Partial<MediaViewFlags>) => void;
  registerRemoteControls: (id: string, controls: MediaSessionRemoteControls) => void;
  clearRemoteControls: (id: string) => void;
}

let sessionCounter = 0;

function nextSessionId(kind: string): string {
  sessionCounter += 1;
  return `mps-${kind}-${sessionCounter}-${Date.now()}`;
}

export const useMediaSessionStore = create<MediaSessionStoreState>((set, get) => ({
  sessions: {},
  remoteControls: {},

  createSession: (input) => {
    const id = input.id ?? nextSessionId(input.kind);
    const session = createEmptySession(id, input);
    set((state) => ({
      sessions: { ...state.sessions, [id]: session },
    }));
    return id;
  },

  destroySession: (id) => {
    videoEngineRegistry.clear(id);
    set((state) => {
      const { [id]: _removed, ...sessions } = state.sessions;
      const { [id]: _ctrl, ...remoteControls } = state.remoteControls;
      return { sessions, remoteControls };
    });
  },

  getSession: (id) => get().sessions[id],

  updateSession: (id, partial) => {
    set((state) => {
      const current = state.sessions[id];
      if (!current) return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, ...partial },
        },
      };
    });
  },

  patchPlayback: (id, partial) => {
    set((state) => {
      const current = state.sessions[id];
      if (!current) return state;

      const nextCurrentTime =
        partial.currentTime !== undefined ? partial.currentTime : current.currentTime;
      const nextIsPlaying =
        partial.isPlaying !== undefined ? partial.isPlaying : current.isPlaying;
      const nextDuration =
        partial.duration !== undefined ? partial.duration : current.duration;

      if (
        nextCurrentTime === current.currentTime &&
        nextIsPlaying === current.isPlaying &&
        nextDuration === current.duration
      ) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [id]: {
            ...current,
            currentTime: nextCurrentTime,
            isPlaying: nextIsPlaying,
            duration: nextDuration,
          },
        },
      };
    });
  },

  bindElementRef: (id, ref) => {
    get().updateSession(id, { elementRef: ref });
  },

  setPresentation: (id, primary, mirrors) => {
    set((state) => {
      const current = state.sessions[id];
      if (!current) return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            ...current,
            presentation: {
              primary,
              mirrors: mirrors ?? current.presentation.mirrors,
            },
          },
        },
      };
    });
  },

  setViewFlags: (id, view) => {
    set((state) => {
      const current = state.sessions[id];
      if (!current) return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            ...current,
            view: { ...current.view, ...view },
          },
        },
      };
    });
  },

  registerRemoteControls: (id, controls) => {
    set((state) => ({
      remoteControls: { ...state.remoteControls, [id]: controls },
    }));
  },

  clearRemoteControls: (id) => {
    set((state) => {
      const { [id]: _removed, ...remoteControls } = state.remoteControls;
      return { remoteControls };
    });
  },
}));

export function useMediaSession(sessionId: string | undefined) {
  return useMediaSessionStore((s) => (sessionId ? s.sessions[sessionId] : undefined));
}
