'use client';

import { create } from 'zustand';
import { warnPipWithoutSession } from '@/components/media-playback/core/dev-invariants';

/** Minimal PiP handoff — session id when MPS-backed, else cold-start src metadata. */
export interface VideoPipPayload {
  mediaSessionId?: string;
  src?: string;
  poster?: string;
  title?: string;
  mimeType?: string;
  artifactId?: string;
  initialCurrentTime?: number;
  initialIsPlaying?: boolean;
  onClose?: () => void;
}

export type VideoPipMode = 'native' | 'in-app';

export interface PipSession {
  active: boolean;
  mode: VideoPipMode | null;
  payload: VideoPipPayload | null;
}

interface VideoPlayerSessionStore {
  pipSession: PipSession;
  openInAppPip: (payload: VideoPipPayload) => void;
  /** @deprecated Use openInAppPip — kept for lab/manual triggers */
  openPip: (payload: VideoPipPayload) => void;
  markNativePip: (payload: VideoPipPayload) => void;
  closePip: () => void;
}

const CLOSED: PipSession = { active: false, mode: null, payload: null };

export const useVideoPlayerSessionStore = create<VideoPlayerSessionStore>((set) => ({
  pipSession: CLOSED,
  openInAppPip: (payload) => {
    if (!payload.mediaSessionId) warnPipWithoutSession('openInAppPip');
    set({ pipSession: { active: true, mode: 'in-app', payload } });
  },
  openPip: (payload) => {
    if (!payload.mediaSessionId) warnPipWithoutSession('openPip');
    set({ pipSession: { active: true, mode: 'in-app', payload } });
  },
  markNativePip: (payload) =>
    set({ pipSession: { active: true, mode: 'native', payload } }),
  closePip: () => set({ pipSession: CLOSED }),
}));
