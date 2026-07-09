/**
 * Internal mail (Mailbox) — plugin_user_mail_* tools.
 */
import {
  executeMessagingTool,
  ensureMessagingRecipientId,
  unwrapMessengerData,
  withMessagingApi,
} from '@/services/messaging-shared.service';
import { mockMessagesApi } from '@/app/shared/messages/mock/messages-mock-bridge';
import { cachedAsync } from '@/utils/async-dedup';
import { normalizeMessageItem } from '@/utils/messages-normalize';
import type {
  AttachLibraryData,
  AttachLibraryResponse,
  BulkUpdateMailRequest,
  DeleteResponse,
  ForwardMailRequest,
  MessageDetail,
  MessageDetailResponse,
  MessageFolder,
  MessagePriority,
  MessagesListData,
  MessagesListResponse,
  SearchData,
  SearchResponse,
  SendMessageData,
  SendMessageRequest,
  SendResponse,
  UpdateResponse,
} from '@/types/messages.types';

const TOOLS = {
  list: 'plugin_user_mail_list',
  get: 'plugin_user_mail_get',
  send: 'plugin_user_mail_send',
  search: 'plugin_user_mail_search',
  update: 'plugin_user_mail_update',
  bulkUpdate: 'plugin_user_mail_bulk_update',
  delete: 'plugin_user_mail_delete',
  forward: 'plugin_user_mail_forward',
  resend: 'plugin_user_mail_resend',
  attachLibrary: 'plugin_user_mail_attach_library',
  labels: 'plugin_user_mail_labels',
  cancelSend: 'plugin_user_mail_cancel_send',
} as const;

const LIST_CACHE_TTL_MS = 1500;
const SEARCH_CACHE_TTL_MS = 800;
const DETAIL_CACHE_TTL_MS = 800;

function normalizeListData(raw: unknown, folder: MessageFolder): MessagesListData {
  const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
  const data = unwrapped.data ?? {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  return {
    items: itemsRaw.map((item) => normalizeMessageItem(item, folder)),
    unread_count: Number(data.unread_count ?? 0),
    total: Number(data.total ?? itemsRaw.length),
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? 30),
  };
}

function normalizeDetail(raw: unknown): MessageDetail {
  const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
  const data = unwrapped.data ?? {};
  const item = normalizeMessageItem(data);
  return { ...item, body: String(data.body ?? item.preview ?? '') };
}

function normalizeSearch(raw: unknown, folder?: MessageFolder): SearchData {
  const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
  const data = unwrapped.data ?? {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const resolvedFolder = data.folder as MessageFolder | null | undefined;
  return {
    items: itemsRaw.map((item) =>
      normalizeMessageItem(item, folder ?? (resolvedFolder as MessageFolder) ?? 'inbox')
    ),
    total: Number(data.total ?? itemsRaw.length),
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? 30),
    query: String(data.query ?? ''),
    folder: resolvedFolder ?? null,
  };
}

