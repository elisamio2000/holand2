// ============================================
// user_mail.search → OneSearchHit
// ============================================

import type { MessageItem } from '@/types/messages.types';
import type { OneSearchHit } from '@/types/one-search.types';
import { buildMessagesChatHref } from '../utils/normalize-search-hits';

export const MS_TOOL = 'plugin.user_mail.search';
export const MS_ENDPOINT = '/tools/plugin_user_mail_search/execute';

function partnerIdFromMessage(msg: MessageItem, currentUserId?: string): string | undefined {
  const fromId = msg.from?.id;
  const toId = msg.to?.id;
  if (currentUserId && fromId === currentUserId && toId) return toId;
  if (currentUserId && toId === currentUserId && fromId) return fromId;
  if (fromId) return fromId;
  return toId;
}

export function mapMessengerToHits(
  items: MessageItem[],
  query: string,
  args: Record<string, unknown>,
  currentUserId?: string
): OneSearchHit[] {
  return items.map((msg) => {
    const partnerId = partnerIdFromMessage(msg, currentUserId);
    const meta: Record<string, unknown> = {
      message_id: msg.id,
      folder: msg.folder,
      from: partnerId ?? msg.from?.id,
      partner_id: partnerId,
      source: MS_TOOL,
      sourceEndpoint: MS_ENDPOINT,
      sourceArgs: args,
      lane: 'chat',
    };

    return {
      id: `msg-${msg.id}`,
      title: msg.subject || msg.preview?.slice(0, 80) || msg.id,
      snippet: msg.preview || msg.body?.slice(0, 160) || '',
      href: buildMessagesChatHref(meta, query),
      occurredAt: msg.created_at,
      score: msg.pinned ? 0.9 : undefined,
      meta,
    };
  });
}
