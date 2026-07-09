import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveStoragePlaybackUrl } from '@/utils/resolve-storage-playback-url';
import { chatService } from '@/services/chat.service';
import { storageService } from '@/services/storage.service';

vi.mock('@/services/chat.service', () => ({
  chatService: { getPresignedUrl: vi.fn() },
}));

vi.mock('@/services/storage.service', () => ({
  storageService: { fetchArtifactBlob: vi.fn() },
}));

describe('resolveStoragePlaybackUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:audio-test'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('prefers blob URL when strategy is blob-first', async () => {
    vi.mocked(storageService.fetchArtifactBlob).mockResolvedValue(new Blob(['wav']));
    vi.mocked(chatService.getPresignedUrl).mockResolvedValue({
      url: 'http://minio/bucket/file.wav',
      expires_in: 3600,
      method: 'GET',
    });

    const result = await resolveStoragePlaybackUrl('art-1', 'blob-first');

    expect(result.url).toBe('blob:audio-test');
    expect(result.revokeOnCleanup).toBe(true);
    expect(storageService.fetchArtifactBlob).toHaveBeenCalledWith('art-1', 'inline');
    expect(chatService.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('falls back to presigned when blob fetch fails', async () => {
    vi.mocked(storageService.fetchArtifactBlob).mockRejectedValue(new Error('401'));
    vi.mocked(chatService.getPresignedUrl).mockResolvedValue({
      url: 'http://minio/bucket/file.wav',
      expires_in: 3600,
      method: 'GET',
    });

    const result = await resolveStoragePlaybackUrl('art-1', 'blob-first');

    expect(result.url).toBe('http://minio/bucket/file.wav');
    expect(result.revokeOnCleanup).toBe(false);
  });

  it('prefers presigned when strategy is presigned-first', async () => {
    vi.mocked(chatService.getPresignedUrl).mockResolvedValue({
      url: 'http://minio/bucket/video.mp4',
      expires_in: 3600,
      method: 'GET',
    });
    vi.mocked(storageService.fetchArtifactBlob).mockResolvedValue(new Blob(['mp4']));

    const result = await resolveStoragePlaybackUrl('art-2', 'presigned-first');

    expect(result.url).toBe('http://minio/bucket/video.mp4');
    expect(storageService.fetchArtifactBlob).not.toHaveBeenCalled();
  });
});
