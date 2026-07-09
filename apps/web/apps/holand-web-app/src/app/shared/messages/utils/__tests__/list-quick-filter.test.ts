import { describe, expect, it } from 'vitest';
import { applyListQuickFilter } from '@/app/shared/messages/utils/list-quick-filter';

describe('list-quick-filter', () => {
  const items = [
    { id: '1', read: false, attachments: [] },
    { id: '2', read: true, attachments: [{ id: 'a' }] },
    { id: '3', read: false, attachments: [] },
  ];

  it('filters unread', () => {
    const out = applyListQuickFilter(items, 'unread');
    expect(out.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('filters starred', () => {
    const out = applyListQuickFilter(items, 'starred', (id) => id === '2');
    expect(out.map((i) => i.id)).toEqual(['2']);
  });

  it('filters attachments', () => {
    const out = applyListQuickFilter(items, 'attachments');
    expect(out.map((i) => i.id)).toEqual(['2']);
  });
});
