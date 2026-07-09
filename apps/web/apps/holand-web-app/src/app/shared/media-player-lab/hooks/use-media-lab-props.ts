'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AudioPlayerVariant } from '@/components/audio-player';
import type {
  VideoChromeMode,
  VideoFullscreenLayout,
  VideoPlaybackMode,
  VideoPlayerVariant,
} from '@/components/video-player/types';

export interface MediaLabProps {
  audioVariant: AudioPlayerVariant;
  showWaveform: boolean;
  enableRegions: boolean;
  stickyEnabled: boolean;
  playbackRate: number;
  videoVariant: VideoPlayerVariant;
  chromeMode: VideoChromeMode;
  fullscreenLayout: VideoFullscreenLayout;
  playbackMode: VideoPlaybackMode;
  showFilmstrip: boolean;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const DEFAULTS: MediaLabProps = {
  audioVariant: 'chatInline',
  showWaveform: false,
  enableRegions: false,
  stickyEnabled: false,
  playbackRate: 1,
  videoVariant: 'expanded',
  chromeMode: 'overlay',
  fullscreenLayout: 'cinema',
  playbackMode: 'inline',
  showFilmstrip: false,
};

const AUDIO_VARIANTS: AudioPlayerVariant[] = [
  'ultraCompact',
  'compact',
  'mini',
  'chatInline',
  'expanded',
  'full',
  'advanced',
];

const VIDEO_VARIANTS: VideoPlayerVariant[] = [
  'ultraCompact',
  'compact',
  'chatInline',
  'expanded',
  'full',
  'advanced',
  'pip',
];

function parseEnum<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  if (value && allowed.includes(value as T)) return value as T;
  return fallback;
}

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

function parseNumber(value: string | null, allowed: readonly number[], fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (Number.isFinite(n) && allowed.includes(n)) return n;
  return fallback;
}

export function useMediaLabProps() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const props = useMemo<MediaLabProps>(() => {
    const sp = searchParams;
    return {
      audioVariant: parseEnum(sp.get('audioVariant'), AUDIO_VARIANTS, DEFAULTS.audioVariant),
      showWaveform: parseBool(sp.get('showWaveform'), DEFAULTS.showWaveform),
      enableRegions: parseBool(sp.get('enableRegions'), DEFAULTS.enableRegions),
      stickyEnabled: parseBool(sp.get('stickyEnabled'), DEFAULTS.stickyEnabled),
      playbackRate: parseNumber(sp.get('playbackRate'), PLAYBACK_RATES, DEFAULTS.playbackRate),
      videoVariant: parseEnum(sp.get('videoVariant'), VIDEO_VARIANTS, DEFAULTS.videoVariant),
      chromeMode: parseEnum(
        sp.get('chromeMode'),
        ['barBelow', 'overlay'] as VideoChromeMode[],
        DEFAULTS.chromeMode
      ),
      fullscreenLayout: parseEnum(
        sp.get('fullscreenLayout'),
        ['standard', 'cinema', 'pro'] as VideoFullscreenLayout[],
        DEFAULTS.fullscreenLayout
      ),
      playbackMode: parseEnum(
        sp.get('playbackMode'),
        ['preview', 'inline', 'mini'] as VideoPlaybackMode[],
        DEFAULTS.playbackMode
      ),
      showFilmstrip: parseBool(sp.get('showFilmstrip'), DEFAULTS.showFilmstrip),
    };
  }, [searchParams]);

  const setProp = useCallback(
    <K extends keyof MediaLabProps>(key: K, value: MediaLabProps[K]) => {
      const next = new URLSearchParams(searchParams.toString());
      if (typeof value === 'boolean') {
        next.set(key, value ? '1' : '0');
      } else if (typeof value === 'number') {
        next.set(key, String(value));
      } else {
        next.set(key, String(value));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { props, setProp, defaults: DEFAULTS };
}

export { AUDIO_VARIANTS, VIDEO_VARIANTS, PLAYBACK_RATES };
