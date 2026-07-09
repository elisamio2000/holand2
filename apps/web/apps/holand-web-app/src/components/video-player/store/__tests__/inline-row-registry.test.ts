import { describe, it, expect } from 'vitest';
import { useInlineRowRegistry } from '../inline-row-registry';

describe('inline-row-registry', () => {
  it('allows only one active row at a time', () => {
    useInlineRowRegistry.setState({ activeRowId: null });
    const { claim, isActive } = useInlineRowRegistry.getState();
    claim('row-a');
    expect(useInlineRowRegistry.getState().activeRowId).toBe('row-a');
    expect(isActive('row-a')).toBe(true);
    expect(isActive('row-b')).toBe(false);
    claim('row-b');
    expect(useInlineRowRegistry.getState().activeRowId).toBe('row-b');
  });

  it('releases row when done', () => {
    useInlineRowRegistry.setState({ activeRowId: 'row-a' });
    useInlineRowRegistry.getState().release('row-a');
    expect(useInlineRowRegistry.getState().activeRowId).toBeNull();
  });
});
