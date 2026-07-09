import { describe, expect, it } from 'vitest';
import { COMMAND_DEFS, getBindingsLabel } from '../registry';

describe('shortcut registry', () => {
  it('has unique command ids', () => {
    const ids = COMMAND_DEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('formats bindings for tool.select', () => {
    expect(getBindingsLabel('tool.select')).toContain('V');
  });
});
