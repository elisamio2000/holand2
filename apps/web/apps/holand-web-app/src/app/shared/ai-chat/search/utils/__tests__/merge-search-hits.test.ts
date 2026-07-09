import { describe, expect, it } from 'vitest';
import { mergeSearchResults } from '../merge-search-hits';
import type { ChatSearchResult } from '@/app/shared/ai-chat/hooks/use-chat-search';

describe('merge-search-hits', () => {
  const titles = new Map([['s1', 'Session One']]);

  it('dedupes backend and client hits', () => {
    const client: ChatSearchResult[] = [
      {
        type: 'message',
        sessionId: 's1',
        sessionTitle: 'Session One',
        messageId: 'm1',
        snippet: 'hello world',
        matchIndex: 0,
      },
    ];
    const backend = [
      {
        type: 'message' as const,
        session_id: 's1',
        message_id: 'm1',
        snippet: 'hello world',
        score: 1,
      },
    ];
    const merged = mergeSearchResults(client, backend, titles, 'hello', 10);
    expect(merged).toHaveLength(1);
  });

  it('prefers backend ordering then client', () => {
    const client: ChatSearchResult[] = [
      {
        type: 'message',
        sessionId: 's1',
        sessionTitle: 'Session One',
        messageId: 'm2',
        snippet: 'beta',
        matchIndex: 5,
      },
    ];
    const backend = [
      {
        type: 'message' as const,
        session_id: 's1',
        message_id: 'm1',
        snippet: 'alpha',
        score: 1,
      },
    ];
    const merged = mergeSearchResults(client, backend, titles, 'a', 10);
    expect(merged[0].messageId).toBe('m1');
  });
});
