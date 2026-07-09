'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MessageFolder,
  MessagesViewMode,
  PeopleConversation,
} from '@/types/messages.types';
import { messagesService } from '@/services/messages.service';
import { groupByPeople } from '@/utils/messages-normalize';
import { usePinnedChats } from './use-pinned-chats';
import {
  collectUnresolvedUserIds,
  hydrateMessageItem,
  hydrateUserSummary,
  useMessengerUserDirectory,
} from './use-messenger-user-directory';
import { useMessageDetailSlice, useMessagesListSlice } from './use-messages-store';

const VIEW_MODE_KEY = 'messages-view-mode';

export function useMessagesViewMode() {
  const [viewMode, setViewMode] = useState<MessagesViewMode>('mailbox');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY) as MessagesViewMode | null;
      if (stored === 'mailbox' || stored === 'people') setViewMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const updateViewMode = useCallback((mode: MessagesViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  return { viewMode, setViewMode: updateViewMode };
}

/** List + people conversations — People sidebar uses user_chat conversations API. */
export function useMessagesList(
  folder: MessageFolder,
  searchQuery?: string,
  currentUserId?: string,
  options?: { forPeople?: boolean }
) {
  const userId = currentUserId ?? '';
  const forPeople = options?.forPeople ?? false;
  const {
    items,
    unreadCount,
    total,
    loading,
    backgroundRefreshing,
    error,
    usingMock,
    refresh,
  } = useMessagesListSlice(folder, searchQuery);

  const { pinnedIds } = usePinnedChats();

  const [apiPeopleConversations, setApiPeopleConversations] = useState<PeopleConversation[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  useEffect(() => {
    if (!forPeople) return;
    let cancelled = false;
    setPeopleLoading(true);
    void messagesService
      .listConversations(1, 50, searchQuery)
      .then((res) => {
        if (!cancelled) setApiPeopleConversations(res.items);
      })
      .catch(() => {
        if (!cancelled) setApiPeopleConversations([]);
      })
      .finally(() => {
        if (!cancelled) setPeopleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [forPeople, searchQuery]);

  const rawPeopleConversations: PeopleConversation[] = useMemo(
    () =>
      forPeople
        ? apiPeopleConversations
        : groupByPeople(items, userId, folder, pinnedIds),
    [forPeople, apiPeopleConversations, items, userId, folder, pinnedIds]
  );

  const extraPartnerIds = useMemo(
    () => rawPeopleConversations.map((c) => c.partner.id),
    [rawPeopleConversations]
  );

  const unresolvedIds = useMemo(
    () => collectUnresolvedUserIds(items, userId, extraPartnerIds),
    [items, userId, extraPartnerIds]
  );
  const directory = useMessengerUserDirectory(unresolvedIds);

  const hydratedItems = useMemo(
    () => items.map((item) => hydrateMessageItem(item, directory)),
    [items, directory]
  );

  const peopleConversations: PeopleConversation[] = useMemo(
    () =>
      rawPeopleConversations.map((conv) => ({
        ...conv,
        partner: hydrateUserSummary(conv.partner, directory),
        lastMessage: hydrateMessageItem(conv.lastMessage, directory),
      })),
    [rawPeopleConversations, directory]
  );

  return {
    items: hydratedItems,
    unreadCount,
    total,
    loading: forPeople ? peopleLoading : loading,
    backgroundRefreshing,
    error,
    usingMock,
    refresh,
    peopleConversations,
    currentUserId: userId,
  };
}

/** Thread detail backed by the shared messages data store. */
export function useMessageDetail(
  messageId: string | null,
  currentUserId?: string,
  channel: 'mail' | 'chat' = 'mail'
) {
  const userId = currentUserId ?? '';
  const {
    message,
    replies,
    loading,
    backgroundRefreshing,
    error,
    refresh,
  } = useMessageDetailSlice(messageId, channel);

  const allThreadMessages = useMemo(() => {
    if (!message) return replies;
    return [message, ...replies];
  }, [message, replies]);

  const unresolvedIds = useMemo(
    () => collectUnresolvedUserIds(allThreadMessages, userId),
    [allThreadMessages, userId]
  );
  const directory = useMessengerUserDirectory(unresolvedIds);

  const hydratedMessage = useMemo(
    () => (message ? hydrateMessageItem(message, directory) : null),
    [message, directory]
  );

  const hydratedReplies = useMemo(
    () => replies.map((reply) => hydrateMessageItem(reply, directory)),
    [replies, directory]
  );

  return {
    message: hydratedMessage,
    replies: hydratedReplies,
    loading,
    backgroundRefreshing,
    error,
    refresh,
    currentUserId: userId,
  };
}
