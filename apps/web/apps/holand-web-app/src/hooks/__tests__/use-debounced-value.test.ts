// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { renderHook, act } from '@testing-library/react';

describe('useDebouncedValue', () => {
  it('updates after delay', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 400 } }
    );

    expect(result.current).toBe('a');
    rerender({ value: 'b', delay: 400 });
    expect(result.current).toBe('a');

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe('b');
    vi.useRealTimers();
  });
});
