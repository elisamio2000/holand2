/**
 * User DM chat (People) — plugin_user_chat_* tools.
 */
import {
  executeMessagingTool,
  ensureMessagingRecipientId,
  unwrapMessengerData,
  withMessagingApi,
} from '@/services/messaging-shared.service';
import { mockMessagesApi } from '@/app/shared/messages/mock/messages-mock-bridge';
import { dedupeAsync } from '@/utils/async-dedup';
import { normalizeMessageItem } from '@/utils/messages-normalize';
import type {
  MessageContentType,
  MessageDetail,
  MessageDetailResponse,
  MessageItem,
  PeopleConversation,
  RepliesData,
  RepliesResponse,
  ReplyResponse,
  SearchData,
  SearchResponse,
  SendMessageRequest,
  SendResponse,
  UpdateConversationRequest,
  UpdateResponse,
  UserSummary,
} from '@/types/messages.types';

const TOOLS = {
  conversations: 'plugin_user_chat_conversations',
  list: 'plugin_user_chat_list',
  get: 'plugin_user_chat_get',
  send: 'plugin_user_chat_send',
  reply: 'plugin_user_chat_reply',
  replies: 'plugin_user_chat_replies',
  update: 'plugin_user_chat_update',
  delete: 'plugin_user_chat_delete',
  search: 'plugin_user_chat_search',
  updateConversation: 'plugin_user_chat_update_conversation',
  attachLibrary: 'plugin_user_chat_attach_library',
  react: 'plugin_user_chat_react',
  forward: 'plugin_user_chat_forward',
  createGroup: 'plugin_user_chat_create_group',
} as const;

function normalizeDetail(raw: unknown): MessageDetail {
  const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
  const data = unwrapped.data ?? {};
  const item = normalizeMessageItem(data);
  return { ...item, body: String(data.body ?? item.preview ?? '') };
}

