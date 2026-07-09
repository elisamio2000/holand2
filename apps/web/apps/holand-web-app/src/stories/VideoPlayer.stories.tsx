import type { Meta, StoryObj } from '@storybook/react';
import VideoPlayer from '@/components/video-player';
import { SAMPLE_VIDEO } from '@/app/shared/media-player-lab/fixtures/sample-media';

const base = {
  src: SAMPLE_VIDEO.src,
  title: SAMPLE_VIDEO.title,
  mimeType: SAMPLE_VIDEO.mimeType,
  duration: SAMPLE_VIDEO.duration,
  width: SAMPLE_VIDEO.width,
  height: SAMPLE_VIDEO.height,
  fileSize: SAMPLE_VIDEO.fileSize,
  enableFullscreen: true,
  enablePiP: true,
};

const meta: Meta<typeof VideoPlayer> = {
  title: 'Media/VideoPlayer',
  component: VideoPlayer,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['ultraCompact', 'compact', 'chatInline', 'expanded', 'full', 'advanced', 'pip'],
    },
    playbackMode: {
      control: 'select',
      options: ['preview', 'inline', 'mini'],
    },
    chromeMode: {
      control: 'select',
      options: ['barBelow', 'overlay'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof VideoPlayer>;

export const UltraCompactPreview: Story = {
  args: { ...base, variant: 'ultraCompact', playbackMode: 'preview' },
};

export const UltraCompactInline: Story = {
  args: { ...base, variant: 'ultraCompact', playbackMode: 'inline', inlinePlaybackActive: true },
};

export const Compact: Story = {
  args: { ...base, variant: 'compact' },
};

export const ExpandedOverlay: Story = {
  args: { ...base, variant: 'expanded', chromeMode: 'overlay', fullscreenLayout: 'cinema' },
};

export const Full: Story = {
  args: { ...base, variant: 'full', chromeMode: 'overlay', fullscreenLayout: 'cinema' },
};

export const Advanced: Story = {
  args: { ...base, variant: 'advanced', chromeMode: 'overlay', fullscreenLayout: 'pro' },
};

export const PipDock: Story = {
  args: { ...base, variant: 'pip', onClose: () => {} },
};

export const LoadError: Story = {
  args: { src: '/test-media/missing.mp4', title: 'Missing', variant: 'expanded' },
};
