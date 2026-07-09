import { describe, expect, it, vi, beforeEach } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

describe('chatService share methods', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    deleteMock.mockReset();
    vi.resetModules();
  });

  it('shareSession sends expires_hours=0 and body for never expires', async () => {
    postMock.mockResolvedValue({
      data: {
        share_url: 'https://app/ai-chat/shared/tok',
        share_id: 'tok',
        expires_at: null,
      },
    });

    const { chatService } = await import('@/services/chat.service');
    const result = await chatService.shareSession('sess-1', 0);

    expect(postMock).toHaveBeenCalledWith(
      '/storage/chat/sessions/sess-1/share',
      { expires_at: null },
      { params: { expires_hours: 0 } }
    );
    expect(result.expires_at).toBeNull();
  });

  it('listSessionShares returns empty array on 404', async () => {
    getMock.mockRejectedValue({ response: { status: 404 } });

    const { chatService } = await import('@/services/chat.service');
    const list = await chatService.listSessionShares('sess-1');

    expect(list).toEqual([]);
  });

  it('listSharedWithMe returns empty array on 404', async () => {
    getMock.mockRejectedValue({ response: { status: 404 } });

    const { chatService } = await import('@/services/chat.service');
    const list = await chatService.listSharedWithMe();

    expect(list).toEqual([]);
  });
});
