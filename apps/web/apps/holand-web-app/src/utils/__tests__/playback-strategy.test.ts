import { describe, expect, it } from 'vitest';
import {
  getPlaybackStrategy,
  VIDEO_BLOB_THRESHOLD_BYTES,
} from '@/utils/playback-strategy';

describe('getPlaybackStrategy', () => {
  it('uses blob-first for audio', () => {
    expect(getPlaybackStrategy('audio/mpeg', 'track.mp3')).toBe('blob-first');
  });

  it('uses presigned-first for large video', () => {
    expect(
      getPlaybackStrategy('video/mp4', 'clip.mp4', VIDEO_BLOB_THRESHOLD_BYTES + 1)
    ).toBe('presigned-first');
  });

  it('uses blob-first for small video', () => {
    expect(getPlaybackStrategy('video/mp4', 'clip.mp4', 1024)).toBe('blob-first');
  });
});
