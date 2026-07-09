export type {
  MediaKind,
  PresentationSurface,
  SessionLifecycle,
  EngineBackend,
  VisualBackend,
  MediaSourceDescriptor,
  MediaPlaybackSnapshot,
  MediaViewFlags,
  MediaPresentationState,
  MediaPlaybackSession,
  CreateSessionInput,
  MediaSessionRemoteControls,
} from './core/types';

export { createEmptySession, DEFAULT_PRESENTATION } from './core/types';
export { assertNotTransitioning, canPlay, mergePlaybackTime, mergePlayingState } from './core/invariants';
export {
  captureSnapshot,
  beginPresentationTransition,
  completePresentationTransition,
  applySingleResume,
} from './core/transition-fsm';
export { useMediaSessionStore, useMediaSession } from './core/media-session-store';
export { videoEngineRegistry } from './core/video-engine-registry';
export type { RegisteredVideoEngine } from './core/video-engine-registry';
export { mediaSessionController } from './core/media-session-controller';
export {
  isWsPlaybackOwner,
  activeVisualForOwner,
  resolveHandoffSnapshot,
} from './core/playback-owner';
export type { WsPlaybackOwnerInput } from './core/playback-owner';
export { MediaElementHost } from './hosts/media-element-host';
export { MediaChromePortal } from './hosts/media-chrome-portal';
export { MediaLoadError } from './components/media-load-error';
export type { MediaLoadErrorProps, MediaLoadErrorKind } from './components/media-load-error';
export { useMediaPreview } from './integrations/use-media-preview';
export { MpsInlineAudioPlayer } from './integrations/mps-inline-audio';
export type {
  MpsInlineAudioPlayerProps,
  MpsInlineAudioExpandPayload,
} from './integrations/mps-inline-audio';
export { MpsUltraCompactAudio, MpsUltraCompactVideo, useMpsExpandFilePreview } from './integrations/mps-ultra-compact-media';
export type {
  MpsUltraCompactAudioProps,
  MpsUltraCompactVideoProps,
  MpsFilePreviewParams,
} from './integrations/mps-ultra-compact-media';
export { MediaPreviewPlaceholder } from './integrations/media-preview-placeholder';
export { useMediaStickyHandlers } from './integrations/use-media-sticky';
