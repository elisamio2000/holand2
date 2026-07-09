import type { Meta, StoryObj } from '@storybook/react';
import MessageBubble from '@/app/shared/ai-chat/message-bubble';
import type { UIMessage } from '@/types/chat.types';

const userMessage: UIMessage = {
  id: 'msg-user-1',
  session_id: 'sess-lab',
  role: 'user',
  content: 'Show me a sample attachment preview in the lab.',
};

const assistantMessage: UIMessage = {
  id: 'msg-asst-1',
  session_id: 'sess-lab',
  role: 'assistant',
  content: 'Here is a **markdown** assistant reply for Storybook.',
};

const meta: Meta<typeof MessageBubble> = {
  title: 'AIChat/MessageBubble',
  component: MessageBubble,
  tags: ['autodocs'],
  args: {
    onFeedback: () => {},
    onToggleThinking: () => {},
    onOpenCanvas: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof MessageBubble>;

export const User: Story = {
  args: { message: userMessage },
};

export const Assistant: Story = {
  args: { message: assistantMessage },
};
