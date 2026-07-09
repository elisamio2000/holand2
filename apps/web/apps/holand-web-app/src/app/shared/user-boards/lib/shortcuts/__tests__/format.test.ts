import { describe, expect, it } from 'vitest';
import { formatBinding } from '../format';

describe('formatBinding', () => {
  it('renders bracket keys as symbols', () => {
    expect(formatBinding({ code: 'BracketRight', ctrl: true, shift: true })).toBe('Ctrl+Shift+]');
    expect(formatBinding({ code: 'BracketLeft', ctrl: true })).toBe('Ctrl+[');
  });
});
