import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MessageItem } from '@/types/messages.types';

function sampleItem(id: string, overrides: Partial<MessageItem> = {}): MessageItem {
  return {
    id,
    from: { id: 'u1', name: 'Sender' },
    to: { id: 'u2', name: 'Recipient' },
    subject: 'Hello',
    preview: 'Hi',
    read: false,
    priority: 'normal',
    folder: 'inbox',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

vi.mock('@/services/messages.service', () => ({
  isMessagesUsingMockData: () => true,
  messagesService: {
    list: vi.fn(async () => ({
      data: { items: [sampleItem('m1')], unread_count: 1, total: 1 },
    })),
    getDetailBundle: vi.fn(async (id: string) => [
      { data: { ...sampleItem(id), body: 'body' } },
      { data: { items: [], total: 0, thread_root_id: id } },
    ]),
    update: vi.fn(async () => ({ ok: true })),
    search: vi.fn(async () => ({ data: { items: [], total: 0 } })),
  },
}));

describe('messagesDataStore', () => {
  beforeEach(async () => {
    const { messagesDataStore } = await import('@/stores/messages-data-store');
    await messagesDataStore.fetchList('inbox');
  });

  it('patches list slice after fetch', async () => {
    const { messagesDataStore } = await import('@/stores/messages-data-store');
    messagesDataStore.patchMessage('m1', { read: true });
    const slice = messagesDataStore.getListSlice('inbox|');
    expect(slice.items.find((m) => m.id === 'm1')?.read).toBe(true);
  });

  it('applies realtime new_message without refetch', async () => {
    const { messagesDataStore } = await import('@/stores/messages-data-store');
    const incoming = sampleItem('m2');
    const result = messagesDataStore.applyRealtimeEvent('new_message', { message: incoming });
    expect(result).toBe('handled');
    const slice = messagesDataStore.getListSlice('inbox|');
    expect(slice.items.some((m) => m.id === 'm2')).toBe(true);
  });

  it('reconciles optimistic replies', async () => {
    const { messagesDataStore } = await import('@/stores/messages-data-store');
    const rootId = 'root-1';
    await messagesDataStore.fetchDetail(rootId);
    const clientId = 'client-abc';
    const pending = sampleItem(`pending:${clientId}`, {
      client_message_id: clientId,
      delivery_status: 'sending',
      thread_root_id: rootId,
    });
    messagesDataStore.appendReply(pending, rootId);
    const confirmed = sampleItem('server-1', {
      client_message_id: clientId,
      delivery_status: 'sent',
      thread_root_id: rootId,
    });
    messagesDataStore.reconcileOptimisticReply(clientId, confirmed, rootId);

    const detail = messagesDataStore.getDetailSlice();
    expect(detail.replies.some((r) => r.id === 'server-1')).toBe(true);
    expect(detail.replies.some((r) => r.id === `pending:${clientId}`)).toBe(false);
  });
});
