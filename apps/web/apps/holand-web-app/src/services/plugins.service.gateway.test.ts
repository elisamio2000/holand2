import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GatewayToolError } from '@/utils/gateway-tool-success';

const postMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}));

vi.mock('@/utils/tool-id', () => ({
  toolExecutePath: (id: string) => `/tools/${id}/execute`,
  toolInfoPath: (id: string) => `/tools/${id}`,
  toApiToolId: (id: string) => id,
}));

describe('pluginsService masked gateway errors', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('runTool throws GatewayToolError when body has error with HTTP 200', async () => {
    postMock.mockResolvedValue({
      data: {
        error: 'HTTP_ERROR',
        status_code: 401,
        message: 'tool-runner unauthorized',
      },
    });

    const { pluginsService } = await import('./plugins.service');

    await expect(
      pluginsService.runTool('plugin.example_ping', { ping: true })
    ).rejects.toBeInstanceOf(GatewayToolError);
  });
});
