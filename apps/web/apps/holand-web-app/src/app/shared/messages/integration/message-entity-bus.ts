/**
 * Message entity bus â€” standard API for other modules to inject typed messages.
 * Pattern mirrors bug-report-delivery.service â†’ messagesService.send + custom card.
 */

import { messagesService } from '@/services/messages.service';
import { messagesDataStore } from '@/stores/messages-data-store';
import type {
  EntityRef,
  MessageContentType,
  MessageItem,
  MessagePriority,
  SendMessageRequest,
} from '@/types/messages.types';
import { embedEntityPayload } from '../utils/entity-message';

export const ENTITY_MESSAGE_KIND = 'Holand.entity_message' as const;

export interface EntityMessagePayload {
  kind: typeof ENTITY_MESSAGE_KIND;
  schemaVersion: 1;
  entity_refs: EntityRef[];
  summary?: string;
  module: string;
}

export interface SendEntityMessageOptions {
  to: string;
  subject: string;
  bodyHtml: string;
  entityRefs: EntityRef[];
  contentType?: Extract<
    MessageContentType,
    'task_notification' | 'project_update' | 'calendar_invite' | 'text' | 'html'
  >;
  priority?: MessagePriority;
  module: string;
  summary?: string;
}

/** Build send payload with embedded entity JSON (survives backends without entity_refs column). */
export function buildEntityMessageBody(
  bodyHtml: string,
  payload: EntityMessagePayload
): string {
  return embedEntityPayload(bodyHtml, payload);
}

/**
 * Send a cross-module notification into the messenger.
 * Invalidates inbox cache and triggers background refresh.
 */
export async function sendEntityMessage(options: SendEntityMessageOptions) {
  const payload: EntityMessagePayload = {
    kind: ENTITY_MESSAGE_KIND,
    schemaVersion: 1,
    entity_refs: options.entityRefs,
    summary: options.summary,
    module: options.module,
  };

  const sendPayload: SendMessageRequest = {
    to: options.to,
    subject: options.subject,
    body: buildEntityMessageBody(options.bodyHtml, payload),
    content_type: options.contentType ?? 'text',
    priority: options.priority ?? 'normal',
    entity_refs: options.entityRefs,
  };

  const res = await messagesService.send(sendPayload);
  messagesDataStore.invalidateList('inbox');
  void messagesDataStore.fetchList('inbox', '', { background: true });
  return res;
}

/** Optimistic local preview before server round-trip (composer / module hooks). */
export function createOptimisticEntityMessage(
  partial: Pick<MessageItem, 'id' | 'from' | 'to' | 'subject' | 'preview' | 'body'> & {
    entity_refs?: EntityRef[];
    content_type?: MessageContentType;
  }
): MessageItem {
  return {
    id: partial.id,
    from: partial.from,
    to: partial.to,
    subject: partial.subject,
    preview: partial.preview,
    body: partial.body,
    read: true,
    priority: 'normal',
    folder: 'sent',
    created_at: new Date().toISOString(),
    content_type: partial.content_type ?? 'text',
    entity_refs: partial.entity_refs,
    delivery_status: 'sending',
  };
}

