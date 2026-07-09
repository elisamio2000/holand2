'use client';

import { Suspense } from 'react';
import type { AudioPlayerVariant } from '@/components/audio-player';
import type {
  VideoChromeMode,
  VideoFullscreenLayout,
  VideoPlaybackMode,
  VideoPlayerVariant,
} from '@/components/video-player/types';
import { PropsPanel, type PropsPanelField } from '@/platform/lab';
import {
  AUDIO_VARIANTS,
  PLAYBACK_RATES,
  useMediaLabProps,
  VIDEO_VARIANTS,
} from '../hooks/use-media-lab-props';

function MediaLabPropsPanelInner() {
  const { props, setProp } = useMediaLabProps();

  const fields: PropsPanelField[] = [
    {
      id: 'audioVariant',
      label: 'Audio variant',
      value: props.audioVariant,
      options: AUDIO_VARIANTS.map((v) => ({ value: v, label: v })),
      onChange: (v) => setProp('audioVariant', v as AudioPlayerVariant),
    },
    {
      id: 'videoVariant',
      label: 'Video variant',
      value: props.videoVariant,
      options: VIDEO_VARIANTS.map((v) => ({ value: v, label: v })),
      onChange: (v) => setProp('videoVariant', v as VideoPlayerVariant),
    },
    {
      id: 'chromeMode',
      label: 'Chrome',
      value: props.chromeMode,
      options: [
        { value: 'overlay', label: 'overlay' },
        { value: 'barBelow', label: 'barBelow' },
      ],
      onChange: (v) => setProp('chromeMode', v as VideoChromeMode),
    },
    {
      id: 'fullscreenLayout',
      label: 'Fullscreen layout',
      value: props.fullscreenLayout,
      options: [
        { value: 'standard', label: 'standard' },
        { value: 'cinema', label: 'cinema' },
        { value: 'pro', label: 'pro' },
      ],
      onChange: (v) => setProp('fullscreenLayout', v as VideoFullscreenLayout),
    },
    {
      id: 'playbackMode',
      label: 'ultraCompact mode',
      value: props.playbackMode,
      options: [
        { value: 'preview', label: 'preview' },
        { value: 'inline', label: 'inline' },
        { value: 'mini', label: 'mini' },
      ],
      onChange: (v) => setProp('playbackMode', v as VideoPlaybackMode),
    },
    {
      id: 'playbackRate',
      label: 'Playback rate',
      value: String(props.playbackRate),
      options: PLAYBACK_RATES.map((r) => ({
        value: String(r),
        label: r === 1 ? '1x' : `${r}x`,
      })),
      onChange: (v) => setProp('playbackRate', Number(v)),
    },
  ];

  return (
    <PropsPanel
      title="Gallery props (URL-synced)"
      className="w-full sm:ml-auto sm:max-w-none"
      fields={fields}
      toggles={[
        {
          id: 'showWaveform',
          label: 'Waveform',
          checked: props.showWaveform,
          onChange: (v) => setProp('showWaveform', v),
        },
        {
          id: 'enableRegions',
          label: 'Regions',
          checked: props.enableRegions,
          onChange: (v) => setProp('enableRegions', v),
        },
        {
          id: 'stickyEnabled',
          label: 'Sticky audio',
          checked: props.stickyEnabled,
          onChange: (v) => setProp('stickyEnabled', v),
        },
        {
          id: 'showFilmstrip',
          label: 'Filmstrip',
          checked: props.showFilmstrip,
          onChange: (v) => setProp('showFilmstrip', v),
        },
      ]}
    />
  );
}

export function MediaLabPropsPanel() {
  return (
    <Suspense fallback={null}>
      <MediaLabPropsPanelInner />
    </Suspense>
  );
}
