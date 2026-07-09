import { routes } from '@/config/routes';

export type CommandPaletteEntry =
  | { type: 'section'; nameKey: string }
  | { type: 'page'; nameKey: string; href: string; keywords?: string[] };

/** Real app routes for the command palette Pages tab. */
export const commandPaletteEntries: CommandPaletteEntry[] = [
  { type: 'section', nameKey: 'commandPalette.sections.platform' },
  { type: 'page', nameKey: 'nav.aiChat', href: routes.aiChat.root, keywords: ['chat', 'ai'] },
  {
    type: 'page',
    nameKey: 'nav.oneSearch',
    href: routes.oneSearch.root,
    keywords: ['search', 'one search'],
  },
  {
    type: 'page',
    nameKey: 'nav.caseImporter',
    href: routes.caseImporter.dashboard,
    keywords: ['import'],
  },

  { type: 'section', nameKey: 'commandPalette.sections.casesAndFiles' },
  { type: 'page', nameKey: 'nav.cases', href: routes.cases.list, keywords: ['case'] },
  { type: 'page', nameKey: 'nav.createCase', href: routes.cases.create },
  { type: 'page', nameKey: 'nav.fileExplorer', href: routes.fileExplorer, keywords: ['files'] },
  { type: 'page', nameKey: 'nav.storage', href: routes.storage },

  { type: 'section', nameKey: 'commandPalette.sections.communication' },
  { type: 'page', nameKey: 'nav.messages', href: routes.messages, keywords: ['inbox', 'mail'] },
  { type: 'page', nameKey: 'nav.calendar', href: routes.eventCalendar, keywords: ['calendar'] },

  { type: 'section', nameKey: 'commandPalette.sections.explore' },
  { type: 'page', nameKey: 'nav.graphExplorer', href: routes.graphExplorer, keywords: ['graph'] },
  { type: 'page', nameKey: 'nav.offlineMap', href: routes.offlineMap },
  { type: 'page', nameKey: 'nav.plugins', href: routes.plugins.dashboard, keywords: ['tools'] },
];

export type CommandPaletteQuickAction = {
  id: string;
  nameKey: string;
  hintKey: string;
};

export const commandPaletteQuickActions: CommandPaletteQuickAction[] = [
  {
    id: 'ai',
    nameKey: 'commandPalette.actions.openAi',
    hintKey: 'commandPalette.actions.openAiHint',
  },
  {
    id: 'support',
    nameKey: 'commandPalette.actions.supportChat',
    hintKey: 'commandPalette.actions.supportChatHint',
  },
  {
    id: 'bug',
    nameKey: 'commandPalette.actions.reportBug',
    hintKey: 'commandPalette.actions.reportBugHint',
  },
];
