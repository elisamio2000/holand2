import type { MutableRefObject, ReactNode, RefObject } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.js';

export interface AudioRegion {
  id: string;
  start: number;
  end: number;
  color?: string;
  label?: string;
}

export interface AudioPlayerControls {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
}

export interface AudioPlayerSettings {
  volume: number;
  playbackRate: number;
  isMuted: boolean;
  isLooping: boolean;
}

export type StickyLayout = 'bar' | 'dock';

export interface AudioPlayerPrefs extends AudioPlayerSettings {
  stickyLayout: StickyLayout;
}

export interface StickyControls {
  togglePlay?: () => void;
  seekTo?: (seconds: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export interface AudioPlayerSession {
  activeId: string | null;
  title?: string;
  src?: string;
  artifactId?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: string[];
  surfaceVisible: boolean;
  stickyEnabled: boolean;
  stickyLayout?: StickyLayout;
  queueIndex: number;
  queueLength: number;
  /** Linked Media Playback Session for sticky mirror state */
  mediaSessionId?: string;
}

export type AudioPlayerVariant =
  | 'chatInline'
  | 'ultraCompact'
  | 'compact'
  | 'mini'
  | 'expanded'
  | 'full'
  | 'advanced'
  | 'sticky';

export type PlaybackStrategy = 'blob-first' | 'presigned-first';

export interface AudioPlayerProps {
  /** Resolved playback URL (blob, base64, or public URL) */
  src?: string;
  /** Storage artifact — resolved internally via JWT blob-first when set */
  artifactId?: string;
  playbackStrategy?: PlaybackStrategy;
  title?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  initialCurrentTime?: number;
  initialIsPlaying?: boolean;
  onMediaStateChange?: (currentTime: number, isPlaying: boolean) => void;
  onRegionChange?: (regions: AudioRegion[]) => void;
  onRegionSelect?: (region: AudioRegion | null) => void;
  regions?: AudioRegion[];
  controlsRef?: MutableRefObject<AudioPlayerControls | null>;
  onSeek?: (progress: number) => void;
  showWaveform?: boolean;
  onShowWaveformChange?: (show: boolean) => void;
  enableRegions?: boolean;
  showTimeline?: boolean;
  showVolume?: boolean;
  showFileInfo?: boolean;
  showShortcutsHint?: boolean;
  showSkipButtons?: boolean;
  showSpeedControl?: boolean;
  showZoom?: boolean;
  showSkipEnds?: boolean;
  waveformHeight?: number;
  variant?: AudioPlayerVariant;
  progress?: number;
  syncAudioRef?: RefObject<HTMLAudioElement | null>;
  mirrorPlayback?: { currentTime: number; isPlaying: boolean; showWaveform?: boolean };
  className?: string;
  waveColor?: string;
  progressColor?: string;
  showHeader?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onTrim?: () => void;
  onAddMarker?: () => void;
  moreMenuItems?: Array<{ icon: ReactNode; label: string; onClick: () => void }>;
  volume?: number;
  playbackRate?: number;
  isMuted?: boolean;
  isLooping?: boolean;
  onSettingsChange?: (settings: AudioPlayerSettings) => void;
  /** Register this surface with the global session store */
  sessionId?: string;
  /** Media Playback Session — single element + controller for inline/modal handoff */
  mediaSessionId?: string;
  /** Opt-in scroll-to-sticky via GlobalAudioPlayerHost */
  stickyEnabled?: boolean;
  /** When false, unmount does not clear global session (parent owns lifecycle) */
  ownsGlobalSession?: boolean;
  /** Override prefs.stickyLayout for this surface */
  stickyLayout?: StickyLayout;
}

export interface UseAudioStickyAnchorOptions {
  enabled: boolean;
  sessionId: string;
  anchorRef: RefObject<HTMLElement | null>;
  /** Bumps observer when anchor element changes (e.g. new playing card id) */
  anchorKey?: string;
  stickyLayout?: StickyLayout;
  queueIndex?: number;
  queueLength?: number;
  handlers: StickyControls;
  threshold?: number;
  /** IntersectionObserver rootMargin — e.g. trigger sticky before anchor fully leaves */
  rootMargin?: string;
}

export interface StickyVariantProps {
  title?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  stickyLayout: StickyLayout;
  queueIndex?: number;
  queueLength?: number;
  showQueueControls?: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isLooping: boolean;
  className?: string;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleLoop: () => void;
  onSpeedChange: (speed: number) => void;
}

export interface UseAudioPlaybackReturn {
  resolvedSrc: string;
  srcLoading: boolean;
  srcError: boolean;
  retrySrc: () => void;
  variant: AudioPlayerVariant;
  title?: string;
  mimeType?: string;
  fileSize?: number;
  durationProp?: number;
  className?: string;
  showHeader: boolean;
  showFileInfo: boolean;
  showVolume: boolean;
  showSkipButtons: boolean;
  showSpeedControl: boolean;
  showZoom: boolean;
  showSkipEnds: boolean;
  showShortcutsHint: boolean;
  showTimeline: boolean;
  enableRegions: boolean;
  waveformHeight: number;
  progress?: number;
  mirrorPlayback?: { currentTime: number; isPlaying: boolean; showWaveform?: boolean };
  syncAudioRef?: RefObject<HTMLAudioElement | null>;
  onSeek?: (progress: number) => void;
  onExpand?: () => void;
  onClose?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onTrim?: () => void;
  onAddMarker?: () => void;
  moreMenuItems?: AudioPlayerProps['moreMenuItems'];
  isDark: boolean;
  isReady: boolean;
  wsAudioReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isMuted: boolean;
  isLooping: boolean;
  showWaveform: boolean;
  setShowWaveformVisible: (next: boolean) => void;
  loadError: boolean;
  handleRetryLoad: () => void;
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  isRegionMode: boolean;
  toggleRegionMode: () => void;
  userRegions: Region[];
  activeRegion: Region | null;
  removeActiveRegion: () => void;
  downloadRegion: () => Promise<void>;
  clearRegions: () => void;
  showSpeedMenu: boolean;
  setShowSpeedMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  showMoreMenu: boolean;
  setShowMoreMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  showVolumePopup: boolean;
  setShowVolumePopup: (v: boolean | ((p: boolean) => boolean)) => void;
  togglePlay: () => void;
  skipBack: () => void;
  skipForward: () => void;
  skipToStart: () => void;
  skipToEnd: () => void;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleMute: () => void;
  handleSpeedChange: (speed: number) => void;
  toggleLoop: () => void;
  seekToSeconds: (seconds: number) => void;
  isWsPlaybackOwner: () => boolean;
  /** @deprecated use isWsPlaybackOwner */
  isWaveSurferActive: () => boolean;
  getActiveAudio: () => HTMLAudioElement | null;
  wsRef: MutableRefObject<WaveSurfer | null>;
  waveformRef: MutableRefObject<HTMLDivElement | null>;
  inlineWaveformRef: MutableRefObject<HTMLDivElement | null>;
  timelineRef: MutableRefObject<HTMLDivElement | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  setIsFocused: (v: boolean) => void;
  isFocused: boolean;
  fallbackAudioEl: React.ReactNode;
  waveColor: string;
  progressColor: string;
  effectiveShowWaveform: boolean;
  isExpanded: boolean;
  isAdvanced: boolean;
  variantUsesMainWaveSurfer: boolean;
}

export type VariantProps = AudioPlayerProps & { playback: UseAudioPlaybackReturn };
