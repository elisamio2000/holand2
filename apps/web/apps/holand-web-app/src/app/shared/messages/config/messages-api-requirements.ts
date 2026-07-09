// ============================================
// Messages — live API manifest for dev panel
// Source: plugin_user_mail + plugin_user_chat + gateway realtime + admin directory
// ============================================

import type { LiveApiRequirement } from '@/platform/dev-panels';

export type MessagesApiHealthEndpointStatus = 'unknown' | 'available' | 'unavailable';

export type MessagesApiRequirementStatus = 'live' | 'partial' | 'missing';

export type MessagesApiLane = 'shared' | 'mailbox' | 'people';

export type MessagesApiGroup =
  | 'core'
  | 'mailbox'
  | 'people'
  | 'attachments'
  | 'realtime'
  | 'admin'
  | 'metadata';

export interface MessagesApiRequirement extends LiveApiRequirement {
  status: MessagesApiRequirementStatus;
  group: MessagesApiGroup;
  lane: MessagesApiLane;
  rbac?: string;
  storageRoute?: string;
  consumer?: string;
  healthKey?: 'mailList' | 'chatConversations' | 'wsInfo';
}

/** Display order for grouped live API sections in dev panel. */
export const MESSAGES_API_GROUP_ORDER: MessagesApiGroup[] = [
  'core',
  'mailbox',
  'people',
  'attachments',
  'realtime',
  'admin',
  'metadata',
];

