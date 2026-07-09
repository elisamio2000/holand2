import type { MessageDetail, MessageItem } from '@/types/messages.types';
import { parseBoardLinkFromMessageBody } from '../components/board-link-message-card';

export function isBoardLinkMessage(message: MessageItem | MessageDetail): boolean {
  const body = ('body' in message && message.body) || message.preview || '';
  return Boolean(parseBoardLinkFromMessageBody(body));
}

export function getBoardLinkFromMessage(
  message: MessageItem | MessageDetail
): { boardId: string; title?: string } | null {
  const body = ('body' in message && message.body) || message.preview || '';
  return parseBoardLinkFromMessageBody(body);
}
