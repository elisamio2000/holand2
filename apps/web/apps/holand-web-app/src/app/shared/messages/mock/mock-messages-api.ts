// ============================================
// User Messenger — in-memory mock API
// ============================================

import type {
  AttachLibraryData,
  MessageDetail,
  MessageFolder,
  MessageItem,
  MessagePriority,
  MessagesListData,
  RepliesData,
  SearchData,
  SendMessageData,
} from '@/types/messages.types';
import { createMockMessageStore } from './mock-messages-data';

const store = createMockMessageStore();

let mockActive = false;

export function setMockMessagesActive(active: boolean): void {
  mockActive = active;
}

export function isMockMessagesActive(): boolean {
  return mockActive;
}

function listByFolder(folder: MessageFolder): MessageItem[] {
  return Array.from(store.messages.values())
    .filter((m) => m.folder === folder)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function unreadInFolder(folder: MessageFolder): number {
  return listByFolder(folder).filter((m) => !m.read).length;
}

function filterQuery(items: MessageItem[], q: string): MessageItem[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(
    (m) =>
      m.subject.toLowerCase().includes(needle) ||
      m.preview.toLowerCase().includes(needle) ||
      m.from.name.toLowerCase().includes(needle) ||
      m.to.name.toLowerCase().includes(needle)
  );
}

export const mockMessagesApi = {
  list(folder: MessageFolder, page = 1, limit = 30, q?: string): MessagesListData {
    let items = listByFolder(folder);
    if (q?.trim()) items = filterQuery(items, q);
    const start = (page - 1) * limit;
    const slice = items.slice(start, start + limit);
    return {
      items: slice,
      unread_count: unreadInFolder('inbox'),
      total: items.length,
      page,
      limit,
    };
  },

  search(q: string, folder?: MessageFolder, page = 1, limit = 30): SearchData {
    const pool = folder
      ? listByFolder(folder)
      : Array.from(store.messages.values());
    const items = filterQuery(pool, q);
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
      query: q,
      folder: folder ?? null,
    };
  },

  get(messageId: string): MessageDetail | null {
    return store.messages.get(messageId) ?? null;
  },

  replies(messageId: string, limit = 50): RepliesData {
    const root = store.messages.get(messageId);
    const items = (store.replies.get(messageId) ?? []).slice(0, limit);
    return {
      thread_root_id: root?.thread_root_id ?? messageId,
      items,
      total: items.length,
    };
  },

  send(request: {
    to: string;
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body: string;
    priority?: MessagePriority;
    draft?: boolean;
    content_type?: MessageItem['content_type'];
  }): SendMessageData {
    const id = `msg-mock-${Date.now()}`;
    const folder: MessageFolder = request.draft ? 'drafts' : 'sent';
    const item: MessageDetail = {
      id,
      from: { id: 'user-self', name: 'You' },
      to: { id: request.to, name: request.to },
      subject: request.subject ?? '',
      preview: request.body.replace(/<[^>]+>/g, '').slice(0, 120),
      body: request.body,
      read: true,
      priority: request.priority ?? 'normal',
      folder,
      created_at: new Date().toISOString(),
    };
    store.messages.set(id, item);
    return { id, created_at: item.created_at };
  },

  reply(
    messageId: string,
    body: string,
    opts?: {
      content_type?: MessageItem['content_type'];
      voice_duration_ms?: number;
      attachments?: MessageItem['attachments'];
    }
  ): { id: string; created_at: string } {
    const root = store.messages.get(messageId);
    const id = `reply-mock-${Date.now()}`;
    const item: MessageItem = {
      id,
      from: { id: 'user-self', name: 'You' },
      to: root?.from ?? { id: 'unknown', name: 'Unknown' },
      subject: root ? `Re: ${root.subject}` : 'Re:',
      preview: body.replace(/<[^>]+>/g, '').slice(0, 120),
      body,
      read: true,
      priority: 'normal',
      folder: 'sent',
      created_at: new Date().toISOString(),
      thread_root_id: root?.thread_root_id ?? messageId,
      content_type: opts?.content_type,
      voice_duration_ms: opts?.voice_duration_ms,
      attachments: opts?.attachments,
      delivery_status: 'sent',
    };
    const existing = store.replies.get(messageId) ?? [];
    store.replies.set(messageId, [...existing, item]);
    if (root) {
      store.messages.set(messageId, {
        ...root,
        reply_count: (root.reply_count ?? 0) + 1,
      });
    }
    return { id, created_at: item.created_at };
  },

  update(
    messageId: string,
    updates: {
      read?: boolean;
      folder?: MessageFolder;
      body?: string;
      starred?: boolean;
      pinned?: boolean;
    }
  ): boolean {
    const msg = store.messages.get(messageId);
    if (msg) {
      const next: MessageDetail = {
        ...msg,
        ...updates,
        preview: updates.body
          ? updates.body.replace(/<[^>]+>/g, '').slice(0, 120)
          : msg.preview,
        edited_at: updates.body ? new Date().toISOString() : msg.edited_at,
      };
      store.messages.set(messageId, next);
      return true;
    }
    for (const [rootId, items] of store.replies.entries()) {
      const idx = items.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        const updated = [...items];
        updated[idx] = {
          ...updated[idx],
          ...updates,
          body: updates.body ?? updated[idx].body,
          preview: updates.body
            ? updates.body.replace(/<[^>]+>/g, '').slice(0, 120)
            : updated[idx].preview,
          edited_at: updates.body ? new Date().toISOString() : updated[idx].edited_at,
        };
        store.replies.set(rootId, updated);
        return true;
      }
    }
    return false;
  },

  resend(messageId: string): { id: string; created_at: string } | null {
    let source: MessageItem | undefined = store.messages.get(messageId);
    if (!source) {
      for (const items of store.replies.values()) {
        source = items.find((m) => m.id === messageId);
        if (source) break;
      }
    }
    if (!source) return null;
    if (!source.thread_root_id && !store.messages.has(messageId)) return null;
    const rootId = source.thread_root_id ?? messageId;
    return mockMessagesApi.reply(rootId, source.body ?? source.preview);
  },

  delete(messageId: string): boolean {
    const msg = store.messages.get(messageId);
    if (!msg) return false;
    store.messages.set(messageId, { ...msg, folder: 'trash' });
    return true;
  },

  attachFromLibrary(artifactId: string): AttachLibraryData {
    return {
      artifact_id: artifactId,
      name: `library-${artifactId}`,
      mime_type: 'application/octet-stream',
      size: 1024,
    };
  },
};

/** Task-assigned inbox notification for Projects ↔ Messages mock bridge (phase 19). */
export function pushTaskAssignedInboxNotification(opts: {
  taskId: string;
  taskTitle: string;
  projectName?: string;
  assigneeId: string;
}): void {
  const id = `msg-mock-task-${Date.now()}`;
  const subject = `Task assigned: ${opts.taskTitle}`;
  const body = `You were assigned "${opts.taskTitle}"${
    opts.projectName ? ` in project ${opts.projectName}` : ''
  }. (mock bridge — task ${opts.taskId})`;
  const item: MessageDetail = {
    id,
    from: { id: 'system-projects', name: 'Projects' },
    to: { id: opts.assigneeId, name: opts.assigneeId },
    subject,
    preview: body.slice(0, 120),
    body,
    read: false,
    priority: 'normal',
    folder: 'inbox',
    created_at: new Date().toISOString(),
  };
  store.messages.set(id, item);
}