/** APIs actively used by /messages — for dev panel "APIs in use" tab. */
export const MESSAGES_API_REQUIREMENTS: MessagesApiRequirement[] = [
  {
    id: 'list',
    group: 'core',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_list/execute (folder, page, limit, q)',
    status: 'live',
    rbac: 'mail:read, tools:execute',
    storageRoute: 'GET /mail',
    consumer: 'messages-data-store.ts (mailbox)',
    healthKey: 'mailList',
  },
  {
    id: 'get-mail',
    group: 'core',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_get/execute (message_id)',
    status: 'live',
    rbac: 'mail:read, tools:execute',
    storageRoute: 'GET /mail/{message_id}',
    consumer: 'thread-detail.tsx (mailbox)',
  },
  {
    id: 'get-chat',
    group: 'core',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_get/execute (message_id)',
    status: 'live',
    rbac: 'user_chat:read, tools:execute',
    storageRoute: 'GET /user-chat/messages/{message_id}',
    consumer: 'thread-detail.tsx (people)',
  },
  {
    id: 'conversations',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_conversations/execute',
    status: 'live',
    rbac: 'user_chat:read, tools:execute',
    storageRoute: 'GET /user-chat/conversations',
    consumer: 'use-messages.ts (People sidebar)',
    healthKey: 'chatConversations',
  },
  {
    id: 'send-mail',
    group: 'core',
    lane: 'mailbox',
    endpoint:
      'POST /tools/plugin_user_mail_send/execute (to, body, subject, cc, bcc, draft, …)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'POST /mail',
    consumer: 'message-compose-view.tsx, bug-report-delivery.service.ts',
  },
  {
    id: 'send-chat',
    group: 'core',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_send/execute (to, body, content_type, …)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'POST /user-chat/messages',
    consumer: 'people-draft-thread.tsx, inline-composer.tsx',
  },
  {
    id: 'search',
    group: 'core',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_search/execute (q, folder, page, limit)',
    status: 'live',
    rbac: 'mail:read, tools:execute',
    storageRoute: 'GET /mail/search',
    consumer: 'messages-hub.tsx',
  },
  {
    id: 'update',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint:
      'POST /tools/plugin_user_mail_update/execute (read, folder, body, starred, pinned, muted)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'PATCH /mail/{message_id}',
    consumer: 'mailbox-list.tsx, messages-hub.tsx',
  },
  {
    id: 'delete',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_delete/execute (message_id)',
    status: 'live',
    rbac: 'mail:delete, tools:execute',
    storageRoute: 'DELETE /mail/{message_id}',
    consumer: 'mailbox-list.tsx',
  },
  {
    id: 'resend',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_resend/execute (message_id)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'POST /mail/{message_id}/resend',
    consumer: 'thread-detail.tsx',
  },
  {
    id: 'forward-mail',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_forward/execute (message_id, to, body, cc, bcc)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'POST /mail/{message_id}/forward',
    consumer: 'forward-modal.tsx, mail.service.ts',
  },
  {
    id: 'bulk-update-mail',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint:
      'POST /tools/plugin_user_mail_bulk_update/execute (message_ids, read, folder, starred)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'PATCH /mail/bulk',
    consumer: 'messages-hub.tsx bulk toolbar',
  },
  {
    id: 'snooze-mail',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_update/execute (message_id, snooze_until)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'PATCH /mail/{message_id}',
    consumer: 'email-header.tsx snooze action',
  },
  {
    id: 'mail-labels',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_labels/execute (action: list|create|apply)',
    status: 'live',
    rbac: 'mail:read, mail:write, tools:execute',
    storageRoute: 'GET/POST /mail/labels, PATCH /mail/{id}/labels',
    consumer: 'mail.service.ts listLabels, createLabel, applyLabels',
  },
  {
    id: 'cancel-send-mail',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_cancel_send/execute (message_id)',
    status: 'live',
    rbac: 'mail:write, tools:execute',
    storageRoute: 'POST /mail/{message_id}/cancel-send',
    consumer: 'mail.service.ts cancelSend',
  },
  {
    id: 'chat-react',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_react/execute (message_id, emoji, action)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'POST/DELETE /user-chat/messages/{id}/reactions',
    consumer: 'use-message-reactions.ts',
  },
  {
    id: 'chat-forward',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_forward/execute (message_id, to|conversation_id)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'POST /user-chat/messages/{id}/forward',
    consumer: 'user-chat.service.ts forwardMessage',
  },
  {
    id: 'chat-create-group',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_create_group/execute (member_ids, subject)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'POST /user-chat/conversations',
    consumer: 'people-new-chat-modal.tsx',
  },
  {
    id: 'search-recipients',
    group: 'mailbox',
    lane: 'mailbox',
    endpoint: 'POST /tools/plugin_user_mail_search_recipients/execute (q, limit)',
    status: 'live',
    rbac: 'mail:read, tools:execute',
    storageRoute: 'GET /mail/recipients/search',
    consumer: 'recipient-search-input.tsx (fallback: admin users)',
  },
  {
    id: 'reply',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_reply/execute (message_id, body, content_type)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'POST /user-chat/messages/{message_id}/reply',
    consumer: 'inline-composer.tsx',
  },
  {
    id: 'replies',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_replies/execute (message_id, limit)',
    status: 'live',
    rbac: 'user_chat:read, tools:execute',
    storageRoute: 'GET /user-chat/messages/{message_id}/replies',
    consumer: 'chat-timeline.tsx',
  },
  {
    id: 'update-chat',
    group: 'people',
    lane: 'people',
    endpoint:
      'POST /tools/plugin_user_chat_update/execute (message_id, read, body, starred, pinned)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'PATCH /user-chat/messages/{message_id}',
    consumer: 'chat-timeline.tsx edit',
  },
  {
    id: 'delete-chat',
    group: 'people',
    lane: 'people',
    endpoint:
      'POST /tools/plugin_user_chat_delete/execute (message_id, for_everyone?)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'DELETE /user-chat/messages/{message_id}',
    consumer: 'chat-timeline.tsx context menu',
  },
  {
    id: 'search-chat',
    group: 'people',
    lane: 'people',
    endpoint: 'POST /tools/plugin_user_chat_search/execute (q, page, limit)',
    status: 'live',
    rbac: 'user_chat:read, tools:execute',
    storageRoute: 'GET /user-chat/search',
    consumer: 'user-chat.service.ts',
  },
  {
    id: 'update-conversation',
    group: 'people',
    lane: 'people',
    endpoint:
      'POST /tools/plugin_user_chat_update_conversation/execute (conversation_id, muted, pinned)',
    status: 'live',
    rbac: 'user_chat:write, tools:execute',
    storageRoute: 'PATCH /user-chat/conversations/{conversation_id}',
    consumer: 'people-list.tsx pin/mute',
  },
  {
    id: 'attach-library',
    group: 'attachments',
    lane: 'shared',
    endpoint:
      'POST /tools/plugin_user_mail_attach_library/execute (page, page_size, search)',
    status: 'partial',
    rbac: 'messages:read, storage:read, tools:execute',
    storageRoute: 'GET /messages/attachments/library',
    consumer: 'messages.service.ts (UI uses storageService.listFilesForExplorer workaround)',
  },
  {
    id: 'upload',
    group: 'attachments',
    lane: 'shared',
    endpoint: 'POST /upload?context=mail|user_chat (multipart)',
    status: 'live',
    rbac: 'mail:write | user_chat:write',
    consumer: 'inline-composer.tsx, message-compose-view.tsx',
  },
  {
    id: 'upload-attach-meta',
    group: 'metadata',
    lane: 'shared',
    endpoint: 'POST /tools/plugin_user_mail_upload_attach/execute',
    status: 'live',
    rbac: 'messages:write, tools:execute',
    consumer: 'metadata contract only — FE uses POST /upload directly',
  },
  {
    id: 'ws-info',
    group: 'realtime',
    lane: 'people',
    endpoint: 'GET /user-chat/ws-info',
    status: 'live',
    rbac: 'user_chat:read',
    consumer: 'use-messages-realtime.ts',
    healthKey: 'wsInfo',
  },
  {
    id: 'ws-messenger',
    group: 'realtime',
    lane: 'people',
    endpoint: 'WS /ws/user-chat (subscribe, typing; events: new_message, read_receipt)',
    status: 'live',
    rbac: 'user_chat:read',
    consumer: 'use-messages-realtime.ts',
  },
  {
    id: 'admin-users',
    group: 'admin',
    lane: 'shared',
    endpoint: 'GET /admin/users (search directory — compose recipient picker)',
    status: 'partial',
    rbac: 'admin users scope (not messenger-scoped)',
    consumer: 'people-new-chat-modal.tsx, use-messenger-user-directory.ts',
  },
];

export function resolveLiveApiStatus(
  req: MessagesApiRequirement,
  health: {
    mailList: MessagesApiHealthEndpointStatus;
    chatConversations: MessagesApiHealthEndpointStatus;
    wsInfo: MessagesApiHealthEndpointStatus;
  }
): MessagesApiHealthEndpointStatus | MessagesApiRequirementStatus {
  if (req.status === 'live') return 'live';
  if (!req.healthKey) return req.status;
  const probed = health[req.healthKey];
  if (probed === 'unknown') return req.status;
  return probed;
}

/** Groups requirements by domain for dev panel sections. */
export function groupMessagesApiRequirements(
  requirements: MessagesApiRequirement[] = MESSAGES_API_REQUIREMENTS
): Map<MessagesApiGroup, MessagesApiRequirement[]> {
  const map = new Map<MessagesApiGroup, MessagesApiRequirement[]>();
  for (const req of requirements) {
    const list = map.get(req.group) ?? [];
    list.push(req);
    map.set(req.group, list);
  }
  return map;
}
