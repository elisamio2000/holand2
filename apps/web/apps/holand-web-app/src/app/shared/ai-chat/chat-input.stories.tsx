import type { Meta, StoryObj } from '@storybook/react';
import ChatInput from '@/app/shared/ai-chat/chat-input';

const meta: Meta<typeof ChatInput> = {
  title: 'AIChat/ChatInput',
  component: ChatInput,
  tags: ['autodocs'],
  args: {
    onSend: () => {},
    isStreaming: false,
    onStop: () => {},
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof ChatInput>;

export const Default: Story = {};

export const Streaming: Story = {
  args: { isStreaming: true },
};
