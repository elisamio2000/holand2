import { describe, expect, it } from 'vitest';
import { createNavigationEntry } from '../interceptors/navigation-tracker';

describe('navigation-tracker', () => {
  it('creates navigation entries', () => {
    const entry = createNavigationEntry('/messages', '/dashboard', 'push');
    expect(entry.from).toBe('/messages');
    expect(entry.to).toBe('/dashboard');
    expect(entry.type).toBe('push');
    expect(entry.timestamp).toBeGreaterThan(0);
  });
});
