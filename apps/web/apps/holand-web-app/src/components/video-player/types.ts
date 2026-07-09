import type { MutableRefObject, ReactNode, RefObject } from 'react';

export type VideoPlayerVariant =
  | 'ultraCompact'
  | 'compact'
  | 'chatInline'
  | 'expanded'
  | 'full'
  | 'advanced'
  | 'pip';

/** Where control chrome renders relative to the video stage. */
export type VideoChromeMode = 'barBelow' | 'overlay';

/** Fullscreen presentation profile. */
export type VideoFullscreenLayout = 'standard' | 'cinema' | 'pro';

/** ultraCompact row interaction: preview opens modal; inline expands stage; mini plays in-place. */
export type VideoPlaybackMode = 'preview' | 'inline' | 'mini';

export type VideoPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'error'
  | 'unsupported';

export type PlaybackStrategy = 'native' | 'hls' | 'dash' | 'unsupported';

export interface VideoChapter {
  id: string;
  title: string;
  start: number;
  end?: number;
  thumbnailUrl?: string;
}

export interface VideoSubtitleTrack {
  id: string;
  label: string;
  language: string;
  src?: string;
  kind?: 'subtitles' | 'captions';
  default?: boolean;
}

export interface VideoSource {
  src: string;
  type?: string;
  quality?: string;
  label?: string;
}

/** A selectable rendition (resolution/bitrate) reported by the engine. */
export interface VideoQualityLevel {
  /** Stable id: numeric index for hls/dash, or quality string for multi-source. */
  id: string;
  label: string;
  height?: number;
  width?: number;
  bitrate?: number;
}

/** A selectable audio rendition reported by the engine. */
export interface VideoAudioTrack {
  id: string;
  label: string;
  language?: string;
}

/** Live snapshot of engine capabilities, surfaced to the UI. */
export interface EngineState {
  levels: VideoQualityLevel[];
  /** Active level id, or 'auto' when ABR picks automatically. */
  activeLevelId: string;
  /** True when ABR/auto level selection is enabled. */
  autoLevel: boolean;
  audioTracks: VideoAudioTrack[];
  activeAudioTrackId: string | null;
  isLive: boolean;
}

export interface VideoPlayerSettings {
  volume: number;
  playbackRate: number;
  isMuted: boolean;
  loop?: boolean;
  quality?: string;
  activeSubtitleId?: string | null;
}

export interface VideoPlayerControls {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
  requestFullscreen: () => void;
  requestPiP: () => void;
  takeScreenshot: () => Promise<Blob | null>;
}

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  /** ultraCompact: authenticated thumbnail layer (overrides poster img). */
  thumbnailSlot?: React.ReactNode;
  title?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  artifactId?: string;
  variant?: VideoPlayerVariant;
  /** Control chrome placement — overlay for expanded/cinema, barBelow for legacy. */
  chromeMode?: VideoChromeMode;
  /** Fullscreen UI profile (cinema = overlay + header; pro = advanced layout in FS). */
  fullscreenLayout?: VideoFullscreenLayout;
  /** ultraCompact: stable id for single-active-row registry. */
  rowId?: string;
  /** ultraCompact: when false, engine deferred until inline play. */
  inlinePlaybackActive?: boolean;
  /** ultraCompact: parent notified to activate inline engine. */
  onInlinePlaybackRequest?: () => void;
  /** ultraCompact: tap row body → open preview modal. */
  onRowPreview?: () => void;
  /** ultraCompact: `preview` = row only, play opens preview; `inline` = expand with video stage; `mini` = in-row play + seek bar, hidden video. */
playbackMode?: VideoPlaybackMode;
  sources?: VideoSource[];
  initialCurrentTime?: number;
  initialIsPlaying?: boolean;
  onMediaStateChange?: (currentTime: number, isPlaying: boolean) => void;
  syncVideoRef?: RefObject<HTMLVideoElement | null>;
  /** Media Playback Session — single element + controller for inline/modal handoff */
  mediaSessionId?: string;
  controlsRef?: MutableRefObject<VideoPlayerControls | null>;
  mirrorPlayback?: { currentTime: number; isPlaying: boolean };
  volume?: number;
  playbackRate?: number;
  isMuted?: boolean;
  onSettingsChange?: (settings: VideoPlayerSettings) => void;
  chapters?: VideoChapter[];
  subtitles?: VideoSubtitleTrack[];
  bookmarks?: number[];
  onChaptersLoad?: () => Promise<VideoChapter[]>;
  onSubtitlesLoad?: () => Promise<VideoSubtitleTrack[]>;
  onExpand?: () => void;
  onClose?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onBookmark?: (time: number) => void;
  onAnnotate?: () => void;
  onScreenshot?: () => void;
  onUnsupportedFormat?: (format: string, mimeType?: string) => void;
  moreMenuItems?: Array<{ icon: ReactNode; label: string; onClick: () => void }>;
  showFilmstrip?: boolean;
  showChaptersPanel?: boolean;
  showSubtitlesPanel?: boolean;
  showAdvancedMode?: boolean;
  onShowAdvancedModeChange?: (show: boolean) => void;
  enablePiP?: boolean;
  enableFullscreen?: boolean;
  /** When false, suppresses the metadata header card in the `full` variant. Defaults to true. */
  showHeader?: boolean;
  className?: string;
  /** chatInline only — `card` = nested bordered bar; `footer` = flat strip inside FilePreviewInline. */
  chatInlineLayout?: 'card' | 'footer';
  /** @deprecated Use variant + custom controls instead */
  showCustomControls?: boolean;
  /** Filmstrip sprite metadata for scrub preview (advanced / expanded overlay). */
  spriteMeta?: import('./timeline/filmstrip-timeline').FilmstripSpriteMeta | null;
}

export interface VideoPlaybackState {
  status: VideoPlaybackStatus;
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  isMuted: boolean;
  loop: boolean;
  errorMessage?: string;
  strategy: PlaybackStrategy;
  detectedFormat: string;
}

export interface VideoPlaybackActions {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setPlaybackRate: (r: number) => void;
  setLoop: (loop: boolean) => void;
  setActiveSubtitle: (id: string | null) => void;
  setQuality: (quality: string) => void;
  /** Select a quality level by engine id, or 'auto' for ABR. */
  setLevel: (id: string) => void;
  /** Select an audio track by engine id. */
  setAudioTrack: (id: string) => void;
  retry: () => void;
  takeScreenshot: () => Promise<Blob | null>;
  requestFullscreen: () => void;
  requestPiP: () => void;
}

export type UseVideoPlaybackReturn = VideoPlaybackState & VideoPlaybackActions & {
  videoRef: RefObject<HTMLVideoElement>;
  containerRef: RefObject<HTMLDivElement>;
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
  loadedChapters: VideoChapter[];
  loadedSubtitles: VideoSubtitleTrack[];
  activeSubtitleId: string | null;
  activeSource: VideoSource | null;
  settings: VideoPlayerSettings;
  engineState: EngineState;
  mirrorPlayback?: { currentTime: number; isPlaying: boolean };
  /** True when parent owns the &lt;video&gt; element via syncVideoRef. */
  usesExternalVideo?: boolean;
};

/**
 * Shared prop shape passed to every variant component.
 * Combines the public player props with the live playback controller.
 */
export type VariantProps = VideoPlayerProps & {
  playback: UseVideoPlaybackReturn;
};
