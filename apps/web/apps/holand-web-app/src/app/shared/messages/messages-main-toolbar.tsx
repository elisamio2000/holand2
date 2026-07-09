'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import {
  PiList,
  PiPencilSimpleBold,
  PiFolder,
  PiUserBold,
  PiTrayBold,
  PiChatCircleTextBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { MessageFolder, MessagesViewMode } from '@/types/messages.types';
import type { ListQuickFilter } from './utils/list-quick-filter';

type MessagesMainToolbarProps = {
  isListOpen: boolean;
  viewMode: MessagesViewMode;
  folder: MessageFolder;
  unreadCount: number;
  title?: string;
  hasSelectedThread?: boolean;
  filesRailOpen: boolean;
  contextRailOpen: boolean;
  onOpenList: () => void;
  onCompose: () => void;
  onViewModeChange: (mode: MessagesViewMode) => void;
  onFolderSelect: (folder: MessageFolder) => void;
  onToggleFilesRail: () => void;
  onToggleContextRail: () => void;
  listQuickFilter?: ListQuickFilter;
  onListQuickFilterChange?: (filter: ListQuickFilter) => void;
  onOpenCommandPalette?: () => void;
};

/**
 * Adaptive badge — white background, red text.
 * Shape adapts to content: single digit stays near-circular,
 * multi-digit stretches naturally into a pill.
 * Threshold: numbers > 99 display as "99+".
 */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        // base: white pill, red text, tabular digits so width is stable
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-white text-red-500 tabular-nums',
        'h-[1.125rem] min-w-[1.125rem] px-1',
        'text-[10px] font-bold leading-none',
        // subtle red ring so it reads against any background
        'ring-1 ring-red-200',
      )}
    >
      {label}
    </span>
  );
}

export default function MessagesMainToolbar({
  isListOpen,
  viewMode,
  folder,
  unreadCount,
  title,
  hasSelectedThread = false,
  filesRailOpen,
  contextRailOpen,
  onOpenList,
  onCompose,
  onViewModeChange,
  onToggleFilesRail,
  onToggleContextRail,
  listQuickFilter = 'all',
  onListQuickFilterChange,
  onOpenCommandPalette,
}: MessagesMainToolbarProps) {
  const { t } = useTranslation();
  const isPeople = viewMode === 'people';
  const mailboxLabel = t(`messages.folders.${folder}`);
  const peopleLabel = t('messages.people');

  const iconBtn =
    'rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300';

  // Both segments always show icon + text (sm+) so the switch width never jumps.
  // On xs: icon only to save space; tooltip still works.
  const segBase =
    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors';
  const segActive = (color: 'primary' | 'teal') =>
    color === 'primary'
      ? 'bg-primary text-white'
      : 'bg-teal-500 text-white';
  const segInactive =
    'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20 dark:text-gray-400';

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-muted px-4 py-2">
      {/* ── Left: list toggle + mode switch ────────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!isListOpen && (
          <>
            <Tooltip content={t('messages.sidebar.expand')} placement="bottom">
              <button
                type="button"
                onClick={onOpenList}
                className={iconBtn}
                aria-label={t('messages.sidebar.expand')}
              >
                <PiList className="h-5 w-5" />
              </button>
            </Tooltip>
            <div className="h-5 w-px bg-muted" />
          </>
        )}

        {/* Mode switch — fixed width: both segments always show label */}
        <div className="flex shrink-0 items-center rounded-lg border border-muted p-0.5">
          <Tooltip content={mailboxLabel} placement="bottom">
            <button
              type="button"
              onClick={() => onViewModeChange('mailbox')}
              aria-label={mailboxLabel}
              className={cn(segBase, !isPeople ? segActive('primary') : segInactive)}
            >
              <PiTrayBold className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{mailboxLabel}</span>
              {!isPeople && folder === 'inbox' && (
                <UnreadBadge count={unreadCount} />
              )}
            </button>
          </Tooltip>
          <Tooltip content={peopleLabel} placement="bottom">
            <button
              type="button"
              onClick={() => onViewModeChange('people')}
              aria-label={peopleLabel}
              className={cn(segBase, isPeople ? segActive('teal') : segInactive)}
            >
              <PiChatCircleTextBold className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{peopleLabel}</span>
            </button>
          </Tooltip>
        </div>

        {/* Thread subject — only when a thread is open */}
        {hasSelectedThread && title && (
          <>
            <div className="h-5 w-px bg-muted" />
            <span className="min-w-0 truncate text-sm font-medium text-gray-700 dark:text-gray-300">
              {title}
            </span>
          </>
        )}
      </div>

      {!isPeople && onListQuickFilterChange && (
        <div className="mx-2 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {(['all', 'unread', 'starred', 'attachments'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onListQuickFilterChange(filter)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                listQuickFilter === filter
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20'
              )}
            >
              {t(`messages.filters.${filter}`, filter)}
            </button>
          ))}
        </div>
      )}

      {/* ── Right: action buttons ───────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1">
        {onOpenCommandPalette && (
          <Tooltip content={t('messages.commandPalette.hint', '⌘K')} placement="bottom">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className={iconBtn}
              aria-label={t('messages.commandPalette.title', 'Messages commands')}
            >
              <span className="text-xs font-semibold">⌘K</span>
            </button>
          </Tooltip>
        )}
        {isPeople ? (
          <>
            <Tooltip content={t('messages.rail.sharedFiles')} placement="bottom">
              <button
                type="button"
                onClick={onToggleFilesRail}
                className={cn(iconBtn, filesRailOpen && 'bg-teal-500/10 text-teal-600 dark:text-teal-500')}
                aria-label={t('messages.rail.sharedFiles')}
              >
                <PiFolder className="h-5 w-5" />
              </button>
            </Tooltip>
            <Tooltip content={t('messages.rail.contactInfo')} placement="bottom">
              <button
                type="button"
                onClick={onToggleContextRail}
                className={cn(iconBtn, contextRailOpen && 'bg-teal-500/10 text-teal-600 dark:text-teal-500')}
                aria-label={t('messages.rail.contactInfo')}
              >
                <PiUserBold className="h-5 w-5" />
              </button>
            </Tooltip>
          </>
        ) : (
          <Tooltip content={t('messages.composeLabel')} placement="bottom">
            <button
              type="button"
              onClick={onCompose}
              className={iconBtn}
              aria-label={t('messages.composeLabel')}
            >
              <PiPencilSimpleBold className="h-5 w-5" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
