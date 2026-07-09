/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyActiveSubtitleMode,
  syncSubtitleTracks,
} from '@/components/video-player/utils/sync-subtitle-tracks';
import type { VideoSubtitleTrack } from '@/components/video-player/types';

describe('sync-subtitle-tracks', () => {
  let video: HTMLVideoElement;

  beforeEach(() => {
    video = document.createElement('video');
    document.body.appendChild(video);
  });

  it('injects track elements with data-vp-sync', async () => {
    const tracks: VideoSubtitleTrack[] = [
      {
        id: 'en',
        label: 'English',
        language: 'en',
        src: 'data:text/vtt;base64,',
        kind: 'subtitles',
      },
    ];
    await syncSubtitleTracks(video, tracks, 'en');
    const injected = video.querySelectorAll('track[data-vp-sync]');
    expect(injected.length).toBe(1);
    expect(injected[0]?.getAttribute('data-vp-sync')).toBe('en');
  });

  it('applyActiveSubtitleMode sets mode by track id', () => {
    const tracks: VideoSubtitleTrack[] = [
      { id: 'en', label: 'English', language: 'en', src: '', kind: 'subtitles' },
      { id: 'fa', label: 'Farsi', language: 'fa', src: '', kind: 'subtitles' },
    ];
    const mockTracks = [
      { mode: 'hidden' as TextTrackMode },
      { mode: 'hidden' as TextTrackMode },
    ];
    Object.defineProperty(video, 'textTracks', {
      value: mockTracks,
      configurable: true,
    });
    applyActiveSubtitleMode(video, tracks, 'fa');
    expect(mockTracks[0]?.mode).toBe('hidden');
    expect(mockTracks[1]?.mode).toBe('showing');
  });
});
