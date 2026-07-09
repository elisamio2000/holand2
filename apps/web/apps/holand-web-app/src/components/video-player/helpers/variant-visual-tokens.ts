import cn from '@core/utils/class-names';

/** Shared class bundles — mock layout adapted to app design tokens. */
export const vpTokens = {
  listRow: cn(
    'flex items-center gap-3 rounded-xl border border-muted bg-gray-0 px-3 py-2.5',
    'transition-colors hover:border-primary/20 dark:bg-gray-50'
  ),
  miniCard: cn(
    'flex items-center gap-2 rounded-xl border border-muted bg-gray-0 px-3 py-2',
    'dark:bg-gray-50'
  ),
  thumbnail: 'relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-200/30',
  miniThumbnail: 'relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-200/30',
  thumbnailOverlay: 'absolute inset-0 flex items-center justify-center bg-black/30',
  title: 'truncate text-sm font-medium text-gray-800 dark:text-gray-200',
  miniTitle: 'truncate text-xs font-medium text-gray-700 dark:text-gray-300',
  meta: 'truncate text-[11px] text-gray-400 dark:text-gray-500',
  formatBadge:
    'shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-200/30',
  playFab: cn(
    'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md',
    'transition-transform hover:scale-105 active:scale-95'
  ),
  playFabSm: 'h-8 w-8',
  playFabMd: 'h-10 w-10',
  playFabLg: 'h-14 w-14',
  stageOverlay: 'pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30',
  stageControls: cn(
    'absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-8',
    'bg-gradient-to-t from-black/80 via-black/40 to-transparent',
    'transition-opacity duration-300'
  ),
  overlayProgress: 'mb-2 h-1 w-full cursor-pointer rounded-full bg-white/25',
  cinemaHeader: 'absolute start-0 top-0 z-30 flex w-full items-center justify-between px-4 py-3',
  quickChip: cn(
    'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-gray-500',
    'transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-200/30'
  ),
  sidebarPanel: 'w-64 shrink-0 rounded-xl border border-muted bg-gray-0 dark:bg-gray-50',
  pipShell: cn(
    'fixed bottom-4 end-4 z-[90] w-80 overflow-hidden rounded-xl',
    'border border-primary/30 bg-gray-900 shadow-2xl'
  ),
} as const;
