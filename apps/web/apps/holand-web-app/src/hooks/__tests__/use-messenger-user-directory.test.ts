import { describe, expect, it } from 'vitest';
import {
  hydrateUserSummary,
  isUuidLike,
  truncateUuidDisplay,
  userNeedsNameHydration,
} from '@/hooks/use-messenger-user-directory';

describe('use-messenger-user-directory helpers', () => {
  it('recognizes UUID-like strings', () => {
    expect(isUuidLike('ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5')).toBe(true);
    expect(isUuidLike('Admin User')).toBe(false);
  });

  it('flags users that need hydration', () => {
    expect(
      userNeedsNameHydration({
        id: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5',
        name: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5',
      })
    ).toBe(true);
    expect(userNeedsNameHydration({ id: 'u1', name: 'Alex' })).toBe(false);
  });

  it('hydrates from directory map', () => {
    const directory = new Map([
      ['ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5', { id: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5', name: 'مدیر سیستم' }],
    ]);
    const hydrated = hydrateUserSummary(
      {
        id: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5',
        name: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5',
      },
      directory
    );
    expect(hydrated.name).toBe('مدیر سیستم');
  });

  it('falls back to email local-part', () => {
    const hydrated = hydrateUserSummary(
      {
        id: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5',
        name: 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5',
        email: 'admin@example.com',
      },
      new Map()
    );
    expect(hydrated.name).toBe('admin');
  });

  it('truncates unresolved UUID names', () => {
    const id = 'ee2b8cf6-7069-4ca6-a836-0d00cdcff1d5';
    const hydrated = hydrateUserSummary({ id, name: id }, new Map());
    expect(hydrated.name).toBe(truncateUuidDisplay(id));
  });
});
