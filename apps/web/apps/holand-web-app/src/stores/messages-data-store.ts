/**
 * Central messenger data store — single source of truth for list/detail slices.
 * Hub, header dropdown, and realtime patches share this store to avoid duplicate fetches.
 */

import { isMessagesUsingMockData, messagesService } from '@/services/messages.service';
import type {
  MessageDetail,
  MessageFolder,
  MessageItem,
} from '@/types/messages.types';
import { invalidateCachePrefix } from '@/utils/async-dedup';
import { isGatewayToolError } from '@/utils/gateway-tool-success';

export type ListSliceKey = `${MessageFolder}|${string}`;

export function buildListSliceKey(folder: MessageFolder, searchQuery?: string): ListSliceKey {
  return `${folder}|${searchQuery?.trim() ?? ''}`;
}

export interface MessagesListSlice {
  key: ListSliceKey;
  folder: MessageFolder;
  searchQuery: string;
  items: MessageItem[];
  unreadCount: number;
  total: number;
  loading: boolean;
  backgroundRefreshing: boolean;
  error: string | null;
  usingMock: boolean;
  lastFetchedAt: number | null;
  /** Delta cursor for future `since` API — set from list response when backend supports it. */
  listCursor: string | null;
}

export interface MessageDetailSlice {
  messageId: string | null;
  message: MessageDetail | null;
  replies: MessageItem[];
  loading: boolean;
  backgroundRefreshing: boolean;
  error: string | null;
}

type Listener = () => void;

function formatMessengerApiError(message: string): string {
  if (message.includes('storage_500')) return `${message} — messages.apiErrorStorage`;
  if (
    (message.includes('plugin_user_mail') ||
      message.includes('plugin_user_chat') ||
      message.includes('plugin_user_messenger')) &&
    message.includes('404')
  ) {
    return `${message} — messages.apiErrorPluginNotRegistered`;
  }
  if (message.includes('plugin_user_messenger_replies') && message.includes('404')) {
    return `${message} — messages.apiErrorReplies`;
  }
  return message;
}

function emptyListSlice(key: ListSliceKey, folder: MessageFolder, searchQuery: string): MessagesListSlice {
  return {
    key,
    folder,
    searchQuery,
    items: [],
    unreadCount: 0,
    total: 0,
    loading: true,
    backgroundRefreshing: false,
    error: null,
    usingMock: false,
    lastFetchedAt: null,
    listCursor: null,
  };
}

const emptyDetailSlice: MessageDetailSlice = {
  messageId: null,
  message: null,
  replies: [],
  loading: false,
  backgroundRefreshing: false,
  error: null,
};

class MessagesDataStore {
  private listSlices = new Map<ListSliceKey, MessagesListSlice>();
  /**
   * Stable empty-slice references per key. `getListSlice` is used as the
   * `useSyncExternalStore` getSnapshot; it MUST return a referentially-stable
   * value when no real data exists yet, otherwise React loops forever.
   */
  private emptyListSlices = new Map<ListSliceKey, MessagesListSlice>();
  private detailSlice: MessageDetailSlice = { ...emptyDetailSlice };
  private listeners = new Set<Listener>();
  private listFetchGen = new Map<ListSliceKey, number>();
  private detailFetchGen = 0;
  private partnerPresence = new Map<string, 'online' | 'away' | 'busy' | 'offline'>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  getListSlice(key: ListSliceKey): MessagesListSlice {
    const existing = this.listSlices.get(key);
    if (existing) return existing;
    let slice = this.emptyListSlices.get(key);
    if (!slice) {
      slice = emptyListSlice(key, key.split('|')[0] as MessageFolder, key.split('|')[1] ?? '');
      this.emptyListSlices.set(key, slice);
    }
    return slice;
  }

  getDetailSlice(): MessageDetailSlice {
    return this.detailSlice;
  }

