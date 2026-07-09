import type { Meta, StoryObj } from '@storybook/react';
import { AudioPlayer } from '@/components/audio-player';
import { LAB_AUDIO_PLAYER_PROPS } from '@/app/shared/media-player-lab/fixtures/sample-media';

const meta: Meta<typeof AudioPlayer> = {
  title: 'Media/AudioPlayer',
  component: AudioPlayer,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['chatInline', 'ultraCompact', 'compact', 'mini', 'expanded', 'full', 'advanced'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof AudioPlayer>;

export const ChatInline: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'chatInline' },
};

export const UltraCompact: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'ultraCompact' },
};

export const Compact: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'compact' },
};

export const Mini: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'mini' },
};

export const Expanded: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'expanded' },
};

export const Full: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'full' },
};

export const Advanced: Story = {
  args: { ...LAB_AUDIO_PLAYER_PROPS, variant: 'advanced' },
};

export const LoadError: Story = {
  args: { src: '/test-media/missing-file.mp3', title: 'Missing file', variant: 'chatInline' },
};
