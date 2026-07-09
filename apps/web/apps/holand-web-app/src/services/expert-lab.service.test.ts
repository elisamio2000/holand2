/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock('./holand-api-client', () => ({
  holandApiClient: {
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { expertLabService } from './expert-lab.service';

describe('expertLabService', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it('creates draft via /expert-lab/drafts', async () => {
    postMock.mockResolvedValue({
      data: { id: 'd1', kind: 'question', title: 'Q', versions: [] },
    });

    const result = await expertLabService.createDraft({
      kind: 'question',
      title: 'Q',
      body: 'B',
      author: 'a@x.dev',
    });

    expect(postMock).toHaveBeenCalledWith('/expert-lab/drafts', {
      kind: 'question',
      title: 'Q',
      body: 'B',
      author: 'a@x.dev',
    });
    expect(result.id).toBe('d1');
  });

  it('lists drafts with optional status filter', async () => {
    getMock.mockResolvedValue({ data: [] });

    await expertLabService.listDrafts('in_review');

    expect(getMock).toHaveBeenCalledWith('/expert-lab/drafts', {
      params: { status: 'in_review' },
    });
  });

  it('submits and publishes using workflow routes', async () => {
    postMock.mockResolvedValue({ data: { id: 'v1', status: 'approved' } });

    await expertLabService.submitForReview('d1');
    await expertLabService.publish('d1');

    expect(postMock).toHaveBeenNthCalledWith(1, '/expert-lab/drafts/d1/submit');
    expect(postMock).toHaveBeenNthCalledWith(2, '/expert-lab/drafts/d1/publish');
  });
});
