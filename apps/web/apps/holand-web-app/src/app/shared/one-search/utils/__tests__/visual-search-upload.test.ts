import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  queryImageFromHit,
  uploadImageForVisualSearch,
} from '../visual-search-upload';

vi.mock('@/services/chat.service', () => ({
  chatService: {
    smartUpload: vi.fn(),
  },
}));

import { chatService } from '@/services/chat.service';

describe('uploadImageForVisualSearch', () => {
  beforeEach(() => {
    vi.mocked(chatService.smartUpload).mockReset();
  });

  it('uses chat upload path and maps artifact to query_image', async () => {
    vi.mocked(chatService.smartUpload).mockResolvedValue({
      id: 'uuid-1',
      path: 'minio://uploads/chat/user_x/session_y/artifact.png',
      name: 'photo.png',
      mime_type: 'image/png',
    });

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const result = await uploadImageForVisualSearch(file);

    expect(chatService.smartUpload).toHaveBeenCalledTimes(1);
    const sessionId = vi.mocked(chatService.smartUpload).mock.calls[0][1];
    expect(sessionId).toMatch(/^one-search-visual-/);

    expect(result).toEqual({
      artifact_id: 'uuid-1',
      path: 'minio://uploads/chat/user_x/session_y/artifact.png',
      ephemeral: true,
    });
  });

  it('throws when upload returns no artifact id', async () => {
    vi.mocked(chatService.smartUpload).mockResolvedValue({
      id: undefined,
      path: 'minio://x',
    });
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    await expect(uploadImageForVisualSearch(file)).rejects.toThrow(/artifact id/i);
  });
});

describe('queryImageFromHit', () => {
  it('requires meta.artifact_id (not hit.id)', () => {
    expect(
      queryImageFromHit({ id: 'fm-123', title: 'x.png', meta: {} })
    ).toBeNull();
  });

  it('includes storage_path and crop', () => {
    expect(
      queryImageFromHit(
        {
          id: 'fm-123',
          title: 'x.png',
          meta: {
            artifact_id: 'uuid-2',
            storage_path: 'minio://bucket/x.png',
          },
        },
        { x: 1, y: 2, width: 3, height: 4 }
      )
    ).toEqual({
      artifact_id: 'uuid-2',
      path: 'minio://bucket/x.png',
      crop: { x: 1, y: 2, width: 3, height: 4 },
    });
  });
});
