import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.js';
import { formatTime } from '../utils/format-time';

export type WaveSurferBackend = 'MediaElement' | 'WebAudio';

export interface WaveSurferColorScheme {
  waveColor: string;
  progressColor: string;
  cursorColor: string;
}

export function resolveWaveSurferBackend(src: string): WaveSurferBackend {
  try {
    const url = new URL(src, window.location.origin);
    return url.origin !== window.location.origin ? 'MediaElement' : 'WebAudio';
  } catch {
    return 'WebAudio';
  }
}

export interface BuildMainPluginsOptions {
  enableRegions: boolean;
  showTimeline: boolean;
  timelineContainer: HTMLElement | null;
  isDark: boolean;
  regionsRef: { current: ReturnType<typeof RegionsPlugin.create> | null };
}

type WaveSurferPlugin =
  | ReturnType<typeof RegionsPlugin.create>
  | ReturnType<typeof TimelinePlugin.create>
  | ReturnType<typeof HoverPlugin.create>;

export function buildMainWaveSurferPlugins(options: BuildMainPluginsOptions) {
  const plugins: WaveSurferPlugin[] = [];

  if (options.enableRegions) {
    const regions = RegionsPlugin.create();
    options.regionsRef.current = regions;
    plugins.push(regions);
  } else {
    options.regionsRef.current = null;
  }

  if (options.showTimeline && options.timelineContainer) {
    plugins.push(
      TimelinePlugin.create({
        container: options.timelineContainer,
        formatTimeCallback: formatTime,
        timeInterval: 0.5,
        primaryLabelInterval: 5,
        style: {
          fontSize: '10px',
          color: options.isDark ? '#9ca3af' : '#9ca3af',
        },
      })
    );
  }

  plugins.push(
    HoverPlugin.create({
      lineColor: options.isDark ? '#818cf8' : '#6366f1',
      lineWidth: 1,
      labelBackground: options.isDark ? '#1f2937' : '#f9fafb',
      labelColor: options.isDark ? '#e5e7eb' : '#374151',
      labelSize: '11px',
    })
  );

  return plugins;
}

export interface CreateMainWaveSurferOptions extends WaveSurferColorScheme {
  container: HTMLElement;
  height: number;
  enableRegions: boolean;
  showTimeline: boolean;
  timelineContainer: HTMLElement | null;
  isDark: boolean;
  regionsRef: { current: ReturnType<typeof RegionsPlugin.create> | null };
  src: string;
  media?: HTMLMediaElement | null;
}

export function createMainWaveSurfer(options: CreateMainWaveSurferOptions) {
  const plugins = buildMainWaveSurferPlugins({
    enableRegions: options.enableRegions,
    showTimeline: options.showTimeline,
    timelineContainer: options.timelineContainer,
    isDark: options.isDark,
    regionsRef: options.regionsRef,
  });

  return WaveSurfer.create({
    container: options.container,
    height: options.height,
    waveColor: options.waveColor,
    progressColor: options.progressColor,
    cursorColor: options.cursorColor,
    cursorWidth: 2,
    barWidth: 3,
    barGap: 1,
    barRadius: 2,
    normalize: true,
    ...(options.media
      ? {
          media: options.media,
          backend: 'MediaElement' as const,
        }
      : {
          backend: resolveWaveSurferBackend(options.src),
        }),
    plugins,
  });
}

export interface CreateInlineWaveSurferOptions extends WaveSurferColorScheme {
  container: HTMLElement;
  src: string;
  media?: HTMLMediaElement | null;
}

export function createInlineWaveSurfer(options: CreateInlineWaveSurferOptions) {
  return WaveSurfer.create({
    container: options.container,
    height: 24,
    waveColor: options.waveColor,
    progressColor: options.progressColor,
    cursorColor: options.cursorColor,
    cursorWidth: 1,
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    normalize: true,
    interact: true,
    ...(options.media
      ? {
          media: options.media,
          backend: 'MediaElement' as const,
        }
      : {
          backend: resolveWaveSurferBackend(options.src),
        }),
  });
}
