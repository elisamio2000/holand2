'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import {
  PiCaretLeft,
  PiCaretRight,
  PiClockCounterClockwise,
  PiFolder,
  PiLinkBold,
  PiUserBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import type { MessageDetail, MessageItem, MessagesViewMode } from '@/types/messages.types';
import ThreadFilesPanel from './thread-files-panel';
import ThreadContextPanel from './thread-context-panel';
import ThreadLinksPanel from './thread-links-panel';
import ThreadActivityPanel from './thread-activity-panel';

export type MessagesRightRailTab = 'files' | 'context' | 'links' | 'activity';

type MessagesRightRailProps = {
  isOpen: boolean;
  tab: MessagesRightRailTab;
  viewMode: MessagesViewMode;
  message: MessageDetail | null;
  replies: MessageItem[];
  partnerId?: string | null;
  onTabChange: (tab: MessagesRightRailTab) => void;
  onClose: () => void;
};

export default function MessagesRightRail({
  isOpen,
  tab,
  viewMode,
  message,
  replies,
  partnerId,
  onTabChange,
  onClose,
}: MessagesRightRailProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const panelContent = (
    <>
      <div className="flex flex-shrink-0 items-stretch gap-0.5 border-b border-muted px-1.5 pb-1 pt-2">
        <Tooltip content={t('messages.rail.collapse')} placement="bottom">
          <button
            type="button"
            onClick={onClose}
            className="flex w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-200/20 lg:hidden"
            aria-label={t('messages.rail.collapse')}
          >
            <PiCaretRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={() => onTabChange('files')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
            tab === 'files'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
          )}
        >
          <PiFolder className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('messages.rail.sharedFiles')}</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('context')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
            tab === 'context'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
          )}
        >
          <PiUserBold className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('messages.rail.contactInfo')}</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('links')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
            tab === 'links'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
          )}
        >
          <PiLinkBold className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('messages.rail.links', 'Links')}</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('activity')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
            tab === 'activity'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
          )}
        >
          <PiClockCounterClockwise className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('messages.rail.activity', 'Activity')}</span>
        </button>
        <Tooltip content={t('messages.rail.collapse')} placement="bottom">
          <button
            type="button"
            onClick={onClose}
            className="hidden w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-200/20 lg:flex"
            aria-label={t('messages.rail.collapse')}
          >
            <PiCaretLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'files' ? (
          <ThreadFilesPanel message={message} replies={replies} />
        ) : tab === 'context' ? (
          <ThreadContextPanel message={message} partnerId={partnerId} />
        ) : tab === 'links' ? (
          <ThreadLinksPanel message={message} replies={replies} />
        ) : (
          <ThreadActivityPanel message={message} replies={replies} />
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile backdrop — starts below header (4.5rem = 72px, matches p-4 + h-10 avatar) */}
      <div
        className="fixed inset-x-0 bottom-0 top-[4.5rem] z-30 bg-black/30 backdrop-blur-sm transition-opacity lg:hidden"
        onClick={onClose}
        aria-label={t('messages.rail.collapse')}
      />

      {/* Panel — inline on lg+, fixed overlay on mobile */}
      <div
        className={cn(
          'flex min-h-0 flex-col overflow-hidden bg-gray-0 transition-all duration-300 ease-in-out dark:bg-gray-50',
          // Mobile: slide in from the right, starts below header
          'max-lg:fixed max-lg:top-[4.5rem] max-lg:bottom-0 max-lg:end-0 max-lg:z-40',
          'max-lg:h-[calc(100dvh-4.5rem)] max-lg:w-[280px] max-lg:border-s max-lg:border-muted max-lg:shadow-2xl',
          // Desktop: normal in-layout panel
          'lg:h-full lg:w-[270px] lg:shrink-0 lg:rounded-lg lg:border lg:border-muted lg:shadow-sm 2xl:w-72',
        )}
      >
        {panelContent}
      </div>
    </>
  );
}
