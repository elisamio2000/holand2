import type { Meta, StoryObj } from '@storybook/react';
import VideoPlayer from './index';
import type { VideoChromeMode, VideoPlayerVariant } from './types';

const SAMPLE_SRC = '/test-media/test-video.mp4';

const VARIANTS: VideoPlayerVariant[] = [
  'ultraCompact',
  'compact',
  'chatInline',
  'expanded',
  'full',
  'advanced',
];

const meta: Meta<typeof VideoPlayer> = {
  title: 'Media/VideoPlayer',
  component: VideoPlayer,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    chromeMode: { control: 'select', options: ['overlay', 'barBelow'] as VideoChromeMode[] },
    playbackMode: { control: 'select', options: ['preview', 'inline', 'mini'] },
    enableFullscreen: { control: 'boolean' },
    enablePiP: { control: 'boolean' },
  },
  args: {
    src: SAMPLE_SRC,
    title: 'Lab Sample Video',
    mimeType: 'video/mp4',
    duration: 30,
    variant: 'expanded',
    chromeMode: 'overlay',
    enableFullscreen: true,
    enablePiP: true,
    rowId: 'storybook-default',
  },
};

export default meta;
type Story = StoryObj<typeof VideoPlayer>;

export const Default: Story = {};

export const AdvancedPro: Story = {
  args: {
    variant: 'advanced',
    chromeMode: 'overlay',
    fullscreenLayout: 'pro',
    showFilmstrip: true,
  },
};

export const VariantMatrix: Story = {
  render: (args) => (
    <div className="space-y-6">
      {VARIANTS.map((variant) => (
        <div key={variant} className="rounded-lg border border-muted p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-primary">{variant}</p>
          <VideoPlayer {...args} variant={variant} rowId={`story-${variant}`} />
        </div>
      ))}
    </div>
  ),
};