export const mailService = {
  tools: TOOLS,

  async list(
    folder: MessageFolder = 'inbox',
    page = 1,
    limit = 30,
    q?: string,
    since?: string
  ): Promise<MessagesListResponse> {
    const dedupeKey = `mail:list:${folder}:${page}:${limit}:${q?.trim() ?? ''}:${since ?? ''}`;
    return cachedAsync(
      dedupeKey,
      () =>
        withMessagingApi(
          async () => {
            const args: Record<string, unknown> = { folder, page, limit };
            if (q?.trim()) args.q = q.trim();
            if (since) args.since = since;
            const raw = await executeMessagingTool<unknown>(TOOLS.list, args);
            const data = normalizeListData(raw, folder);
            const unwrapped = unwrapMessengerData(raw);
            return { ok: unwrapped.ok !== false, data, channels: unwrapped.channels };
          },
          () => ({ ok: true, data: mockMessagesApi.list(folder, page, limit, q), channels: undefined })
        ),
      LIST_CACHE_TTL_MS
    );
  },

  async get(messageId: string): Promise<MessageDetailResponse> {
    return cachedAsync(
      `mail:get:${messageId}`,
      () =>
        withMessagingApi(
          async () => {
            const raw = await executeMessagingTool<unknown>(TOOLS.get, { message_id: messageId });
            const data = normalizeDetail(raw);
            const unwrapped = unwrapMessengerData(raw);
            return { ok: unwrapped.ok !== false, data, channels: unwrapped.channels };
          },
          () => {
            const data = mockMessagesApi.get(messageId);
            if (!data) throw new Error('Message not found');
            return { ok: true, data, channels: undefined };
          }
        ),
      DETAIL_CACHE_TTL_MS
    );
  },

  async send(request: SendMessageRequest): Promise<SendResponse> {
    const resolvedTo = request.to ? await ensureMessagingRecipientId(request.to) : request.to;
    const resolvedCc = request.cc?.length
      ? await Promise.all(request.cc.map((id) => ensureMessagingRecipientId(id)))
      : undefined;
    const resolvedBcc = request.bcc?.length
      ? await Promise.all(request.bcc.map((id) => ensureMessagingRecipientId(id)))
      : undefined;

    const args: Record<string, unknown> = {
      to: resolvedTo,
      body: request.body,
      priority: (request.priority as MessagePriority) ?? 'normal',
      draft: request.draft ?? false,
    };
    if (request.subject) args.subject = request.subject;
    if (resolvedCc?.length) args.cc = resolvedCc;
    if (resolvedBcc?.length) args.bcc = resolvedBcc;
    if (request.attachments?.length) args.attachments = request.attachments;
    if (request.client_message_id) args.client_message_id = request.client_message_id;
    if (request.reply_to_id) args.reply_to_id = request.reply_to_id;
    if (request.reply_all) args.reply_all = request.reply_all;
    if (request.scheduled_at) args.scheduled_at = request.scheduled_at;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.send, args);
        const unwrapped = unwrapMessengerData<SendMessageData>(raw);
        return { ok: unwrapped.ok !== false, data: unwrapped.data, channels: unwrapped.channels };
      },
      () => ({ ok: true, data: mockMessagesApi.send(request), channels: undefined })
    );
  },

  async search(q: string, folder?: MessageFolder, page = 1, limit = 30): Promise<SearchResponse> {
    const args: Record<string, unknown> = { q: q.trim(), page, limit };
    if (folder) args.folder = folder;
    return cachedAsync(
      `mail:search:${folder ?? 'all'}:${page}:${limit}:${q.trim()}`,
      () =>
        withMessagingApi(
          async () => {
            const raw = await executeMessagingTool<unknown>(TOOLS.search, args);
            const data = normalizeSearch(raw, folder);
            const unwrapped = unwrapMessengerData(raw);
            return { ok: unwrapped.ok !== false, data, channels: unwrapped.channels };
          },
          () => ({ ok: true, data: mockMessagesApi.search(q, folder, page, limit), channels: undefined })
        ),
      SEARCH_CACHE_TTL_MS
    );
  },

  async update(
    messageId: string,
    updates: {
      read?: boolean;
      folder?: MessageFolder;
      body?: string;
      starred?: boolean;
      pinned?: boolean;
      muted?: boolean;
      snooze_until?: string | null;
    }
  ): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.update, {
          message_id: messageId,
          ...updates,
        });
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as UpdateResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => {
        mockMessagesApi.update(messageId, updates);
        return { ok: true, data: { id: messageId }, channels: undefined };
      }
    );
  },

  async resend(messageId: string): Promise<SendResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.resend, { message_id: messageId });
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as SendMessageData,
          channels: unwrapped.channels,
        };
      },
      () => {
        const result = mockMessagesApi.resend(messageId);
        if (!result) throw new Error('Message not found');
        return { ok: true, data: result, channels: undefined };
      }
    );
  },

  async delete(messageId: string, permanent = false): Promise<DeleteResponse> {
    return withMessagingApi(
      async () => {
        const args: Record<string, unknown> = { message_id: messageId };
        if (permanent) args.permanent = true;
        const raw = await executeMessagingTool<unknown>(TOOLS.delete, args);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as DeleteResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => {
        mockMessagesApi.delete(messageId);
        return { ok: true, data: { id: messageId }, channels: undefined };
      }
    );
  },

  /** Snooze until ISO datetime — Gmail-style defer via plugin_user_mail_update. */
  async snooze(messageId: string, snoozeUntil: string): Promise<UpdateResponse> {
    return this.update(messageId, { snooze_until: snoozeUntil });
  },

  async bulkUpdate(request: BulkUpdateMailRequest): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.bulkUpdate, request);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as UpdateResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => {
        for (const id of request.message_ids) {
          mockMessagesApi.update(id, {
            read: request.read,
            folder: request.folder,
            starred: request.starred,
            pinned: request.pinned,
            muted: request.muted,
          });
        }
        return { ok: true, data: { id: request.message_ids[0] ?? '' }, channels: undefined };
      }
    );
  },

  async forward(request: ForwardMailRequest): Promise<SendResponse> {
    const resolvedTo = await ensureMessagingRecipientId(request.to);
    const resolvedCc = request.cc?.length
      ? await Promise.all(request.cc.map((id) => ensureMessagingRecipientId(id)))
      : undefined;
    const resolvedBcc = request.bcc?.length
      ? await Promise.all(request.bcc.map((id) => ensureMessagingRecipientId(id)))
      : undefined;

    const args: Record<string, unknown> = {
      message_id: request.message_id,
      to: resolvedTo,
      body: request.body ?? '',
    };
    if (resolvedCc?.length) args.cc = resolvedCc;
    if (resolvedBcc?.length) args.bcc = resolvedBcc;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.forward, args);
        const unwrapped = unwrapMessengerData<SendMessageData>(raw);
        return { ok: unwrapped.ok !== false, data: unwrapped.data, channels: unwrapped.channels };
      },
      () => ({
        ok: true,
        data: mockMessagesApi.send({
          to: resolvedTo,
          body: request.body ?? '',
          subject: 'Fwd:',
        }),
        channels: undefined,
      })
    );
  },

  /** Reply-all via send with reply_to_id + reply_all (Outlook participant collection on BE). */
  async replyAll(
    replyToId: string,
    body: string,
    opts?: { subject?: string; attachments?: string[]; client_message_id?: string }
  ): Promise<SendResponse> {
    return this.send({
      to: replyToId,
      body,
      reply_to_id: replyToId,
      reply_all: true,
      subject: opts?.subject,
      attachments: opts?.attachments,
      client_message_id: opts?.client_message_id ?? crypto.randomUUID(),
      draft: false,
    });
  },

  async attachFromLibrary(artifactId: string): Promise<AttachLibraryResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.attachLibrary, { artifact_id: artifactId });
        const unwrapped = unwrapMessengerData<AttachLibraryData>(raw);
        return { ok: unwrapped.ok !== false, data: unwrapped.data, channels: unwrapped.channels };
      },
      () => ({ ok: true, data: mockMessagesApi.attachFromLibrary(artifactId), channels: undefined })
    );
  },

  /** List user-defined mail labels. */
  async listLabels(): Promise<{ items: Array<{ id: string; name: string; color?: string | null }>; total: number }> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.labels, { action: 'list' });
        const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
        const data = unwrapped.data ?? {};
        const itemsRaw = Array.isArray(data.items) ? data.items : [];
        return {
          items: itemsRaw.map((row) => {
            const item = row as Record<string, unknown>;
            return {
              id: String(item.id ?? ''),
              name: String(item.name ?? ''),
              color: item.color ? String(item.color) : null,
            };
          }),
          total: Number(data.total ?? itemsRaw.length),
        };
      },
      () => ({ items: [], total: 0 })
    );
  },

  /** Create a mail label (upsert by name). */
  async createLabel(
    name: string,
    color?: string
  ): Promise<{ id: string; name: string; color?: string | null }> {
    return withMessagingApi(
      async () => {
        const args: Record<string, unknown> = { action: 'create', name: name.trim() };
        if (color) args.color = color;
        const raw = await executeMessagingTool<unknown>(TOOLS.labels, args);
        const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
        const data = unwrapped.data ?? {};
        return {
          id: String(data.id ?? ''),
          name: String(data.name ?? name),
          color: data.color ? String(data.color) : null,
        };
      },
      () => ({ id: crypto.randomUUID(), name, color: color ?? null })
    );
  },

  /** Apply or remove labels on a message. */
  async applyLabels(
    messageId: string,
    labelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<UpdateResponse> {
    const args: Record<string, unknown> = {
      action: 'apply',
      message_id: messageId,
    };
    if (labelIds?.length) args.label_ids = labelIds;
    if (removeLabelIds?.length) args.remove_label_ids = removeLabelIds;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.labels, args);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as UpdateResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => ({ ok: true, data: { id: messageId }, channels: undefined })
    );
  },

  /** Undo send within 10s or cancel a scheduled send. */
  async cancelSend(messageId: string): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.cancelSend, { message_id: messageId });
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as UpdateResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => ({ ok: true, data: { id: messageId, status: 'recalled' }, channels: undefined })
    );
  },
};
