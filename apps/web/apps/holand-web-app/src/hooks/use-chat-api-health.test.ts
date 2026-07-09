/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatApiHealth } from './use-chat-api-health';

const probeApiHealthMock = vi.fn();

vi.mock('@/services/chat.service', () => ({
  chatService: {
    probeApiHealth: (...args: unknown[]) => probeApiHealthMock(...args),
  },
}));

describe('useChatApiHealth', () => {
  beforeEach(() => {
    probeApiHealthMock.mockReset();
  });

  it('starts with unknown status', () => {
    const { result } = renderHook(() => useChatApiHealth());
    expect(result.current.health).toEqual({
      memory: 'unknown',
      tools: 'unknown',
      feedback: 'unknown',
      isProbing: false,
    });
  });

  it('updates health after successful probe', async () => {
    probeApiHealthMock.mockResolvedValue({
      memory: 'available',
      tools: 'unavailable',
      feedback: 'available',
    });

    const { result } = renderHook(() => useChatApiHealth());

    await act(async () => {
      await result.current.probe();
    });

    await waitFor(() => {
      expect(result.current.health.isProbing).toBe(false);
    });

    expect(result.current.health).toEqual({
      memory: 'available',
      tools: 'unavailable',
      feedback: 'available',
      isProbing: false,
    });
  });

  it('marks unknown endpoints unavailable when probe throws', async () => {
    probeApiHealthMock.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useChatApiHealth());

    await act(async () => {
      await result.current.probe();
    });

    await waitFor(() => {
      expect(result.current.health.isProbing).toBe(false);
    });

    expect(result.current.health.memory).toBe('unavailable');
    expect(result.current.health.tools).toBe('unavailable');
    expect(result.current.health.feedback).toBe('unavailable');
  });
});
