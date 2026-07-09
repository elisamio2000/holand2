// ============================================
// User Messenger — normalize raw API payloads
// ============================================

import type {
  AttachmentInfo,
  MessageFolder,
  MessageItem,
  MessagePriority,
  PeopleConversation,
  UserSummary,
} from '@/types/messages.types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function normalizeUserSummary(raw: unknown, fallbackId = 'unknown'): UserSummary {
  if (typeof raw === 'string') {
    return { id: raw, name: raw };
  }
  if (isRecord(raw)) {
    const id = String(raw.id ?? raw.user_id ?? fallbackId);
    const name = String(
      raw.name ?? raw.display_name ?? raw.username ?? raw.email ?? id
    );
    const avatar =
      typeof raw.avatar === 'string'
        ? raw.avatar
        : typeof raw.avatar_url === 'string'
          ? raw.avatar_url
          : undefined;
    return {
      id,
      name,
      email: typeof raw.email === 'string' ? raw.email : undefined,
      avatar,
    };
  }
  return { id: fallbackId, name: fallbackId };
}

function normalizeAttachment(raw: unknown): AttachmentInfo | null {
  if (!isRecord(raw)) return null;
  const id = String(raw.id ?? raw.artifact_id ?? '');
  if (!id) return null;
  return {
    id,
    name: String(raw.name ?? raw.filename ?? 'attachment'),
    size: Number(raw.size ?? raw.file_size ?? 0),
    mime_type: String(raw.mime_type ?? raw.type ?? 'application/octet-stream'),
    url: typeof raw.url === 'string' ? raw.url : undefined,
  };
}

export function normalizeMessageItem(raw: unknown, folder: MessageFolder = 'inbox'): MessageItem {
  if (!isRecord(raw)) {
    return {
      id: crypto.randomUUID(),
      from: { id: 'unknown', name: 'Unknown' },
      to: { id: 'unknown', name: 'Unknown' },
      subject: '',
      preview: '',
      read: true,
      priority: 'normal',
      folder,
      created_at: new Date().toISOString(),
    };
  }

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map(normalizeAttachment).filter(Boolean) as AttachmentInfo[]
    : undefined;

  return {
    id: String(raw.id ?? raw.message_id ?? ''),
    from: normalizeUserSummary(raw.from, 'sender'),
    to: normalizeUserSummary(raw.to, 'recipient'),
    subject: String(raw.subject ?? ''),
    preview: String(raw.preview ?? raw.body_preview ?? ''),
    body: typeof raw.body === 'string' ? raw.body : undefined,
    read: Boolean(raw.read ?? raw.is_read ?? true),
    priority: (['low', 'normal', 'high'].includes(String(raw.priority))
      ? raw.priority
      : 'normal') as MessagePriority,
    folder: (['inbox', 'sent', 'drafts', 'archived', 'trash'].includes(String(raw.folder))
      ? raw.folder
      : folder) as MessageFolder,
    attachments: attachments?.length ? attachments : undefined,
    content_type: (['text', 'html', 'bug_report', 'image', 'video', 'audio', 'voice', 'file', 'location', 'call_log', 'live_invite'].includes(
      String(raw.content_type)
    )
      ? raw.content_type
      : undefined) as MessageItem['content_type'],
    reply_count: typeof raw.reply_count === 'number' ? raw.reply_count : undefined,
    thread_root_id: typeof raw.thread_root_id === 'string' ? raw.thread_root_id : undefined,
    created_at: String(raw.created_at ?? new Date().toISOString()),
  };
}

export function unwrapMessengerData<T>(result: unknown): MessengerToolResultShape<T> {
  if (!isRecord(result)) {
    return { ok: false, data: undefined };
  }

  // Direct { ok, data } from OpenAPI
  if ('ok' in result && 'data' in result) {
    return {
      ok: Boolean(result.ok),
      data: result.data as T,
      channels: isRecord(result.channels) ? result.channels : undefined,
      error: typeof result.error === 'string' ? result.error : undefined,
    };
  }

  // PluginRunResult { data: { ok, items... } } or nested result
  const nested = result.result ?? result.data;
  if (isRecord(nested)) {
    if ('ok' in nested) {
      return {
        ok: Boolean(nested.ok),
        data: nested.data as T,
        channels: isRecord(nested.channels) ? nested.channels : undefined,
        error: typeof nested.error === 'string' ? nested.error : undefined,
      };
    }
    return { ok: true, data: nested as T };
  }

  return { ok: true, data: result as T };
}

interface MessengerToolResultShape<T> {
  ok: boolean;
  data?: T;
  channels?: Record<string, unknown>;
  error?: string;
}

/** Mailbox list row: show recipient for sent/drafts, sender otherwise */
export function mailboxListPartner(
  message: MessageItem,
  folder: MessageFolder
): UserSummary {
  return folder === 'sent' || folder === 'drafts' ? message.to : message.from;
}

/** Group inbox items by conversation partner for People view */
export function groupByPeople(
  items: MessageItem[],
  currentUserId: string,
  folder: MessageFolder,
  pinnedIds?: Set<string>
): PeopleConversation[] {
  const map = new Map<string, PeopleConversation>();

  for (const msg of items) {
    const partner =
      folder === 'sent'
        ? msg.to
        : msg.from.id === currentUserId
          ? msg.to
          : msg.from;

    const key = partner.id;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        partner,
        lastMessage: msg,
        unreadCount: msg.read ? 0 : 1,
        messageIds: [msg.id],
        threadRootId: msg.id,
      });
    } else {
      existing.messageIds.push(msg.id);
      if (!msg.read) existing.unreadCount += 1;
      const existingTime = new Date(existing.lastMessage.created_at).getTime();
      const msgTime = new Date(msg.created_at).getTime();
      if (msgTime > existingTime) {
        existing.lastMessage = msg;
      }
      const rootTime = new Date(existing.lastMessage.created_at).getTime();
      if (msgTime < rootTime) {
        existing.threadRootId = msg.id;
      }
    }
  }

  const conversations = Array.from(map.values());
  
  if (pinnedIds && pinnedIds.size > 0) {
    const pinned = conversations.filter((c) => pinnedIds.has(c.partner.id));
    const unpinned = conversations.filter((c) => !pinnedIds.has(c.partner.id));
    
    pinned.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() -
      new Date(a.lastMessage.created_at).getTime()
    );
    unpinned.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() -
      new Date(a.lastMessage.created_at).getTime()
    );
    
    return [...pinned, ...unpinned];
  }

  return conversations.sort(
    (a, b) =>
      new Date(b.lastMessage.created_at).getTime() -
      new Date(a.lastMessage.created_at).getTime()
  );
}
