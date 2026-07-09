'use client';

import { useTranslation } from 'react-i18next';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiCaretLeft,
  PiX,
  PiChecks,
  PiRows,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type {
  MessageFolder,
  MessageItem,
  MessagesViewMode,
  PeopleConversation,
} from '@/types/messages.types';
import MailboxList from './mailbox-list';
import PeopleList from './people-list';
import MessagesFolderNav from './messages-folder-nav';
import UserStatusPicker from './components/user-status-picker';
import { useUserPresence } from '@/hooks/use-user-presence';

export type MessagesSidebarProps = {
  isOpen: boolean;
  viewMode: MessagesViewMode;
  folder: MessageFolder;
  searchQuery: string;
  loading: boolean;
  items: MessageItem[];
  peopleConversations: PeopleConversation[];
  selectedMessageId: string | null;
  selectedPartnerId: string | null;
  selectedIds: Set<string>;
  typingPartnerId?: string | null;
  selectionMode: boolean;
  isStarred: (id: string) => boolean;
  onClose: () => void;
  onCompose: () => void;
  onNewPeopleChat?: () => void;
  onSearchChange: (q: string) => void;
  onSelectMessage: (id: string) => void;
  onPeopleSelect: (messageId: string, partnerId: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleSelectionMode: () => void;
  listDensity?: 'comfortable' | 'compact';
  onToggleListDensity?: () => void;
  unreadCount?: number;
  onFolderSelect?: (folder: MessageFolder) => void;
};

export default function MessagesSidebar({
  isOpen,
  viewMode,
  folder,
  searchQuery,
  loading,
  items,
  peopleConversations,
  selectedMessageId,
  selectedPartnerId,
  selectedIds,
  typingPartnerId,
  selectionMode,
  isStarred,
  onClose,
  onCompose,
  onNewPeopleChat,
  onSearchChange,
  onSelectMessage,
  onPeopleSelect,
  onToggleSelect,
  onToggleStar,
  onToggleSelectionMode,
  listDensity = 'comfortable',
  onToggleListDensity,
  unreadCount = 0,
  onFolderSelect,
}: MessagesSidebarProps) {
  const { t } = useTranslation();
  const isPeople = viewMode === 'people';
  const { status: presenceStatus, setStatus: setPresenceStatus } = useUserPresence();

  const title = isPeople
    ? t('messages.people')
    : t(`messages.folders.${folder}`);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-[4.5rem] z-50 bg-black/30 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onClose}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}

      <div
        className={cn(
          'relative z-40 flex min-h-0 max-h-full flex-col overflow-hidden bg-gray-0 transition-all duration-300 ease-in-out dark:bg-gray-50',
          'max-lg:fixed max-lg:top-[4.5rem] max-lg:bottom-0 max-lg:start-0 max-lg:z-[60] max-lg:h-[calc(100dvh-4.5rem)] max-lg:border-e max-lg:border-muted max-lg:shadow-2xl',
          isOpen
            ? cn(
                'w-[270px] translate-x-0 opacity-100 2xl:w-72',
                'lg:h-full lg:min-h-0 lg:max-h-full lg:shrink-0 lg:self-stretch',
                'lg:rounded-lg lg:border lg:border-muted lg:shadow-sm'
              )
            : 'pointer-events-none invisible w-0 overflow-hidden opacity-0 ltr:max-lg:-translate-x-full rtl:max-lg:translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-shrink-0 items-center justify-between px-3 pt-4 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-700">{title}</h2>
            {isPeople && (
              <UserStatusPicker
                status={presenceStatus}
                onChange={setPresenceStatus}
                compact={false}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isPeople && onToggleListDensity && (
              <button
                type="button"
                onClick={onToggleListDensity}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20"
                aria-label={t('messages.list.toggleDensity')}
                title={
                  listDensity === 'comfortable'
                    ? t('messages.list.densityCompact')
                    : t('messages.list.densityComfortable')
                }
              >
                <PiRows className="h-4 w-4" />
              </button>
            )}
            {!isPeople && (
              <button
                type="button"
                onClick={onToggleSelectionMode}
                className={cn(
                  'rounded-lg p-1.5 transition-colors',
                  selectionMode
                    ? 'bg-primary/15 text-primary hover:bg-primary/25'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20'
                )}
                aria-label={t('messages.bulk.toggle')}
                title={t('messages.bulk.toggle')}
              >
                <PiChecks className="h-4 w-4" />
              </button>
            )}
            {!isPeople ? (
              <button
                type="button"
                onClick={onCompose}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20"
                aria-label={t('messages.composeLabel')}
                title={t('messages.composeLabel')}
              >
                <PiPlus className="h-4 w-4" />
              </button>
            ) : onNewPeopleChat ? (
              <button
                type="button"
                onClick={onNewPeopleChat}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-teal-500/10 hover:text-teal-600 dark:hover:bg-teal-500/20 dark:hover:text-teal-400"
                aria-label={t('messages.lens.people.newChat')}
                title={t('messages.lens.people.newChat')}
              >
                <PiPlus className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20"
              aria-label={t('messages.sidebar.collapse')}
              title={t('messages.sidebar.collapse')}
            >
              <PiCaretLeft className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* Search — above folder nav */}
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="relative">
            <PiMagnifyingGlass className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('messages.searchPlaceholder')}
              className="w-full rounded-md border border-muted bg-gray-0 py-1.5 ps-8 pe-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-primary/40 dark:bg-gray-50 dark:text-gray-300"
              dir="auto"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Folder nav — below search, aligned with same px-3 pb-2 */}
        {!isPeople && onFolderSelect && (
          <div className="flex-shrink-0 px-3 pb-2">
            <MessagesFolderNav
              folder={folder}
              unreadCount={unreadCount}
              onFolderSelect={onFolderSelect}
            />
          </div>
        )}

        <div className="custom-scrollbar scrollbar-no-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {isPeople ? (
            <PeopleList
              conversations={peopleConversations}
              loading={loading}
              selectedPartnerId={selectedPartnerId}
              typingPartnerId={typingPartnerId}
              onSelect={onPeopleSelect}
            />
          ) : (
            <MailboxList
              items={items}
              folder={folder}
              loading={loading}
              selectedId={selectedMessageId}
              selectedIds={selectedIds}
              onSelect={onSelectMessage}
              onToggleSelect={onToggleSelect}
              isStarred={isStarred}
              onToggleStar={onToggleStar}
              showCheckboxes={selectionMode}
              density={listDensity}
            />
          )}
        </div>
      </div>
    </>
  );
}
