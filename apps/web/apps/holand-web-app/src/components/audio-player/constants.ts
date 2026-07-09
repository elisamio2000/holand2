import type { AudioPlayerPrefs, AudioPlayerSettings, AudioPlayerVariant } from './types';

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const REGION_COLORS = [
  'rgba(59,130,246,0.25)',
  'rgba(16,185,129,0.25)',
  'rgba(245,158,11,0.25)',
  'rgba(239,68,68,0.25)',
  'rgba(139,92,246,0.25)',
] as const;

export const ZOOM_LEVELS = [50, 100, 200, 400, 800] as const;

export const DEFAULT_AUDIO_SETTINGS: AudioPlayerSettings = {
  volume: 0.8,
  playbackRate: 1,
  isMuted: false,
  isLooping: false,
};

export const DEFAULT_AUDIO_PREFS: AudioPlayerPrefs = {
  ...DEFAULT_AUDIO_SETTINGS,
  stickyLayout: 'bar',
};

export function variantUsesMainWaveSurfer(v: AudioPlayerVariant | undefined): boolean {
  return v === 'full' || v === 'advanced' || v === 'compact';
}