  getPartnerPresence(partnerId: string): 'online' | 'away' | 'busy' | 'offline' | undefined {
    return this.partnerPresence.get(partnerId);
  }

  /** Fetch or refresh a list slice (hub, dropdown, polling). */
  async fetchList(
    folder: MessageFolder,
    searchQuery = '',
    options?: { background?: boolean; since?: string | null }
  ): Promise<void> {
    const key = buildListSliceKey(folder, searchQuery);
    const prev = this.listSlices.get(key) ?? emptyListSlice(key, folder, searchQuery);
    const gen = (this.listFetchGen.get(key) ?? 0) + 1;
    this.listFetchGen.set(key, gen);

    const hasData = prev.items.length > 0;
    const background = options?.background ?? hasData;

    this.listSlices.set(key, {
      ...prev,
      key,
      folder,
      searchQuery,
      loading: !background,
      backgroundRefreshing: background,
      error: null,
    });
    this.emit();

    try {
      let items: MessageItem[];
      let unreadCount: number;
      let total: number;
      let listCursor: string | null = prev.listCursor;

      if (searchQuery.trim()) {
        const res = await messagesService.search(searchQuery.trim(), folder);
        if (gen !== this.listFetchGen.get(key)) return;
        items = res.data?.items ?? [];
        unreadCount = 0;
        total = res.data?.total ?? 0;
      } else {
        const res = await messagesService.list(folder, 1, 30, undefined, options?.since ?? undefined);
        if (gen !== this.listFetchGen.get(key)) return;
        items = res.data?.items ?? [];
        unreadCount = res.data?.unread_count ?? 0;
        total = res.data?.total ?? 0;
        const rawCursor = (res as { data?: { cursor?: string; since?: string } }).data;
        if (rawCursor && typeof rawCursor === 'object') {
          const c = rawCursor as { cursor?: string; since?: string };
          listCursor = c.cursor ?? c.since ?? listCursor;
        }
      }

      this.listSlices.set(key, {
        key,
        folder,
        searchQuery,
        items,
        unreadCount,
        total,
        loading: false,
        backgroundRefreshing: false,
        error: null,
        usingMock: isMessagesUsingMockData(),
        lastFetchedAt: Date.now(),
        listCursor,
      });
    } catch (err) {
      if (gen !== this.listFetchGen.get(key)) return;
      const raw = isGatewayToolError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to load messages';
      this.listSlices.set(key, {
        ...prev,
        key,
        folder,
        searchQuery,
        loading: false,
        backgroundRefreshing: false,
        error: formatMessengerApiError(raw),
        items: background ? prev.items : [],
        usingMock: false,
      });
    }
    this.emit();
  }

  invalidateList(folder?: MessageFolder): void {
    invalidateCachePrefix('messenger:list:');
    invalidateCachePrefix('messenger:search:');
    if (folder) {
      for (const key of this.listSlices.keys()) {
        if (key.startsWith(`${folder}|`)) {
          this.listFetchGen.set(key, (this.listFetchGen.get(key) ?? 0) + 1);
        }
      }
    }
  }

  async fetchDetail(
    messageId: string | null,
    options?: { background?: boolean; channel?: 'mail' | 'chat' }
  ): Promise<void> {
    if (!messageId) {
      this.detailSlice = { ...emptyDetailSlice };
      this.emit();
      return;
    }

    const gen = ++this.detailFetchGen;
    const hasData = this.detailSlice.messageId === messageId && this.detailSlice.message != null;
    const background = options?.background ?? hasData;

    this.detailSlice = {
      ...this.detailSlice,
      messageId,
      loading: !background,
      backgroundRefreshing: background,
      error: null,
    };
    this.emit();

    try {
      const channel = options?.channel ?? 'mail';
      const [detailRes, repliesRes] = await messagesService.getDetailBundle(messageId, channel);
      if (gen !== this.detailFetchGen) return;

      this.detailSlice = {
        messageId,
        message: detailRes.data ?? null,
        replies: repliesRes.data?.items ?? [],
        loading: false,
        backgroundRefreshing: false,
        error: null,
      };

      if (detailRes.data && !detailRes.data.read) {
        await messagesService.update(messageId, { read: true }, channel).catch(() => undefined);
        if (detailRes.data) {
          this.patchMessage(messageId, { read: true });
        }
      }
    } catch (err) {
      if (gen !== this.detailFetchGen) return;
      const msg = isGatewayToolError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to load message';
      this.detailSlice = {
        messageId,
        message: background ? this.detailSlice.message : null,
        replies: background ? this.detailSlice.replies : [],
        loading: false,
        backgroundRefreshing: false,
        error: msg,
      };
    }
    this.emit();
  }

