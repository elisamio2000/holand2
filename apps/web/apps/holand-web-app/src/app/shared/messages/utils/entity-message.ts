import type { EntityRef, MessageDetail, MessageItem } from '@/types/messages.types';
import {
  ENTITY_MESSAGE_KIND,
  type EntityMessagePayload,
} from '../integration/message-entity-bus';

const EMBED_RE =
  /<script[^>]*type=["']application\/json["'][^>]*data-entity-message[^>]*>([\s\S]*?)<\/script>/i;

const ENTITY_CONTENT_TYPES = new Set([
  'task_notification',
  'project_update',
  'calendar_invite',
]);

export function parseEntityPayloadFromBody(body: string): EntityMessagePayload | null {
  const match = body.match(EMBED_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as EntityMessagePayload;
    if (parsed?.kind === ENTITY_MESSAGE_KIND) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function embedEntityPayload(body: string, payload: EntityMessagePayload): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `${body}\n<script type="application/json" data-entity-message>${json}</script>`;
}

export function getEntityRefsFromMessage(
  message: MessageItem | MessageDetail
): EntityRef[] {
  if (message.entity_refs?.length) return message.entity_refs;
  const body = ('body' in message && message.body) || message.preview || '';
  const embedded = parseEntityPayloadFromBody(body);
  return embedded?.entity_refs ?? [];
}

export function isEntityLinkMessage(message: MessageItem | MessageDetail): boolean {
  if (message.content_type && ENTITY_CONTENT_TYPES.has(message.content_type)) return true;
  const body = ('body' in message && message.body) || message.preview || '';
  if (EMBED_RE.test(body)) return true;
  return getEntityRefsFromMessage(message).length > 0;
}

export function entityModuleLabel(type: EntityRef['type']): string {
  switch (type) {
    case 'project':
      return 'Project';
    case 'task':
      return 'Task';
    case 'calendar_event':
      return 'Calendar';
    case 'case':
      return 'Case';
    case 'file':
      return 'File';
    case 'graph_node':
      return 'Graph';
    case 'message':
      return 'Message';
    default:
      return 'Link';
  }
}
