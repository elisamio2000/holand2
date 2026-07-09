import { describe, expect, it } from 'vitest';
import {
  getEntityRefsFromMessage,
  isEntityLinkMessage,
  parseEntityPayloadFromBody,
} from '@/app/shared/messages/utils/entity-message';
import { ENTITY_MESSAGE_KIND } from '@/app/shared/messages/integration/message-entity-bus';
import type { MessageItem } from '@/types/messages.types';

describe('entity-message', () => {
  it('detects entity_refs on message items', () => {
    const msg: MessageItem = {
      id: '1',
      from: { id: 'a', name: 'A' },
      to: { id: 'b', name: 'B' },
      subject: 'Task update',
      preview: 'Done',
      read: true,
      priority: 'normal',
      folder: 'inbox',
      created_at: new Date().toISOString(),
      content_type: 'task_notification',
      entity_refs: [{ type: 'task', id: 't-1', label: 'Fix bug' }],
    };
    expect(isEntityLinkMessage(msg)).toBe(true);
    expect(getEntityRefsFromMessage(msg)).toHaveLength(1);
  });

  it('parses embedded JSON payload from body', () => {
    const payload = {
      kind: ENTITY_MESSAGE_KIND,
      schemaVersion: 1,
      module: 'projects',
      entity_refs: [{ type: 'project', id: 'p-1', label: 'Alpha' }],
    };
    const body = `<p>Update</p><script type="application/json" data-entity-message>${JSON.stringify(payload)}</script>`;
    const parsed = parseEntityPayloadFromBody(body);
    expect(parsed?.entity_refs[0]?.id).toBe('p-1');
    expect(isEntityLinkMessage({ ...baseMessage(), preview: body })).toBe(true);
  });
});

function baseMessage(): MessageItem {
  return {
    id: '1',
    from: { id: 'a', name: 'A' },
    to: { id: 'b', name: 'B' },
    subject: 's',
    preview: '',
    read: true,
    priority: 'normal',
    folder: 'inbox',
    created_at: new Date().toISOString(),
  };
}
