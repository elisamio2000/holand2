import type { MessagesViewMode } from '@/types/messages.types';

/** Chat / people lens — conversational, person-first, teal accent */
export const peopleTheme = {
  id: 'people' as const satisfies MessagesViewMode,
  accent: 'teal',
  accentHex: '#0d9488',
  headerIcon: 'chat',
  panelClass: 'border-s-4 border-s-teal-500/40',
  listHeaderClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  activeTabClass: 'bg-teal-500 text-white',
  inactiveTabClass: 'text-gray-500 hover:bg-teal-50 dark:hover:bg-teal-950/30',
  activeRowClass: 'border-s-2 border-s-teal-500 bg-teal-500/5 dark:bg-teal-500/10',
  activeRowHover: 'hover:bg-teal-500/[0.04] dark:hover:bg-teal-500/10',
  badgeClass: 'bg-teal-500 text-white',
  unreadDotClass: 'bg-teal-500',
  composeBtnClass: 'bg-teal-500 hover:bg-teal-600 border-teal-500',
  detailPanelClass: 'min-h-0 flex-1 bg-gray-0 dark:bg-gray-50',
  bubbleOwnClass: 'rounded-tr-sm bg-teal-500 text-white',
  bubbleOtherClass: 'rounded-tl-sm border border-teal-500/20 bg-white dark:bg-gray-100',
} as const;

export type PeopleTheme = typeof peopleTheme;
