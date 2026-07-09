import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

describe('chatService.probeApiHealth', () => {
  beforeEach(async () => {
    getMock.mockReset();
    postMock.mockReset();
    vi.resetModules();
  });

  it('returns available when routes exist (401/400)', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/tools') {
        return Promise.reject({ response: { status: 401 } });
      }
      if (url.startsWith('/memory/session/')) {
        return Promise.reject({ response: { status: 403 } });
      }
      return Promise.resolve({ data: [] });
    });
    postMock.mockRejectedValue({ response: { status: 422 } });

    const { chatService } = await import('@/services/chat.service');
    const result = await chatService.probeApiHealth();

    expect(result).toEqual({
      memory: 'available',
      tools: 'available',
      feedback: 'available',
    });
  });

  it('returns unavailable on 404 routes', async () => {
    getMock.mockRejectedValue({ response: { status: 404 } });
    postMock.mockRejectedValue({ response: { status: 404 } });

    const { chatService } = await import('@/services/chat.service');
    const result = await chatService.probeApiHealth();

    expect(result).toEqual({
      memory: 'unavailable',
      tools: 'unavailable',
      feedback: 'unavailable',
    });
  });
});
