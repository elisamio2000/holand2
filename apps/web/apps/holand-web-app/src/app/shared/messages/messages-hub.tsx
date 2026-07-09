'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useMessagesList, useMessagesViewMode, useMessageDetail } from '@/hooks/use-messages';
import { useMessagesLayout } from '@/hooks/use-messages-layout';
import { useMessageKeyboardShortcuts } from '@/hooks/use-message-keyboard-shortcuts';
import { useStarredMessages } from '@/hooks/use-starred-messages';
import { useMedia } from '@core/hooks/use-media';
import type { MessageFolder, MessagesViewMode, UserSummary } from '@/types/messages.types';
import {
  buildUrlSyncKey,
  shouldSyncViewFromUrl,
} from '@/utils/messages-url-sync';
import { seedMessengerDirectoryUser, userNeedsNameHydration, MessengerDirectoryProvider } from '@/hooks/use-messenger-user-directory';
import { messagesDataStore } from '@/stores/messages-data-store';
import PeopleNewChatModal from './components/people-new-chat-modal';
import PeopleDraftThread from './components/people-draft-thread';
import MessagesSidebar from './messages-sidebar';
import MessagesMainToolbar from './messages-main-toolbar';
import MessagesRightRail, { type MessagesRightRailTab } from './messages-right-rail';
import MessagesCommandPalette from './components/messages-command-palette';
import { applyListQuickFilter, type ListQuickFilter } from './utils/list-quick-filter';
import ThreadDetail from './thread-detail';
import MessagesMockBanner from './messages-mock-banner';
import FloatingNativeAiChat from '@/app/shared/native-ai-chat/floating-native-ai-chat';
import { writeLauncherHidden } from '@/app/shared/native-ai-chat/native-ai-chat-bridge';
import { SUPPORT_USER_ID } from './support-config';
import { messagesService } from '@/services/messages.service';
import { useMessagesRealtime, type RealtimeMessage } from '@/hooks/use-messages-realtime';
import { useMessagesApiHealth } from '@/hooks/use-messages-api-health';
import { MessagesRealtimeProvider } from './messages-realtime-context';
import MessagesDevRequirementsPanel from './messages-dev-requirements-panel';

