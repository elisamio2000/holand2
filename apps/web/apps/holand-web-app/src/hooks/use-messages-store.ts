'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  buildListSliceKey,
  messagesDataStore,
  type MessagesListSlice,
  type MessageDetailSlice,
} from '@/stores/messages-data-store';
import type { MessageFolder } from '@/types/messages.types';

/** Subscribe to a list slice (SSOT) — hub, dropdown, and rails share the same fetch. */
export function useMessagesListSlice(folder: MessageFolder, searchQuery = '') {
  const key = buildListSliceKey(folder, searchQuery);

  const slice = useSyncExternalStore(
    (onStoreChange) => messagesDataStore.subscribe(onStoreChange),
    () => messagesDataStore.getListSlice(key),
    () => messagesDataStore.getListSlice(key)
  );

  useEffect(() => {
    const current = messagesDataStore.getListSlice(key);
    const stale =
      !current.lastFetchedAt || Date.now() - current.lastFetchedAt > 30_000;
    if (stale && !current.loading && !current.backgroundRefreshing) {
      void messagesDataStore.fetchList(folder, searchQuery, {
        background: current.items.length > 0,
      });
    } else if (!current.lastFetchedAt && !current.loading) {
      void messagesDataStore.fetchList(folder, searchQuery);
    }
  }, [key, folder, searchQuery]);

  const refresh = useCallback(
    (background = false) => {
      messagesDataStore.invalidateList(folder);
      return messagesDataStore.fetchList(folder, searchQuery, { background });
    },
    [folder, searchQuery]
  );

  return { ...slice, refresh };
}

export function useMessageDetailSlice(messageId: string | null, channel: 'mail' | 'chat' = 'mail') {
  const slice = useSyncExternalStore(
    (onStoreChange) => messagesDataStore.subscribe(onStoreChange),
    () => messagesDataStore.getDetailSlice(),
    () => messagesDataStore.getDetailSlice()
  );

  useEffect(() => {
    if (!messageId) {
      void messagesDataStore.fetchDetail(null);
      return;
    }
    if (slice.messageId !== messageId) {
      void messagesDataStore.fetchDetail(messageId, { channel });
    }
  }, [messageId, slice.messageId, channel]);

  const refresh = useCallback(
    (background = false) => messagesDataStore.fetchDetail(messageId, { background, channel }),
    [messageId, channel]
  );

  const merged: MessageDetailSlice =
    slice.messageId === messageId ? slice : { ...slice, messageId, loading: Boolean(messageId) };

  return { ...merged, refresh };
}

export function usePartnerPresenceFromStore(partnerId: string) {
  const presence = useSyncExternalStore(
    (onStoreChange) => messagesDataStore.subscribe(onStoreChange),
    () => messagesDataStore.getPartnerPresence(partnerId),
    () => undefined
  );
  return presence;
}

/** Imperative access for non-React modules (entity bus, bug reporter). */
export { messagesDataStore };
