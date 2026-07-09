// ============================================
// ChatSidebar — Session list with search, new chat, and management
// Left sidebar for conversation history
// ============================================

'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiTrash,
  PiPencilSimple,
  PiArchive,
  PiArrowCounterClockwise,
  PiPushPin,
  PiPushPinFill,
  PiDotsThreeVertical,
  PiChatCircleDots,
  PiX,
  PiClock,
  PiCaretLeft,
  PiEraser,
  PiShareNetwork,
  PiChecks,
  PiDownloadSimple,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Loader } from 'rizzui';
import { ContentLoadingState } from '@/app/shared/loading';
import SessionFoldersSection from './components/session-folders-section';
import type { ChatSessionFolder } from '@/types/chat.types';
import ChatSidebarSearchResults from './components/chat-sidebar-search-results';
import type { ChatSearchResult, ChatSearchTab } from './hooks/use-chat-search';
import type { ChatSession, SharedWithMeSession } from '@/types/chat.types';

interface ChatSidebarProps {
  /** All sessions (filtered) */
  sessions: ChatSession[];
  /** Pinned sessions */
  pinnedSessions: ChatSession[];
  /** Regular sessions */
  regularSessions: ChatSession[];
  /** Archived sessions (when showArchived) */
  archivedSessions: ChatSession[];
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Whether sessions are loading */
  isLoading: boolean;
  /** Search query */
  searchQuery: string;
  /** Show archived toggle state */
  showArchived: boolean;
  /** Sidebar open state */
  isOpen: boolean;

  // Actions
  onCreateNew: () => void;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, newTitle: string) => void;
  onDelete: (sessionId: string) => void;
  onToggleArchive: (sessionId: string, archive: boolean) => void;
  onTogglePin: (sessionId: string, pin: boolean) => void;
  onSearchChange: (query: string) => void;
  onShowArchivedChange: (show: boolean) => void;
  onClose: () => void;
  /** Clear all messages in a session */
  onClearMessages?: () => void;
  /** Share session — opens share modal for this session */
  onShare?: (sessionId: string) => void;
  /** Bulk delete selected session ids */
  onBulkDelete?: (sessionIds: string[]) => void | Promise<void>;
  /** Bulk archive / unarchive */
  onBulkArchive?: (sessionIds: string[], archive: boolean) => void | Promise<void>;
  /** Sessions shared with the current user (from GET /chat/sessions/shared-with-me) */
  sharedWithMeSessions?: SharedWithMeSession[];
  isLoadingSharedWithMe?: boolean;
  /** Session ids the user can only view read-only (shared with me) */
  sharedReadOnlySessionIds?: Set<string>;
  /** True while active session messages are loading */
  isLoadingMessages?: boolean;
  /** Backup all conversations */
  onBackupAll?: () => void;
  /** Backup selected session ids */
  onBulkBackup?: (sessionIds: string[]) => void;
  /** Ref for sidebar search input (keyboard shortcut focus) */
  searchInputRef?: React.RefObject<HTMLInputElement>;
  /** Advanced search — session title matches */
  sessionSearchResults?: ChatSearchResult[];
  /** Advanced search — message content matches */
  messageSearchResults?: ChatSearchResult[];
  /** Advanced search — file name matches */
  fileSearchResults?: ChatSearchResult[];
  isSearchingMessages?: boolean;
  searchActiveTab?: ChatSearchTab;
  onSearchTabChange?: (tab: ChatSearchTab) => void;
  onSearchSelectSession?: (sessionId: string) => void;
  onSearchSelectMessage?: (sessionId: string, messageId: string) => void;
  onSearchSelectFile?: (
    sessionId: string,
    artifactId: string | undefined,
    fileName: string | undefined,
    mimeType: string | undefined,
    messageId?: string
  ) => void;
  onSearchExpand?: () => void;
  onOpenDevPanel?: () => void;
  folders?: ChatSessionFolder[];
  activeFolderId?: string | null;
  onActiveFolderChange?: (folderId: string | null) => void;
  foldersAvailable?: boolean;
  foldersLoading?: boolean;
  onCreateFolder?: (data: { name: string; color?: string }) => Promise<void>;
  onUpdateFolder?: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onMoveSessionToFolder?: (sessionId: string, folderId: string | null) => Promise<void>;
  projectsSection?: React.ReactNode;
  onBackupFolder?: () => void;
  onBackupProject?: () => void;
}

