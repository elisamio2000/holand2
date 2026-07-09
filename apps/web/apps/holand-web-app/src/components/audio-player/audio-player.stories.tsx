import type { Meta, StoryObj } from '@storybook/react';
import { AudioPlayer } from './index';
import type { AudioPlayerVariant } from './types';

const SAMPLE_SRC = '/test-media/female_02.mp3';

const VARIANTS: AudioPlayerVariant[] = [
  'ultraCompact',
  'compact',
  'mini',
  'chatInline',
  'expanded',
  'full',
  'advanced',
];

const meta: Meta<typeof AudioPlayer> = {
  title: 'Media/AudioPlayer',
  component: AudioPlayer,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    showWaveform: { control: 'boolean' },
    enableRegions: { control: 'boolean' },
    showShortcutsHint: { control: 'boolean' },
  },
  args: {
    src: SAMPLE_SRC,
    title: 'Lab Sample Audio',
    mimeType: 'audio/mpeg',
    variant: 'compact',
    showWaveform: false,
    enableRegions: false,
  },
};

export default meta;
type Story = StoryObj<typeof AudioPlayer>;

export const Default: Story = {};

export const WithWaveform: Story = {
  args: { variant: 'full', showWaveform: true, showShortcutsHint: true },
};

export const AdvancedTimeline: Story = {
  args: {
    variant: 'advanced',
    showWaveform: true,
    enableRegions: true,
    showTimeline: true,
    showShortcutsHint: true,
  },
};

export const VariantMatrix: Story = {
  render: (args) => (
    <div className="space-y-6">
      {VARIANTS.filter((v) => v !== 'sticky').map((variant) => (
        <div key={variant} className="rounded-lg border border-muted p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-primary">{variant}</p>
          <AudioPlayer
            {...args}
            variant={variant}
            showWaveform={variant === 'full' || variant === 'advanced'}
            enableRegions={variant === 'advanced'}
            showTimeline={variant === 'advanced'}
          />
        </div>
      ))}
    </div>
  ),
};