function normalizeSearch(raw: unknown): SearchData {
  const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
  const data = unwrapped.data ?? {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  return {
    items: itemsRaw.map((item) => normalizeMessageItem(item)),
    total: Number(data.total ?? itemsRaw.length),
    page: Number(data.page ?? 1),
    limit: Number(data.limit ?? 30),
    query: String(data.query ?? data.q ?? ''),
    folder: null,
  };
}

function normalizeReplies(raw: unknown): RepliesData {
  const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
  const data = unwrapped.data ?? {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  return {
    thread_root_id: String(data.thread_root_id ?? ''),
    items: itemsRaw.map((item) => normalizeMessageItem(item)),
    total: Number(data.total ?? itemsRaw.length),
  };
}

function mapConversationRow(row: Record<string, unknown>): PeopleConversation {
  const partnerRaw = row.partner as Record<string, unknown> | undefined;
  const partner: UserSummary = partnerRaw
    ? {
        id: String(partnerRaw.id ?? ''),
        name: String(partnerRaw.name ?? partnerRaw.display_name ?? partnerRaw.username ?? ''),
        email: partnerRaw.email ? String(partnerRaw.email) : undefined,
        avatar: partnerRaw.avatar_url ? String(partnerRaw.avatar_url) : undefined,
      }
    : { id: '', name: '' };

  const lastRaw = row.last_message as Record<string, unknown> | undefined;
  const lastMessage = lastRaw ? normalizeMessageItem(lastRaw) : normalizeMessageItem({});

  return {
    partner,
    lastMessage,
    unreadCount: Number(row.unread_count ?? 0),
    messageIds: lastRaw?.id ? [String(lastRaw.id)] : [],
    threadRootId: String(
      (lastRaw?.id as string) ?? (row.conversation_id as string) ?? partner.id
    ),
    conversationId: String(row.conversation_id ?? ''),
    muted: Boolean(row.muted),
    pinned: Boolean(row.pinned),
  };
}

/** People lane — user_chat plugin (not AI Chat `/chat/*`). */
export const userChatService = {
  tools: TOOLS,

  async listConversations(
    page = 1,
    limit = 50,
    q?: string
  ): Promise<{ items: PeopleConversation[]; total: number }> {
    return withMessagingApi(
      async () => {
        const args: Record<string, unknown> = { page, limit };
        if (q?.trim()) args.q = q.trim();
        const raw = await executeMessagingTool<unknown>(TOOLS.conversations, args);
        const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
        const data = unwrapped.data ?? {};
        const itemsRaw = Array.isArray(data.items) ? data.items : [];
        return {
          items: itemsRaw.map((row) => mapConversationRow(row as Record<string, unknown>)),
          total: Number(data.total ?? itemsRaw.length),
        };
      },
      () => ({ items: [], total: 0 })
    );
  },

  async listMessages(
    opts: { conversationId?: string; partnerId?: string },
    page = 1,
    limit = 50
  ): Promise<{ items: MessageItem[]; total: number }> {
    const params: Record<string, unknown> = { page, limit };
    if (opts.conversationId) params.conversation_id = opts.conversationId;
    if (opts.partnerId) params.partner_id = opts.partnerId;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.list, params);
        const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
        const data = unwrapped.data ?? {};
        const itemsRaw = Array.isArray(data.items) ? data.items : [];
        return {
          items: itemsRaw.map((item) => normalizeMessageItem(item)),
          total: Number(data.total ?? itemsRaw.length),
        };
      },
      () => ({ items: [], total: 0 })
    );
  },

  async get(messageId: string): Promise<MessageDetailResponse> {
    return withMessagingApi(
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
    );
  },

  async getDetailBundle(
    messageId: string
  ): Promise<[MessageDetailResponse, RepliesResponse]> {
    return dedupeAsync(`user-chat:detail-bundle:${messageId}`, () =>
      Promise.all([this.get(messageId), this.replies(messageId)])
    );
  },

  async send(request: SendMessageRequest): Promise<SendResponse> {
    const resolvedTo = request.to ? await ensureMessagingRecipientId(request.to) : request.to;
    const args: Record<string, unknown> = {
      to: resolvedTo,
      body: request.body,
    };
    if (request.conversation_id) args.conversation_id = request.conversation_id;
    if (request.attachments?.length) args.attachments = request.attachments;
    if (request.client_message_id) args.client_message_id = request.client_message_id;
    if (request.content_type) args.content_type = request.content_type;
    if (request.voice_duration_ms) args.voice_duration_ms = request.voice_duration_ms;
    if (request.reply_to_id) args.reply_to_id = request.reply_to_id;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.send, args);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as SendResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => ({ ok: true, data: mockMessagesApi.send(request), channels: undefined })
    );
  },

  async reply(
    messageId: string,
    body: string,
    attachments?: string[],
    clientMessageId?: string,
    contentType?: MessageContentType,
    voiceDurationMs?: number
  ): Promise<ReplyResponse> {
    const args: Record<string, unknown> = { message_id: messageId, body };
    if (attachments?.length) args.attachments = attachments;
    if (clientMessageId) args.client_message_id = clientMessageId;
    if (contentType) args.content_type = contentType;
    if (voiceDurationMs) args.voice_duration_ms = voiceDurationMs;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.reply, args);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as ReplyResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => ({
        ok: true,
        data: mockMessagesApi.reply(messageId, body, {
          content_type: contentType,
          voice_duration_ms: voiceDurationMs,
        }),
        channels: undefined,
      })
    );
  },

  async replies(messageId: string, limit = 50): Promise<RepliesResponse> {
    return dedupeAsync(`user-chat:replies:${messageId}:${limit}`, () =>
      withMessagingApi(
        async () => {
          const raw = await executeMessagingTool<unknown>(TOOLS.replies, {
            message_id: messageId,
            limit,
          });
          const data = normalizeReplies(raw);
          const unwrapped = unwrapMessengerData(raw);
          return { ok: unwrapped.ok !== false, data, channels: unwrapped.channels };
        },
        () => ({ ok: true, data: mockMessagesApi.replies(messageId, limit), channels: undefined })
      )
    );
  },

  async update(
    messageId: string,
    updates: { read?: boolean; body?: string; starred?: boolean; pinned?: boolean; muted?: boolean }
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
      () => ({ ok: true, data: { id: messageId }, channels: undefined })
    );
  },

  async deleteMessage(messageId: string, forEveryone = false): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.delete, {
          message_id: messageId,
          for_everyone: forEveryone,
        });
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as UpdateResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => {
        mockMessagesApi.delete(messageId);
        return { ok: true, data: { id: messageId }, channels: undefined };
      }
    );
  },

  async search(q: string, page = 1, limit = 30): Promise<SearchResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.search, { q: q.trim(), page, limit });
        const data = normalizeSearch(raw);
        const unwrapped = unwrapMessengerData(raw);
        return { ok: unwrapped.ok !== false, data, channels: unwrapped.channels };
      },
      () => ({
        ok: true,
        data: { items: [], total: 0, page, limit, query: q, folder: null },
        channels: undefined,
      })
    );
  },

  async updateConversation(request: UpdateConversationRequest): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.updateConversation, request);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as UpdateResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => ({ ok: true, data: { id: request.conversation_id }, channels: undefined })
    );
  },

  /** Add or remove emoji reaction on a chat message. */
  async addReaction(messageId: string, emoji: string): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.react, {
          message_id: messageId,
          emoji,
          action: 'add',
        });
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

  /** Remove emoji reaction from a chat message. */
  async removeReaction(messageId: string, emoji: string): Promise<UpdateResponse> {
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.react, {
          message_id: messageId,
          emoji,
          action: 'remove',
        });
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

  /** Forward a chat message to a user or conversation. */
  async forwardMessage(
    messageId: string,
    opts: { to?: string; conversationId?: string; body?: string }
  ): Promise<SendResponse> {
    const args: Record<string, unknown> = {
      message_id: messageId,
      body: opts.body ?? '',
    };
    if (opts.to) args.to = await ensureMessagingRecipientId(opts.to);
    if (opts.conversationId) args.conversation_id = opts.conversationId;

    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.forward, args);
        const unwrapped = unwrapMessengerData(raw);
        return {
          ok: unwrapped.ok !== false,
          data: unwrapped.data as SendResponse['data'],
          channels: unwrapped.channels,
        };
      },
      () => ({ ok: true, data: { id: messageId }, channels: undefined })
    );
  },

  /** Create a group conversation with 2+ members. */
  async createGroupConversation(
    memberIds: string[],
    subject?: string
  ): Promise<{ ok: boolean; conversationId: string; data?: Record<string, unknown> }> {
    const resolved = await Promise.all(memberIds.map((id) => ensureMessagingRecipientId(id)));
    return withMessagingApi(
      async () => {
        const raw = await executeMessagingTool<unknown>(TOOLS.createGroup, {
          member_ids: resolved,
          subject,
        });
        const unwrapped = unwrapMessengerData<Record<string, unknown>>(raw);
        const data = unwrapped.data ?? {};
        return {
          ok: unwrapped.ok !== false,
          conversationId: String(data.conversation_id ?? data.id ?? ''),
          data,
        };
      },
      () => ({ ok: true, conversationId: crypto.randomUUID(), data: {} })
    );
  },
};
