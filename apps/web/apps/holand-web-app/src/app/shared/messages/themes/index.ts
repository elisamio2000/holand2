import type { MessagesViewMode } from '@/types/messages.types';
import { mailboxTheme } from './mailbox-theme';
import { peopleTheme } from './people-theme';

export type MessagesLensTheme = typeof mailboxTheme | typeof peopleTheme;

export function getMessagesTheme(viewMode: MessagesViewMode): MessagesLensTheme {
  return viewMode === 'people' ? peopleTheme : mailboxTheme;
}

export { mailboxTheme, peopleTheme };