export default function MessagesHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLgUp = useMedia('(min-width: 1024px)', false);
  const { viewMode, setViewMode } = useMessagesViewMode();
  const isPeople = viewMode === 'people';
  const { isListOpen, closeList, openList } = useMessagesLayout();
  
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';

  const [mailboxFolder, setMailboxFolder] = useState<MessageFolder>('inbox');
  const folder = isPeople ? 'inbox' : mailboxFolder;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [typingPartnerId, setTypingPartnerId] = useState<string | null>(null);
  const [rightRailOpen, setRightRailOpen] = useState(false);
  const [rightRailTab, setRightRailTab] = useState<MessagesRightRailTab>('files');
  const [draftPartner, setDraftPartner] = useState<UserSummary | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [listQuickFilter, setListQuickFilter] = useState<ListQuickFilter>('all');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [listDensity, setListDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return (localStorage.getItem('messages-list-density') as 'comfortable' | 'compact') ?? 'comfortable';
  });

  const resolvedPartnerRef = useRef<string | null>(null);
  const lastUrlSyncKeyRef = useRef<string | null>(null);
  const userOverrideViewModeRef = useRef(false);
  const overrideTargetModeRef = useRef<MessagesViewMode | null>(null);
  const userClosedSidebarRef = useRef(false);
  const userOpenedSidebarRef = useRef(false);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usingPollingRef = useRef(false);
  const [realtimeBannerDismissed, setRealtimeBannerDismissed] = useState(false);

  const { health, probe } = useMessagesApiHealth();

  const handleReProbe = useCallback(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    if (!session?.user) return;
    seedMessengerDirectoryUser({
      id: session.user.id,
      name: session.user.name ?? session.user.email ?? session.user.id,
      email: session.user.email ?? undefined,
    });
  }, [session?.user?.id, session?.user?.name, session?.user?.email]);

  const { isStarred, toggleStar } = useStarredMessages();
  const { items, unreadCount, loading, backgroundRefreshing, error, usingMock, refresh, peopleConversations } =
    useMessagesList(folder, searchQuery, currentUserId, { forPeople: isPeople });

  const filteredItems = useMemo(
    () => applyListQuickFilter(items, listQuickFilter, isStarred),
    [items, listQuickFilter, isStarred]
  );
  const { message, replies, loading: detailLoading, error: detailError, refresh: refreshDetail } =
    useMessageDetail(selectedMessageId, currentUserId, isPeople ? 'chat' : 'mail');

  const handleCloseSidebar = useCallback(() => {
    userClosedSidebarRef.current = true;
    userOpenedSidebarRef.current = false;
    closeList();
  }, [closeList]);

  const handleOpenSidebar = useCallback(() => {
    userClosedSidebarRef.current = false;
    userOpenedSidebarRef.current = true;
    openList();
  }, [openList]);

  /** On mobile, keep sidebar closed when a thread is open unless user opened it manually. */
  useEffect(() => {
    if (isLgUp) return;
    if (userOpenedSidebarRef.current) return;
    if (selectedMessageId || selectedPartnerId || draftPartner) {
      closeList();
    }
  }, [isLgUp, selectedMessageId, selectedPartnerId, draftPartner, closeList]);

  useEffect(() => {
    writeLauncherHidden('messages', true);
  }, []);

  const urlView = searchParams.get('view');
  const urlPartner = searchParams.get('partner');
  const urlSearch = searchParams.get('search');
  const urlMessageId = searchParams.get('id');

  /** Legacy One Search links: /messages?search=… (mailbox search, not People deep link). */
  useEffect(() => {
    if (urlView === 'people') return;
    const q = urlSearch?.trim() ?? '';
    if (q) setSearchQuery(q);
  }, [urlSearch, urlView]);

  const urlSyncKey = buildUrlSyncKey(urlView, urlPartner);

  const debouncedRefresh = useCallback(
    (options?: { background?: boolean }) => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      const delay = usingPollingRef.current ? 800 : 400;
      refreshDebounceRef.current = setTimeout(() => {
        refreshDebounceRef.current = null;
        void refresh(options?.background ?? true);
        if (selectedMessageId) void refreshDetail(options?.background ?? true);
      }, delay);
    },
    [refresh, refreshDetail, selectedMessageId]
  );

  const handleRealtimeEvent = useCallback(
    (msg: RealtimeMessage) => {
      if (msg.type === 'typing' && isPeople) {
        const data = msg.data as { partnerId?: string; isTyping?: boolean } | undefined;
        if (data?.partnerId) {
          setTypingPartnerId(data.isTyping ? data.partnerId : null);
        }
        return;
      }

      const result = messagesDataStore.applyRealtimeEvent(msg.type, msg.data);
      if (result === 'needs_refetch') {
        debouncedRefresh({ background: true });
      }
    },
    [isPeople, debouncedRefresh]
  );

  useEffect(() => {
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
    };
  }, []);

  /** Deep link from header dropdown: /messages?id=<messageId> */
  useEffect(() => {
    if (!urlMessageId || urlView === 'people') return;
    if (selectedMessageId === urlMessageId) return;
    setSelectedMessageId(urlMessageId);
    setSelectedPartnerId(null);
    setDraftPartner(null);
    if (!isLgUp && !userOpenedSidebarRef.current) closeList();
  }, [urlMessageId, urlView, selectedMessageId, isLgUp, closeList]);

  const realtimePartnerId = selectedPartnerId ?? draftPartner?.id ?? null;

  const realtime = useMessagesRealtime({
    mode: isPeople ? 'people' : 'mailbox',
    partnerId: realtimePartnerId,
    onEvent: handleRealtimeEvent,
  });

  usingPollingRef.current = realtime.usingPolling;

  useEffect(() => {
    const overrideTarget = overrideTargetModeRef.current;
    if (
      !shouldSyncViewFromUrl(
        userOverrideViewModeRef.current,
        viewMode,
        urlView,
        overrideTarget
      )
    ) {
      return;
    }
    if (userOverrideViewModeRef.current) {
      userOverrideViewModeRef.current = false;
      overrideTargetModeRef.current = null;
    }

    const urlChanged = lastUrlSyncKeyRef.current !== urlSyncKey;

    if (urlView !== 'people') {
      if (urlChanged) {
        resolvedPartnerRef.current = null;
        lastUrlSyncKeyRef.current = urlSyncKey;
      }
      return;
    }

    if (urlChanged) {
      setViewMode('people');
      const isDesktop =
        isLgUp && typeof window !== 'undefined' && window.innerWidth >= 1024;
      if (!userClosedSidebarRef.current) {
        if (isDesktop) {
          openList();
        } else {
          closeList();
        }
      }
      lastUrlSyncKeyRef.current = urlSyncKey;
    }

    if (!urlPartner) return;

    const conv = peopleConversations.find((c) => c.partner.id === urlPartner);
    if (conv) {
      resolvedPartnerRef.current = urlPartner;
      if (!userNeedsNameHydration(conv.partner)) {
        seedMessengerDirectoryUser(conv.partner);
      }
      setDraftPartner(null);
      setSelectedPartnerId(urlPartner);
      setSelectedMessageId(conv.threadRootId);
      if (!isLgUp && !userOpenedSidebarRef.current) closeList();
      return;
    }

    if (loading) return;
    if (resolvedPartnerRef.current === urlPartner && draftPartner?.id === urlPartner) return;

    let cancelled = false;
    resolvedPartnerRef.current = urlPartner;
    void messagesService.resolveDirectoryUser(urlPartner).then((user) => {
      if (cancelled || !user) return;
      seedMessengerDirectoryUser(user);
      setDraftPartner(user);
      setSelectedPartnerId(user.id);
      setSelectedMessageId(null);
      if (!isLgUp && !userOpenedSidebarRef.current) closeList();
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    urlSyncKey,
    urlView,
    urlPartner,
    viewMode,
    peopleConversations,
    loading,
    draftPartner?.id,
    setViewMode,
    openList,
    closeList,
    isLgUp,
  ]);

  const navigableIds = useMemo(() => {
    if (isPeople) return peopleConversations.map((c) => c.threadRootId);
    return filteredItems.map((m) => m.id);
  }, [isPeople, filteredItems, peopleConversations]);

  const toolbarTitle = useMemo(() => {
    if (!selectedMessageId) {
      if (!isPeople) return t(`messages.folders.${folder}`);
      if (draftPartner) return draftPartner.name;
      return t('messages.people');
    }
    if (isPeople) {
      const conv = peopleConversations.find((c) => c.threadRootId === selectedMessageId);
      return conv?.partner.name ?? message?.from.name ?? draftPartner?.name;
    }
    return message?.subject ?? t(`messages.folders.${folder}`);
  }, [selectedMessageId, isPeople, folder, peopleConversations, message, draftPartner, t]);

  const handleSelectMessage = useCallback(
    (id: string) => {
      setSelectedMessageId(id);
      if (window.innerWidth < 1024) handleCloseSidebar();
    },
    [handleCloseSidebar]
  );

  const handlePeopleSelect = useCallback(
    (messageId: string, partnerId: string) => {
      setDraftPartner(null);
      setTypingPartnerId(null);
      setSelectedMessageId(messageId);
      setSelectedPartnerId(partnerId);
      if (window.innerWidth < 1024) handleCloseSidebar();
    },
    [handleCloseSidebar]
  );

  const handleStartPeopleChat = useCallback(
    (user: UserSummary) => {
      seedMessengerDirectoryUser(user);
      const existing = peopleConversations.find((c) => c.partner.id === user.id);
      if (existing) {
        handlePeopleSelect(existing.threadRootId, user.id);
        router.push(routes.messagesPeopleChat(user.id));
        return;
      }
      setDraftPartner(user);
      setSelectedPartnerId(user.id);
      setSelectedMessageId(null);
      router.push(routes.messagesPeopleChat(user.id));
      if (window.innerWidth < 1024) handleCloseSidebar();
    },
    [handleCloseSidebar, handlePeopleSelect, peopleConversations, router]
  );

  const handleCreateGroupChat = useCallback(
    (users: UserSummary[], conversationId: string) => {
      users.forEach(seedMessengerDirectoryUser);
      setDraftPartner(null);
      setSelectedPartnerId(conversationId);
      setSelectedMessageId(null);
      router.push(routes.messagesPeopleChat(conversationId));
      if (window.innerWidth < 1024) handleCloseSidebar();
    },
    [handleCloseSidebar, router]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await messagesService
      .bulkUpdate({ message_ids: ids, folder: 'archived' })
      .catch(() => undefined);
    setSelectedIds(new Set());
    setSelectionMode(false);
    refresh();
  };

  const clearSelection = useCallback(() => {
    setSelectedMessageId(null);
    setSelectedPartnerId(null);
    setDraftPartner(null);
    setTypingPartnerId(null);
  }, []);

  const navigateList = useCallback(
    (direction: 1 | -1) => {
      if (navigableIds.length === 0) return;
      const idx = selectedMessageId ? navigableIds.indexOf(selectedMessageId) : -1;
      const nextIdx = idx < 0 ? 0 : Math.max(0, Math.min(navigableIds.length - 1, idx + direction));
      const nextId = navigableIds[nextIdx];
      setSelectedMessageId(nextId);
      if (isPeople) {
        const conv = peopleConversations.find((c) => c.threadRootId === nextId);
        if (conv) setSelectedPartnerId(conv.partner.id);
      }
    },
    [isPeople, navigableIds, peopleConversations, selectedMessageId]
  );

  const handleArchiveSelected = useCallback(async () => {
    if (!selectedMessageId) return;
    await messagesService.update(selectedMessageId, { folder: 'archived' }).catch(() => undefined);
    refresh();
    clearSelection();
  }, [clearSelection, refresh, selectedMessageId]);

  const handleCompose = useCallback(() => {
    router.push(routes.messagesCompose);
  }, [router]);

  const toggleFilesRail = useCallback(() => {
    if (isLgUp) {
      if (rightRailOpen && rightRailTab === 'files') setRightRailOpen(false);
      else {
        setRightRailOpen(true);
        setRightRailTab('files');
      }
    } else {
      setRightRailOpen((v) => !v);
      setRightRailTab('files');
    }
  }, [isLgUp, rightRailOpen, rightRailTab]);

  const toggleContextRail = useCallback(() => {
    if (isLgUp) {
      if (rightRailOpen && rightRailTab === 'context') setRightRailOpen(false);
      else {
        setRightRailOpen(true);
        setRightRailTab('context');
      }
    } else {
      setRightRailOpen((v) => !v);
      setRightRailTab('context');
    }
  }, [isLgUp, rightRailOpen, rightRailTab]);

  useMessageKeyboardShortcuts({
    onCompose: handleCompose,
    onReply: () => {
      if (selectedMessageId) {
        document.getElementById('inline-composer-anchor')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    onArchive: handleArchiveSelected,
    onNext: () => navigateList(1),
    onPrev: () => navigateList(-1),
    onEscape: clearSelection,
    onCommandPalette: () => setCommandPaletteOpen(true),
  });

  const handleViewModeChange = useCallback(
    (mode: typeof viewMode) => {
      userOverrideViewModeRef.current = true;
      overrideTargetModeRef.current = mode;
      setViewMode(mode);
      clearSelection();
      resolvedPartnerRef.current = null;
      if (mode === 'people') {
        setRightRailOpen(false);
        userClosedSidebarRef.current = false;
        userOpenedSidebarRef.current = false;
        router.replace(`${routes.messages}?view=people`);
      } else {
        router.replace(routes.messages);
      }
    },
    [clearSelection, setViewMode, router]
  );

  const commandActions = useMemo(
    () => [
      {
        id: 'compose',
        label: t('messages.composeLabel'),
        hint: 'c',
        onSelect: handleCompose,
      },
      {
        id: 'inbox',
        label: t('messages.folders.inbox'),
        onSelect: () => {
          handleViewModeChange('mailbox');
          setMailboxFolder('inbox');
        },
      },
      {
        id: 'people',
        label: t('messages.people'),
        onSelect: () => handleViewModeChange('people'),
      },
      {
        id: 'filter-unread',
        label: t('messages.filters.unread', 'Unread'),
        onSelect: () => setListQuickFilter('unread'),
      },
    ],
    [t, handleCompose, handleViewModeChange]
  );

  const showRealtimeBanner =
    realtime.error &&
    !usingMock &&
    !(
      realtime.wsInfoUnavailable &&
      realtime.usingPolling &&
      realtimeBannerDismissed
    );

  const isDegradedRealtime = realtime.wsInfoUnavailable && realtime.usingPolling;

  const handleRetryRealtime = useCallback(() => {
    setRealtimeBannerDismissed(false);
    realtime.retryConnection();
  }, [realtime]);

  return (
    <MessengerDirectoryProvider>
    <MessagesRealtimeProvider value={realtime}>
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {usingMock && (
        <div className="shrink-0 pb-2">
          <MessagesMockBanner />
        </div>
      )}

      {backgroundRefreshing && !loading && (
        <div className="mb-1 shrink-0 px-4">
          <Text className="text-[10px] text-gray-400">
            {t('messages.syncing', 'Syncing…')}
          </Text>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <Text className="text-sm">{t('messages.bulk.selected', { count: selectedIds.size })}</Text>
          <Button size="sm" variant="outline" onClick={handleBulkArchive}>
            {t('messages.thread.archive')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            {t('messages.bulk.clear')}
          </Button>
        </div>
      )}

      {error && !usingMock && (
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="min-w-0">
            <Text className="text-sm font-medium text-red-700 dark:text-red-300">
              {error.split(' — ')[0]}
            </Text>
          </div>
          <Button size="sm" variant="outline" onClick={() => refresh()} className="shrink-0">
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}

      {showRealtimeBanner && (
        <div
          className={cn(
            'mb-2 shrink-0 rounded-lg px-4 py-2',
            isDegradedRealtime
              ? 'border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'
              : 'border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <Text
              className={cn(
                'text-xs',
                isDegradedRealtime
                  ? 'text-gray-600 dark:text-gray-400'
                  : 'text-amber-800 dark:text-amber-300'
              )}
            >
              {t('messages.realtime.fallback', 'Realtime unavailable — using slower refresh')}
              {realtime.usingPolling ? ` (${t('messages.realtime.polling', 'polling')})` : ''}
              {!isDegradedRealtime && realtime.lastCloseCode != null
                ? ` · close ${realtime.lastCloseCode}`
                : ''}
            </Text>
            {isDegradedRealtime && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setRealtimeBannerDismissed(true)}
                  className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {t('common.dismiss', 'Dismiss')}
                </button>
                <button
                  type="button"
                  onClick={handleRetryRealtime}
                  className="text-[10px] text-primary hover:underline"
                >
                  {t('messages.realtime.retry', 'Retry realtime')}
                </button>
              </div>
            )}
          </div>
          {process.env.NODE_ENV === 'development' && !isDegradedRealtime && (
            <Text className="mt-1 font-mono text-[10px] text-amber-700/80 dark:text-amber-400/80">
              {realtime.wsInfoUnavailable
                ? 'ws-info: fallback defaults'
                : 'ws-info: ok'}
              {realtime.lastWsUrl
                ? ` · ${realtime.lastWsUrl.replace(/access_token=[^&]+/, 'access_token=…')}`
                : ''}
            </Text>
          )}
        </div>
      )}

      <div className="flex h-full min-h-0 flex-1 w-full min-w-0 items-stretch gap-0 overflow-hidden @container lg:gap-2.5">
        <MessagesSidebar
          isOpen={isListOpen}
          viewMode={viewMode}
          folder={folder}
          unreadCount={unreadCount}
          onFolderSelect={(f) => {
            setMailboxFolder(f);
            clearSelection();
          }}
          searchQuery={searchQuery}
          loading={loading}
          items={filteredItems}
          peopleConversations={peopleConversations}
          selectedMessageId={selectedMessageId}
          selectedPartnerId={selectedPartnerId}
          selectedIds={selectedIds}
          typingPartnerId={typingPartnerId}
          selectionMode={selectionMode}
          isStarred={isStarred}
          onClose={handleCloseSidebar}
          onCompose={handleCompose}
          onNewPeopleChat={() => setNewChatOpen(true)}
          onSearchChange={setSearchQuery}
          onSelectMessage={handleSelectMessage}
          onPeopleSelect={handlePeopleSelect}
          onToggleSelect={handleToggleSelect}
          onToggleStar={toggleStar}
          onToggleSelectionMode={() => setSelectionMode((v) => !v)}
          listDensity={listDensity}
          onToggleListDensity={() => {
            setListDensity((d) => {
              const next = d === 'comfortable' ? 'compact' : 'comfortable';
              localStorage.setItem('messages-list-density', next);
              return next;
            });
          }}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:rounded-lg lg:border lg:border-muted lg:shadow-sm">
          <MessagesMainToolbar
            isListOpen={isListOpen}
            viewMode={viewMode}
            folder={folder}
            unreadCount={unreadCount}
            title={toolbarTitle}
            hasSelectedThread={Boolean(selectedMessageId || draftPartner)}
            filesRailOpen={rightRailOpen && rightRailTab === 'files'}
            contextRailOpen={rightRailOpen && rightRailTab === 'context'}
            onOpenList={handleOpenSidebar}
            onCompose={handleCompose}
            onViewModeChange={handleViewModeChange}
            onFolderSelect={(f) => {
              setMailboxFolder(f);
              clearSelection();
            }}
            onToggleFilesRail={toggleFilesRail}
            onToggleContextRail={toggleContextRail}
            listQuickFilter={listQuickFilter}
            onListQuickFilterChange={setListQuickFilter}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
          {isPeople && draftPartner && !selectedMessageId ? (
            <PeopleDraftThread
              partner={draftPartner}
              onBack={clearSelection}
              onStarted={(threadRootId, partnerId) => {
                setDraftPartner(null);
                setSelectedMessageId(threadRootId);
                setSelectedPartnerId(partnerId);
                refresh();
              }}
              className="min-h-0 flex-1"
            />
          ) : (
            <ThreadDetail
              messageId={selectedMessageId}
              message={message}
              replies={replies}
              detailLoading={detailLoading}
              detailError={detailError}
              onRefreshDetail={refreshDetail}
              viewMode={viewMode}
              partnerId={selectedPartnerId}
              typingPartnerId={typingPartnerId}
              currentUserId={currentUserId}
              onBack={clearSelection}
              onRefreshList={refresh}
              onDeleted={clearSelection}
              className="min-h-0 flex-1"
            />
          )}
        </div>

        {isPeople && rightRailOpen && (
          <MessagesRightRail
            isOpen={rightRailOpen}
            tab={rightRailTab}
            viewMode={viewMode}
            message={message}
            replies={replies}
            partnerId={selectedPartnerId}
            onTabChange={setRightRailTab}
            onClose={() => setRightRailOpen(false)}
          />
        )}
      </div>

      <PeopleNewChatModal
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSelectUser={handleStartPeopleChat}
        onCreateGroup={handleCreateGroupChat}
      />

      <MessagesCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={commandActions}
      />

      <FloatingNativeAiChat
        surface="messages"
        buildContext={() => ({
          module: 'messages',
          view_mode: viewMode,
          support_user_id: SUPPORT_USER_ID,
          selected_partner_id: selectedPartnerId,
          selected_message_id: selectedMessageId,
        })}
      />

      <MessagesDevRequirementsPanel
        liveHealth={health}
        onReProbe={handleReProbe}
        isProbing={health.isProbing}
      />
    </div>
    </MessagesRealtimeProvider>
    </MessengerDirectoryProvider>
  );
}
