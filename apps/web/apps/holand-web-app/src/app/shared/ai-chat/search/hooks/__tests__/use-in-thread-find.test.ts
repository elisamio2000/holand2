import { describe, expect, it } from 'vitest';
import { findInThreadMatches } from '../../hooks/use-in-thread-find';
import type { UIMessage } from '@/types/chat.types';

describe('use-in-thread-find', () => {
  const messages = [
    { id: '1', role: 'user', content: 'Hello there' },
    { id: '2', role: 'assistant', content: 'General Kenobi' },
  ] as UIMessage[];

  it('findInThreadMatches returns case-insensitive hits', () => {
    const hits = findInThreadMatches(messages, 'kenobi');
    expect(hits).toHaveLength(1);
    expect(hits[0].messageId).toBe('2');
  });

  it('returns empty for blank query', () => {
    expect(findInThreadMatches(messages, '   ')).toEqual([]);
  });
});
