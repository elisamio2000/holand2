import type { MessagesViewMode } from '@/types/messages.types';

/** Email / mailbox lens — formal, subject-first, primary blue accent */
export const mailboxTheme = {
  id: 'mailbox' as const satisfies MessagesViewMode,
  accent: 'primary',
  accentHex: undefined as string | undefined,
  headerIcon: 'envelope',
  panelClass: 'border-s-4 border-s-primary/30',
  listHeaderClass: 'bg-primary/5 text-primary',
  activeTabClass: 'bg-primary text-white',
  inactiveTabClass: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-100',
  activeRowClass: 'border-s-2 border-s-primary bg-primary/5 dark:bg-primary/10',
  activeRowHover: 'hover:bg-primary/[0.03] dark:hover:bg-primary/10',
  badgeClass: 'bg-primary text-white',
  unreadDotClass: 'bg-primary',
  composeBtnClass: '',
  detailPanelClass: 'min-h-0 flex-1 bg-gray-0 dark:bg-gray-50',
  bubbleOwnClass: 'rounded-tr-sm bg-primary text-white',
  bubbleOtherClass: 'rounded-tl-sm border border-muted bg-gray-50 dark:bg-gray-100',
} as const;

export type MailboxTheme = typeof mailboxTheme;