  /** Merge or insert a message into all list slices for its folder. */
  upsertListItem(item: MessageItem): void {
    for (const [key, slice] of this.listSlices) {
      const idx = slice.items.findIndex((m) => m.id === item.id);
      const items =
        idx >= 0
          ? slice.items.map((m, i) => (i === idx ? { ...m, ...item } : m))
          : [item, ...slice.items];
      const unreadDelta = !item.read && idx < 0 ? 1 : 0;
      this.listSlices.set(key, {
        ...slice,
        items,
        unreadCount: slice.unreadCount + unreadDelta,
        total: idx < 0 ? slice.total + 1 : slice.total,
      });
    }
    this.emit();
  }

  patchMessage(messageId: string, patch: Partial<MessageItem>): void {
    for (const [key, slice] of this.listSlices) {
      const idx = slice.items.findIndex((m) => m.id === messageId);
      if (idx < 0) continue;
      const items = slice.items.map((m, i) => (i === idx ? { ...m, ...patch } : m));
      this.listSlices.set(key, { ...slice, items });
    }
    if (this.detailSlice.message?.id === messageId) {
      this.detailSlice = {
        ...this.detailSlice,
        message: { ...this.detailSlice.message, ...patch },
      };
    }
    const replyIdx = this.detailSlice.replies.findIndex((m) => m.id === messageId);
    if (replyIdx >= 0) {
      const replies = this.detailSlice.replies.map((m, i) =>
        i === replyIdx ? { ...m, ...patch } : m
      );
      this.detailSlice = { ...this.detailSlice, replies };
    }
    this.emit();
  }

  removeMessage(messageId: string): void {
    for (const [key, slice] of this.listSlices) {
      const removed = slice.items.find((m) => m.id === messageId);
      this.listSlices.set(key, {
        ...slice,
        items: slice.items.filter((m) => m.id !== messageId),
        unreadCount: removed && !removed.read ? Math.max(0, slice.unreadCount - 1) : slice.unreadCount,
        total: Math.max(0, slice.total - 1),
      });
    }
    if (this.detailSlice.message?.id === messageId) {
      this.detailSlice = { ...emptyDetailSlice };
    } else {
      this.detailSlice = {
        ...this.detailSlice,
        replies: this.detailSlice.replies.filter((m) => m.id !== messageId),
      };
    }
    invalidateCachePrefix(`messenger:get:${messageId}`);
    invalidateCachePrefix(`messenger:detail-bundle:${messageId}`);
    this.emit();
  }

  appendReply(reply: MessageItem, rootId: string): void {
    if (this.detailSlice.messageId === rootId || this.detailSlice.message?.id === rootId) {
      if (!this.detailSlice.replies.some((r) => r.id === reply.id)) {
        this.detailSlice = {
          ...this.detailSlice,
          replies: [...this.detailSlice.replies, reply],
        };
      }
    }
    this.upsertListItem(reply);
  }