/**
 * ChatSidebar — Conversation history sidebar.
 *
 * Features:
 * - New chat button
 * - Search/filter sessions
 * - Pinned sessions section
 * - Session list with hover actions (rename, delete, archive, pin)
 * - Inline rename editing
 * - Show/hide archived sessions toggle
 * - Responsive collapse
 *
 * @example
 * ```tsx
 * <ChatSidebar
 *   sessions={sessions}
 *   activeSessionId={activeSessionId}
 *   onSelect={selectSession}
 *   ...
 * />
 * ```
 */
export default function ChatSidebar({
  pinnedSessions,
  regularSessions,
  archivedSessions,
  activeSessionId,
  isLoading,
  searchQuery,
  showArchived,
  isOpen,
  onCreateNew,
  onSelect,
  onRename,
  onDelete,
  onToggleArchive,
  onTogglePin,
  onSearchChange,
  onShowArchivedChange,
  onClose,
  onClearMessages,
  onShare,
  onBulkDelete,
  onBulkArchive,
  sharedWithMeSessions = [],
  isLoadingSharedWithMe = false,
  sharedReadOnlySessionIds,
  isLoadingMessages = false,
  onBackupAll,
  onBulkBackup,
  searchInputRef,
  sessionSearchResults = [],
  messageSearchResults = [],
  fileSearchResults = [],
  isSearchingMessages = false,
  searchActiveTab = 'sessions',
  onSearchTabChange,
  onSearchSelectSession,
  onSearchSelectMessage,
  onSearchSelectFile,
  onSearchExpand,
  onOpenDevPanel,
  folders = [],
  activeFolderId = null,
  onActiveFolderChange,
  foldersAvailable = false,
  foldersLoading = false,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveSessionToFolder,
  projectsSection,
  onBackupFolder,
  onBackupProject,
}: ChatSidebarProps) {
  const { t } = useTranslation();
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [searchFocused, setSearchFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const visibleSessionIds = useMemo(
    () => [
      ...pinnedSessions.map((s) => s.id),
      ...regularSessions.map((s) => s.id),
      ...archivedSessions.map((s) => s.id),
    ],
    [pinnedSessions, regularSessions, archivedSessions]
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(visibleSessionIds));
  }, [visibleSessionIds]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const sessionId = String(event.active.id);
      const overId = event.over?.id ? String(event.over.id) : '';
      if (!onMoveSessionToFolder || !overId.startsWith('folder-')) return;
      const folderId = overId.replace('folder-', '');
      void onMoveSessionToFolder(sessionId, folderId);
    },
    [onMoveSessionToFolder]
  );

  const wrapSessionItem = (session: ChatSession, item: React.ReactNode) =>
    onMoveSessionToFolder ? (
      <DraggableSessionRow key={session.id} sessionId={session.id}>
        {item}
      </DraggableSessionRow>
    ) : (
      <div key={session.id}>{item}</div>
    );

  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    await onBulkDelete(ids);
    exitSelectionMode();
  }, [onBulkDelete, selectedIds, exitSelectionMode]);

  const handleBulkArchive = useCallback(
    async (archive: boolean) => {
      if (!onBulkArchive || selectedIds.size === 0) return;
      const ids = [...selectedIds];
      await onBulkArchive(ids, archive);
      exitSelectionMode();
    },
    [onBulkArchive, selectedIds, exitSelectionMode]
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-[4.5rem] z-30 bg-black/30 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      <div
        className={cn(
          // Panel shell — min-h-0 + max-h-full prevents flex row from growing with list content
          'relative z-40 flex min-h-0 max-h-full flex-col overflow-hidden bg-gray-0 transition-all duration-300 ease-in-out dark:bg-gray-50',
          'max-lg:fixed max-lg:top-[4.5rem] max-lg:bottom-0 max-lg:start-0 max-lg:z-40 max-lg:h-[calc(100dvh-4.5rem)] max-lg:border-e max-lg:border-muted max-lg:shadow-2xl',
          isOpen
            ? cn(
                'w-[270px] translate-x-0 opacity-100 2xl:w-72',
                'lg:h-full lg:min-h-0 lg:max-h-full lg:shrink-0 lg:self-stretch',
                'lg:rounded-lg lg:border lg:border-muted lg:shadow-sm'
              )
            : 'w-0 overflow-hidden opacity-0 ltr:max-lg:-translate-x-full rtl:max-lg:translate-x-full lg:translate-x-0'
        )}
      >
      {/* Header — fixed height, no shrink */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-700">
          {t('chatSidebar.title')}
        </h2>
        <div className="flex items-center gap-1">
          {onBulkDelete && onBulkArchive && (
            <button
              type="button"
              onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                selectionMode
                  ? 'bg-primary/15 text-primary hover:bg-primary/25'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20'
              )}
              aria-label={
                selectionMode ? t('chatSidebar.exitSelection') : t('chatSidebar.enterSelection')
              }
              title={
                selectionMode ? t('chatSidebar.exitSelection') : t('chatSidebar.enterSelection')
              }
            >
              <PiChecks className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onCreateNew}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20"
            aria-label={t('chatSidebar.newChat')}
            title={t('chatSidebar.newChat')}
          >
            <PiPlus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20"
            aria-label={t('chatSidebar.closeSidebar')}
            title={t('chatSidebar.closeSidebar')}
          >
            {/* rtl:rotate-180 flips the caret to point right when sidebar is on the right side in RTL */}
            <PiCaretLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Search — fixed height, no shrink */}
      <div className="flex-shrink-0 px-3 pb-2">
        <div className="relative" ref={searchWrapRef}>
          <PiMagnifyingGlass className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('chatPage.search.placeholder')}
            className="w-full rounded-md border border-muted bg-gray-0 py-1.5 ps-8 pe-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-primary/40 dark:bg-gray-50 dark:text-gray-300 dark:placeholder:text-gray-500"
            dir="auto"
            aria-label={t('chatPage.search.title')}
            aria-expanded={searchFocused && searchQuery.trim().length >= 1}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                searchInputRef?.current?.focus();
              }}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={t('common.clear')}
            >
              <PiX className="h-3 w-3" />
            </button>
          )}
          {searchFocused && searchQuery.trim().length >= 1 && onSearchSelectSession && (
            <ChatSidebarSearchResults
              query={searchQuery}
              activeTab={searchActiveTab}
              onTabChange={onSearchTabChange ?? (() => {})}
              sessionResults={sessionSearchResults}
              messageResults={messageSearchResults}
              fileResults={fileSearchResults}
              isSearching={isSearchingMessages}
              onSelectSession={onSearchSelectSession}
              onSelectMessage={
                onSearchSelectMessage ??
                ((sessionId) => onSearchSelectSession(sessionId))
              }
              onSelectFile={
                onSearchSelectFile ??
                ((sessionId) => onSearchSelectSession(sessionId))
              }
              onClear={() => {
                onSearchChange('');
                setSearchFocused(false);
              }}
              onExpand={onSearchExpand ?? (() => {})}
            />
          )}
        </div>
      </div>

      {selectionMode && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-muted px-3 py-2">
          <button
            type="button"
            onClick={selectAllVisible}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            {t('chatSidebar.selectAllVisible')}
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
          >
            {t('chatSidebar.deselectAll')}
          </button>
          <span className="ms-auto text-xs text-gray-500 dark:text-gray-400">
            {selectedIds.size > 0
              ? t('chatSidebar.selectedCount', { count: selectedIds.size })
              : t('chatSidebar.noneSelected')}
          </span>
        </div>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div className="flex flex-shrink-0 flex-wrap gap-1.5 border-b border-muted bg-primary/[0.06] px-3 py-2 dark:bg-primary/10">
          <button
            type="button"
            onClick={() => void handleBulkArchive(true)}
            className="inline-flex items-center gap-1 rounded-md border border-muted bg-gray-0 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-100/80"
          >
            <PiArchive className="h-3.5 w-3.5" />
            {t('chatSidebar.bulkArchive')}
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            <PiTrash className="h-3.5 w-3.5" />
            {t('chatSidebar.bulkDelete')}
          </button>
          {onBulkBackup && (
            <button
              type="button"
              onClick={() => onBulkBackup(Array.from(selectedIds))}
              className="inline-flex items-center gap-1 rounded-md border border-muted bg-gray-0 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-50 dark:text-gray-200"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" />
              {t('chatSidebar.bulkBackup')}
            </button>
          )}
          {onBackupFolder && activeFolderId && (
            <button
              type="button"
              onClick={onBackupFolder}
              className="inline-flex items-center gap-1 rounded-md border border-muted px-2 py-1 text-xs font-medium text-gray-600"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" />
              {t('chatSidebar.backupFolder')}
            </button>
          )}
          {onBackupProject && (
            <button
              type="button"
              onClick={onBackupProject}
              className="inline-flex items-center gap-1 rounded-md border border-muted px-2 py-1 text-xs font-medium text-gray-600"
            >
              <PiDownloadSimple className="h-3.5 w-3.5" />
              {t('chatSidebar.backupProject')}
            </button>
          )}
        </div>
      )}

      <DndContext sensors={dragSensors} onDragEnd={handleDragEnd}>
        {onCreateFolder && onUpdateFolder && onDeleteFolder && onActiveFolderChange ? (
          <SessionFoldersSection
            folders={folders}
            activeFolderId={activeFolderId}
            onActiveFolderChange={onActiveFolderChange}
            isAvailable={foldersAvailable}
            isLoading={foldersLoading}
            onCreateFolder={onCreateFolder}
            onUpdateFolder={onUpdateFolder}
            onDeleteFolder={onDeleteFolder}
            onOpenDevPanel={onOpenDevPanel}
          />
        ) : null}
        {projectsSection}

      {/* Session list — native scroll (FolderTree pattern: flex-1 + min-h-0 + overflow-y-auto) */}
      <div className="custom-scrollbar scrollbar-no-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-1">
        {/* Loading skeleton — shown ONLY on first load when no sessions exist.
           If sessions are already cached (e.g. after re-mount on route change),
           background refetching is silent to prevent flicker. */}
        {isLoading && pinnedSessions.length === 0 && regularSessions.length === 0 && (
          <ContentLoadingState variant="inline" skeleton="list" />
        )}

        {/* Shared with me */}
        {(isLoadingSharedWithMe || sharedWithMeSessions.length > 0) && (
          <div className="mb-2">
            <div className="mb-1 px-3 text-xs font-normal uppercase tracking-widest text-gray-400">
              {t('chatSidebar.sharedWithMe')}
            </div>
            {isLoadingSharedWithMe && sharedWithMeSessions.length === 0 ? (
              <div className="mx-1.5 h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-200/20" />
            ) : (
              sharedWithMeSessions.map((entry) => (
                <button
                  key={entry.session_id}
                  type="button"
                  onClick={() => onSelect(entry.session_id)}
                  className={cn(
                    'group mx-1 mb-0.5 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2.5 py-2.5 text-start text-sm font-semibold transition-colors',
                    entry.session_id === activeSessionId
                      ? 'bg-primary/[0.11] text-gray-900 ring-1 ring-inset ring-primary/25 dark:bg-primary/15 dark:text-gray-100'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/10'
                  )}
                  title={entry.title}
                >
                  <PiShareNetwork className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                  {isLoadingMessages && entry.session_id === activeSessionId ? (
                    <Loader size="sm" variant="spinner" className="shrink-0 text-primary" />
                  ) : (
                    <span className="shrink-0 rounded bg-gray-100 px-1 py-px text-[9px] font-medium uppercase text-gray-500 dark:bg-gray-200/30 dark:text-gray-400">
                      {t('chatSidebar.sharedReadOnly')}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Pinned section */}
        {pinnedSessions.length > 0 && (
          <div className="mb-2">
            <div className="mb-1 px-3 text-xs font-normal uppercase tracking-widest text-gray-400">
              {t('chatSidebar.pinned')}
            </div>
            {pinnedSessions.map((session) =>
              wrapSessionItem(
                session,
                <SessionItem
                  session={session}
                  isActive={session.id === activeSessionId}
                  selectionMode={selectionMode}
                  isChecked={selectedIds.has(session.id)}
                  onToggleCheck={() => toggleSelected(session.id)}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onToggleArchive={onToggleArchive}
                  onTogglePin={onTogglePin}
                  onClearMessages={session.id === activeSessionId ? onClearMessages : undefined}
                  onShare={onShare}
                  isSharedReadOnly={sharedReadOnlySessionIds?.has(session.id)}
                  isLoadingMessages={isLoadingMessages && session.id === activeSessionId}
                />
              )
            )}
          </div>
        )}

        {/* Regular sessions */}
        {regularSessions.length > 0 && (
          <div>
            {pinnedSessions.length > 0 && (
              <div className="mb-1 px-3 text-xs font-normal uppercase tracking-widest text-gray-400">
                {t('chatSidebar.recent')}
              </div>
            )}
            {regularSessions.map((session) =>
              wrapSessionItem(
                session,
                <SessionItem
                  session={session}
                  isActive={session.id === activeSessionId}
                  selectionMode={selectionMode}
                  isChecked={selectedIds.has(session.id)}
                  onToggleCheck={() => toggleSelected(session.id)}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onToggleArchive={onToggleArchive}
                  onTogglePin={onTogglePin}
                  onClearMessages={session.id === activeSessionId ? onClearMessages : undefined}
                  onShare={onShare}
                  isSharedReadOnly={sharedReadOnlySessionIds?.has(session.id)}
                  isLoadingMessages={isLoadingMessages && session.id === activeSessionId}
                />
              )
            )}
          </div>
        )}

        {/* Archived — separate section when viewing archived list */}
        {showArchived && archivedSessions.length > 0 && (
          <div className="mt-3 border-t border-dashed border-muted pt-3">
            <div className="mb-1 flex items-center gap-1.5 px-3 text-xs font-medium uppercase tracking-widest text-amber-700/90 dark:text-amber-400/90">
              <PiArchive className="h-3.5 w-3.5 shrink-0" />
              {t('chatSidebar.archivedSection', { defaultValue: 'Archived' })}
            </div>
            {archivedSessions.map((session) =>
              wrapSessionItem(
                session,
                <SessionItem
                  session={session}
                  isActive={session.id === activeSessionId}
                  selectionMode={selectionMode}
                  isChecked={selectedIds.has(session.id)}
                  onToggleCheck={() => toggleSelected(session.id)}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onToggleArchive={onToggleArchive}
                  onTogglePin={onTogglePin}
                  onClearMessages={session.id === activeSessionId ? onClearMessages : undefined}
                  onShare={onShare}
                  isSharedReadOnly={sharedReadOnlySessionIds?.has(session.id)}
                  isLoadingMessages={isLoadingMessages && session.id === activeSessionId}
                />
              )
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading &&
          pinnedSessions.length === 0 &&
          regularSessions.length === 0 &&
          archivedSessions.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <PiChatCircleDots className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-500" />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {searchQuery
                  ? t('chatSidebar.noConversationsFound')
                  : t('chatSidebar.noConversations')}
              </p>
            </div>
          )}
      </div>
      </DndContext>

      {/* Footer — backup + archived toggle */}
      <div className="flex-shrink-0 space-y-1 border-t border-muted px-3 py-2">
        {onBackupAll && (
          <button
            type="button"
            onClick={onBackupAll}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
          >
            <PiDownloadSimple className="h-3.5 w-3.5" />
            <span>{t('chatSidebar.backupAll')}</span>
          </button>
        )}
        <button
          onClick={() => onShowArchivedChange(!showArchived)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
            showArchived
              ? 'text-primary'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300'
          )}
        >
          <PiArchive className="h-3.5 w-3.5" />
          <span>{showArchived ? t('chatSidebar.hideArchived') : t('chatSidebar.showArchived')}</span>
        </button>
      </div>
    </div>
    </>
  );
}

// ==========================================
// DraggableSessionRow — drag handle for folder assignment
// ==========================================

function DraggableSessionRow({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sessionId,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50')}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onToggleArchive: (id: string, archive: boolean) => void;
  onTogglePin: (id: string, pin: boolean) => void;
  /** Clear all messages in this session (only shown for active session) */
  onClearMessages?: () => void;
  /** Share session — opens share modal */
  onShare?: (sessionId: string) => void;
  /** Session is shared with current user (read-only) */
  isSharedReadOnly?: boolean;
  /** Show spinner while this session's messages load */
  isLoadingMessages?: boolean;
}

function SessionItem({
  session,
  isActive,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
  onSelect,
  onRename,
  onDelete,
  onToggleArchive,
  onTogglePin,
  onClearMessages,
  onShare,
  isSharedReadOnly = false,
  isLoadingMessages = false,
}: SessionItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(session.title);
    }
  }, [session.title, isEditing]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleRename = useCallback(() => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(session.id, editTitle.trim());
    }
    setIsEditing(false);
  }, [editTitle, session.id, session.title, onRename]);

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    onDelete(session.id);
    setShowDeleteConfirm(false);
  }, [session.id, onDelete]);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <div
      className={cn(
        'animate-chat-fade-slide group relative mx-1 flex items-center rounded-md px-2.5 py-3 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-primary/[0.11] text-gray-900 ring-1 ring-inset ring-primary/25 dark:bg-primary/15 dark:text-gray-100 dark:ring-primary/35'
          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/10',
        session.is_archived &&
          'border border-dashed border-amber-300/50 bg-amber-50/40 dark:border-amber-700/40 dark:bg-amber-950/20'
      )}
    >
      {selectionMode && onToggleCheck && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          onClick={(e) => e.stopPropagation()}
          className="me-2 h-3.5 w-3.5 shrink-0 rounded border-muted text-primary focus:ring-primary/40"
          aria-label={t('chatSidebar.toggleSessionSelect')}
        />
      )}
      {/* Inline delete confirmation */}
      {showDeleteConfirm ? (
        <div className="flex w-full items-center gap-1.5">
          <span className="flex-1 truncate text-xs text-red-500">{t('chatSidebar.deleteConfirm')}</span>
          <button
            onClick={confirmDelete}
            className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
            aria-label="Confirm delete"
          >
            {t('chatSidebar.yes')}
          </button>
          <button
            onClick={cancelDelete}
            className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-200/30 dark:text-gray-400 dark:hover:bg-gray-200/50"
            aria-label="Cancel delete"
          >
            {t('chatSidebar.no')}
          </button>
        </div>
      ) : isEditing ? (
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') {
              setEditTitle(session.title);
              setIsEditing(false);
            }
          }}
          className="w-full rounded bg-gray-0 px-1.5 py-0.5 text-sm outline-none ring-1 ring-primary dark:bg-gray-100"
          dir="auto"
        />
      ) : (
        <>
          <button
            onClick={() => onSelect(session.id)}
            className="flex-1 truncate text-start text-sm"
            title={session.title}
            dir="auto"
          >
            <div className="flex items-center gap-1.5">
              {session.is_pinned && (
                <PiPushPinFill className="h-2.5 w-2.5 flex-shrink-0 text-primary" />
              )}
              {session.is_archived && (
                <span className="shrink-0 rounded bg-amber-100 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {t('chatSidebar.archivedBadge', { defaultValue: 'Archived' })}
                </span>
              )}
              {isSharedReadOnly && (
                <span className="shrink-0 rounded bg-gray-100 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-200/30 dark:text-gray-400">
                  {t('chatSidebar.sharedReadOnly')}
                </span>
              )}
              <span className="truncate">{session.title}</span>
              {isLoadingMessages && (
                <Loader size="sm" variant="spinner" className="shrink-0 text-primary" />
              )}
            </div>
          </button>

          {/* Hover — single ⋮ opens vertical menu (portal); title keeps full width */}
          {!selectionMode && (
          <div
            className={cn(
              'relative shrink-0 transition-opacity',
              showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            <button
              ref={menuButtonRef}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!showMenu && menuButtonRef.current) {
                  const rect = menuButtonRef.current.getBoundingClientRect();
                  setMenuPos({
                    top: rect.bottom + 4,
                    left: Math.max(8, rect.right - 144),
                  });
                }
                setShowMenu((open) => !open);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-200/30"
              aria-label={t('chatSidebar.sessionMenu')}
              title={t('chatSidebar.sessionMenu')}
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <PiDotsThreeVertical className="h-3.5 w-3.5" />
            </button>

            {showMenu && typeof document !== 'undefined' && createPortal(
              <div
                ref={menuRef}
                className="fixed z-[9999] w-36 overflow-hidden rounded-md border border-muted bg-gray-0 py-1 shadow-lg dark:bg-gray-50"
                style={{ top: menuPos.top, left: menuPos.left }}
                role="menu"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setEditTitle(session.title);
                    setIsEditing(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
                  role="menuitem"
                  title={t('chatSidebar.rename')}
                >
                  <PiPencilSimple className="h-3.5 w-3.5 shrink-0" />
                  {t('chatSidebar.rename')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onTogglePin(session.id, !session.is_pinned);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
                  role="menuitem"
                  title={session.is_pinned ? t('chatSidebar.unpin') : t('chatSidebar.pin')}
                >
                  {session.is_pinned ? (
                    <PiPushPinFill className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <PiPushPin className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {session.is_pinned ? t('chatSidebar.unpin') : t('chatSidebar.pin')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onToggleArchive(session.id, !session.is_archived);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
                  role="menuitem"
                  title={
                    session.is_archived ? t('chatSidebar.unarchive') : t('chatSidebar.archive')
                  }
                >
                  {session.is_archived ? (
                    <PiArrowCounterClockwise className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <PiArchive className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {session.is_archived ? t('chatSidebar.unarchive') : t('chatSidebar.archive')}
                </button>
                {isActive && onClearMessages && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onClearMessages();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
                    role="menuitem"
                    title={t('chatSidebar.clearMessages')}
                  >
                    <PiEraser className="h-3.5 w-3.5 shrink-0" />
                    {t('chatSidebar.clearMessages')}
                  </button>
                )}
                {onShare && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onShare(session.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
                    role="menuitem"
                    title={t('chatSidebar.share')}
                  >
                    <PiShareNetwork className="h-3.5 w-3.5 shrink-0" />
                    {t('chatSidebar.share')}
                  </button>
                )}
                <div className="my-1 border-t border-muted" />
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  role="menuitem"
                  title={t('chatSidebar.delete')}
                >
                  <PiTrash className="h-3.5 w-3.5 shrink-0" />
                  {t('chatSidebar.delete')}
                </button>
              </div>,
              document.body
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}
