import { describe, expect, it } from 'vitest';
import {
  MESSAGES_API_GROUP_ORDER,
  MESSAGES_API_REQUIREMENTS,
  groupMessagesApiRequirements,
  resolveLiveApiStatus,
} from '../messages-api-requirements';

describe('MESSAGES_API_REQUIREMENTS', () => {
  it('has unique ids', () => {
    const ids = MESSAGES_API_REQUIREMENTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers mail and chat plugin groups', () => {
    const groups = new Set(MESSAGES_API_REQUIREMENTS.map((r) => r.group));
    for (const g of MESSAGES_API_GROUP_ORDER) {
      expect(groups.has(g)).toBe(true);
    }
    expect(MESSAGES_API_REQUIREMENTS.some((r) => r.endpoint.includes('plugin_user_mail'))).toBe(
      true
    );
    expect(MESSAGES_API_REQUIREMENTS.some((r) => r.endpoint.includes('plugin_user_chat'))).toBe(
      true
    );
  });

  it('includes split mail and chat live tools', () => {
    const liveIds = MESSAGES_API_REQUIREMENTS.filter((r) => r.status === 'live').map(
      (r) => r.id
    );
    expect(liveIds).toContain('list');
    expect(liveIds).toContain('conversations');
    expect(liveIds).toContain('reply');
    expect(liveIds).toContain('resend');
  });

  it('maps storage routes for split domains', () => {
    const list = MESSAGES_API_REQUIREMENTS.find((r) => r.id === 'list');
    expect(list?.storageRoute).toBe('GET /mail');
    const reply = MESSAGES_API_REQUIREMENTS.find((r) => r.id === 'reply');
    expect(reply?.storageRoute).toContain('/user-chat/');
  });

  it('returns live manifest status even when probe reports unavailable', () => {
    const listReq = MESSAGES_API_REQUIREMENTS.find((r) => r.id === 'list')!;
    expect(listReq.status).toBe('live');
    expect(
      resolveLiveApiStatus(listReq, {
        mailList: 'unavailable',
        chatConversations: 'unknown',
        wsInfo: 'unknown',
      })
    ).toBe('live');
  });

  it('merges probe health for partial APIs with healthKey', () => {
    const attachReq = MESSAGES_API_REQUIREMENTS.find((r) => r.id === 'attach-library')!;
    expect(attachReq.status).toBe('partial');
    expect(
      resolveLiveApiStatus(attachReq, {
        mailList: 'available',
        chatConversations: 'available',
        wsInfo: 'unknown',
      })
    ).toBe('partial');
  });

  it('includes newly shipped mail and chat tools', () => {
    const ids = MESSAGES_API_REQUIREMENTS.map((r) => r.id);
    expect(ids).toContain('forward-mail');
    expect(ids).toContain('bulk-update-mail');
    expect(ids).toContain('delete-chat');
    expect(ids).toContain('search-chat');
    expect(ids).toContain('update-conversation');
  });

  it('groups requirements by domain', () => {
    const grouped = groupMessagesApiRequirements();
    expect(grouped.get('core')?.length).toBeGreaterThanOrEqual(4);
    expect(grouped.get('people')?.length).toBeGreaterThanOrEqual(3);
  });
});