  /** Replace optimistic pending reply with server-confirmed message. */
  reconcileOptimisticReply(clientMessageId: string, server: MessageItem, rootId: string): void {
    const pendingId = `pending:${clientMessageId}`;
    if (this.detailSlice.messageId === rootId || this.detailSlice.message?.id === rootId) {
      this.detailSlice = {
        ...this.detailSlice,
        replies: [
          ...this.detailSlice.replies.filter(
            (r) => r.id !== pendingId && r.client_message_id !== clientMessageId
          ),
          server,
        ],
      };
    }
    this.removeMessage(pendingId);
    this.upsertListItem(server);
  }

  markOptimisticFailed(clientMessageId: string): void {
    const pendingId = `pending:${clientMessageId}`;
    this.patchMessage(pendingId, { delivery_status: 'failed' });
  }

  applyReadReceipt(messageId: string, userId: string): void {
    const patchReadBy = <T extends MessageItem>(m: T): T => {
      const readBy = m.read_by ?? [];
      if (readBy.includes(userId)) return m;
      return { ...m, read_by: [...readBy, userId], delivery_status: 'read' as const };
    };
    for (const [key, slice] of this.listSlices) {
      const idx = slice.items.findIndex((m) => m.id === messageId);
      if (idx < 0) continue;
      const items = slice.items.map((m, i) => (i === idx ? patchReadBy(m) : m));
      this.listSlices.set(key, { ...slice, items });
    }
    if (this.detailSlice.message?.id === messageId) {
      this.detailSlice = {
        ...this.detailSlice,
        message: patchReadBy(this.detailSlice.message),
      };
    }
    this.emit();
  }

  setPartnerPresence(
    partnerId: string,
    status: 'online' | 'away' | 'busy' | 'offline'
  ): void {
    this.partnerPresence.set(partnerId, status);
    this.emit();
  }

  /** Handle realtime WS payloads — returns true if store handled without full refetch. */
  applyRealtimeEvent(
    type: string,
    data: unknown
  ): 'handled' | 'needs_refetch' {
    const payload = (data ?? {}) as Record<string, unknown>;
    if (payload.polling === true) return 'needs_refetch';

    const messageRaw = payload.message ?? payload.item ?? payload.data;
    const messageId = String(
      payload.message_id ?? payload.messageId ?? payload.id ?? (messageRaw as { id?: string })?.id ?? ''
    );

    switch (type) {
      case 'new_message': {
        if (messageRaw && typeof messageRaw === 'object') {
          const item = messageRaw as MessageItem;
          if (item.id) {
            this.upsertListItem(item);
            const rootId = item.thread_root_id ?? item.id;
            if (this.detailSlice.messageId === rootId) {
              this.appendReply(item, rootId);
            }
            return 'handled';
          }
        }
        return messageId ? 'needs_refetch' : 'needs_refetch';
      }
      case 'message_updated': {
        if (messageRaw && typeof messageRaw === 'object') {
          this.patchMessage((messageRaw as MessageItem).id, messageRaw as Partial<MessageItem>);
          return 'handled';
        }
        if (messageId) {
          invalidateCachePrefix(`messenger:get:${messageId}`);
          return 'needs_refetch';
        }
        return 'needs_refetch';
      }
      case 'message_deleted': {
        if (messageId) {
          this.removeMessage(messageId);
          return 'handled';
        }
        return 'needs_refetch';
      }
      case 'read_receipt': {
        const uid = String(payload.user_id ?? payload.userId ?? '');
        if (messageId && uid) {
          this.applyReadReceipt(messageId, uid);
          return 'handled';
        }
        return 'needs_refetch';
      }
      case 'presence': {
        const partnerId = String(payload.partner_id ?? payload.partnerId ?? payload.user_id ?? '');
        const status = payload.status as 'online' | 'away' | 'busy' | 'offline' | undefined;
        if (partnerId && status) {
          this.setPartnerPresence(partnerId, status);
          return 'handled';
        }
        return 'handled';
      }
      default:
        return 'needs_refetch';
    }
  }
}

export const messagesDataStore = new MessagesDataStore();
