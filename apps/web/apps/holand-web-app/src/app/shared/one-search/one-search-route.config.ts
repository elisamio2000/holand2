import { routes } from '@/config/routes';

export const ONE_SEARCH_DEFAULT_BREADCRUMB = [
  { nameKey: 'pages.dashboard', href: '/' },
  { nameKey: 'pages.oneSearch' },
] as const;

export const ONE_SEARCH_ADVANCED_BREADCRUMB = [
  { nameKey: 'pages.dashboard', href: '/' },
  { nameKey: 'pages.oneSearch', href: routes.oneSearch.root },
  { nameKey: 'pages.oneSearchAdvanced' },
] as const;
