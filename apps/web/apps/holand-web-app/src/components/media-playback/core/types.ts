import type { RefObject } from 'react';

export type MediaKind = 'audio' | 'video';

export type PresentationSurface =
  | 'inline'
  | 'modal'
  | 'watch'
  | 'sticky'
  | 'pip'
  | 'fullscreen';

export type SessionLifecycle =
  | 'idle'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'transitioning'
  | 'error';

export type EngineBackend = 'native' | 'hls' | 'dash';
export type VisualBackend = 'none' | 'wavesurfer';

export interface MediaSourceDescriptor {
  src?: string;
  artifactId?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  title?: string;
}

export interface MediaPlaybackSnapshot {
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}

export interface MediaViewFlags {
  showWaveform?: boolean;
  showAdvanced?: boolean;
  chromeVariant?: string;
}

export interface MediaPresentationState {
  primary: PresentationSurface;
  mirrors: PresentationSurface[];
}

export interface MediaPlaybackSession {
  id: string;
  kind: MediaKind;
  source: MediaSourceDescriptor;
  lifecycle: SessionLifecycle;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  buffered: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage?: string;
  view: MediaViewFlags;
  presentation: MediaPresentationState;
  activeBackend: EngineBackend;
  activeVisual: VisualBackend;
  /** Set by MediaElementHost when element mounts */
  elementRef: RefObject<HTMLMediaElement | null> | null;
  /** Resume intent captured during TRANSITIONING */
  pendingResume: MediaPlaybackSnapshot | null;
}

export interface CreateSessionInput extends MediaSourceDescriptor {
  id?: string;
  kind: MediaKind;
  presentation?: Partial<MediaPresentationState>;
  view?: MediaViewFlags;
}

export interface MediaSessionRemoteControls {
  play?: () => void;
  pause?: () => void;
  togglePlay?: () => void;
  seekTo?: (seconds: number) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  isPlaying?: () => boolean;
  setVolume?: (volume: number) => void;
}

export const DEFAULT_PRESENTATION: MediaPresentationState = {
  primary: 'inline',
  mirrors: [],
};

export function createEmptySession(id: string, input: CreateSessionInput): MediaPlaybackSession {
  return {
    id,
    kind: input.kind,
    source: {
      src: input.src,
      artifactId: input.artifactId,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      title: input.title,
    },
    lifecycle: 'idle',
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    buffered: 0,
    status: 'idle',
    view: input.view ?? {},
    presentation: { ...DEFAULT_PRESENTATION, ...input.presentation },
    activeBackend: 'native',
    activeVisual: 'none',
    elementRef: null,
    pendingResume: null,
  };
}
