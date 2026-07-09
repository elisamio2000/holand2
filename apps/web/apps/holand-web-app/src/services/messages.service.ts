// ============================================
// Messages facade — mail (Mailbox) + user_chat (People)
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { pluginsService } from '@/services/plugins.service';
import { mailService } from '@/services/mail.service';
import { userChatService } from '@/services/user-chat.service';
import {
  getUserChatWsInfo,
  isMessagesUsingMockData,
  isWsInfoUnavailable,
  resetWsInfoUnavailable,
  resolveDirectoryUser,
  searchDirectoryUsers,
  uploadMessagingAttachment,
  type MessagingUploadContext,
} from '@/services/messaging-shared.service';
import type {
  BulkUpdateMailRequest,
  ForwardMailRequest,
  MessageContentType,
  MessageDetailResponse,
  MessageFolder,
  RepliesResponse,
  ReplyResponse,
  SendMessageRequest,
  SendResponse,
  UpdateConversationRequest,
  UpdateResponse,
} from '@/types/messages.types';

export type MessagesChannel = 'mail' | 'chat';

export { isMessagesUsingMockData };

export const messagesService = {
  mailTools: mailService.tools,
  chatTools: userChatService.tools,

  list: (
    folder?: MessageFolder,
    page?: number,
    limit?: number,
    q?: string,
    since?: string
  ) => mailService.list(folder, page, limit, q, since),

  get: (messageId: string, channel: MessagesChannel = 'mail') =>
    channel === 'chat' ? userChatService.get(messageId) : mailService.get(messageId),

  getDetailBundle: (
    messageId: string,
    channel: MessagesChannel = 'mail'
  ): Promise<[MessageDetailResponse, RepliesResponse]> =>
    channel === 'chat'
      ? userChatService.getDetailBundle(messageId)
      : Promise.all([
          mailService.get(messageId),
          Promise.resolve({
            ok: true,
            data: { items: [], total: 0, thread_root_id: messageId },
            channels: undefined,
          }),
        ]),

  send: (request: SendMessageRequest, channel: MessagesChannel = 'mail'): Promise<SendResponse> =>
    channel === 'chat' ? userChatService.send(request) : mailService.send(request),

  reply: (
    messageId: string,
    body: string,
    attachments?: string[],
    clientMessageId?: string,
    contentType?: MessageContentType,
    voiceDurationMs?: number
  ) =>
    userChatService.reply(
      messageId,
      body,
      attachments,
      clientMessageId,
      contentType,
      voiceDurationMs
    ),

  replies: (messageId: string, limit?: number) => userChatService.replies(messageId, limit),

  search: (q: string, folder?: MessageFolder, page?: number, limit?: number) =>
    mailService.search(q, folder, page, limit),

  update: (
    messageId: string,
    updates: Parameters<typeof mailService.update>[1],
    channel: MessagesChannel = 'mail'
  ): Promise<UpdateResponse | void> =>
    channel === 'chat'
      ? userChatService.update(messageId, {
          read: updates.read,
          body: updates.body,
          starred: updates.starred,
          pinned: updates.pinned,
          muted: updates.muted,
        })
      : mailService.update(messageId, updates),

  resend: (messageId: string) => mailService.resend(messageId),

  delete: (messageId: string, channel: MessagesChannel = 'mail', permanent = false) =>
    channel === 'chat'
      ? userChatService.deleteMessage(messageId)
      : mailService.delete(messageId, permanent),

  forward: (request: ForwardMailRequest) => mailService.forward(request),

  bulkUpdate: (request: BulkUpdateMailRequest) => mailService.bulkUpdate(request),

  snooze: (messageId: string, snoozeUntil: string) => mailService.snooze(messageId, snoozeUntil),

  replyAll: (
    replyToId: string,
    body: string,
    opts?: { subject?: string; attachments?: string[]; client_message_id?: string }
  ) => mailService.replyAll(replyToId, body, opts),

  searchChat: (q: string, page?: number, limit?: number) =>
    userChatService.search(q, page, limit),

  updateConversation: (request: UpdateConversationRequest) =>
    userChatService.updateConversation(request),

  attachFromLibrary: (artifactId: string) => mailService.attachFromLibrary(artifactId),

  listConversations: (page?: number, limit?: number, q?: string) =>
    userChatService.listConversations(page, limit, q),

  listChatMessages: (
    opts: { conversationId?: string; partnerId?: string },
    page?: number,
    limit?: number
  ) => userChatService.listMessages(opts, page, limit),

  uploadAttachment: (
    file: File,
    onProgress?: (pct: number) => void,
    context: MessagingUploadContext = 'mail'
  ) => uploadMessagingAttachment(file, context, onProgress),

  searchDirectoryUsers,
  resolveDirectoryUser,
  getWsInfo: getUserChatWsInfo,
  resetWsInfoUnavailable,
  isWsInfoUnavailable,

  async probeApiHealth(): Promise<{
    mailList: 'available' | 'unavailable';
    chatConversations: 'available' | 'unavailable';
    wsInfo: 'available' | 'unavailable';
  }> {
    const httpStatus = (error: unknown): number | undefined =>
      (error as { response?: { status?: number } })?.response?.status;

    const probe = async (fn: () => Promise<unknown>): Promise<'available' | 'unavailable'> => {
      try {
        await fn();
        return 'available';
      } catch (error: unknown) {
        const status = httpStatus(error);
        if (status === 401 || status === 403) return 'available';
        if (status === 404 || (status != null && status >= 500)) return 'unavailable';
        return 'available';
      }
    };

    const [mailList, chatConversations, wsInfo] = await Promise.all([
      probe(() =>
        pluginsService.executeTool(mailService.tools.list, { folder: 'inbox', page: 1, limit: 1 })
      ),
      probe(() =>
        pluginsService.executeTool(userChatService.tools.conversations, { page: 1, limit: 1 })
      ),
      probe(() => gatewayClient.get('/user-chat/ws-info')),
    ]);

    return { mailList, chatConversations, wsInfo };
  },
};

export { mailService, userChatService };
