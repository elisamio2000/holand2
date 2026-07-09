import { describe, expect, it } from 'vitest';
import { detectVideoFormat } from '../format-detector';

describe('detectVideoFormat', () => {
  it('detects HLS from .m3u8 extension', () => {
    const result = detectVideoFormat('https://example.com/video.m3u8');
    expect(result.strategy).toBe('hls');
    expect(result.format).toBe('hls');
  });

  it('detects DASH from .mpd extension', () => {
    const result = detectVideoFormat('https://example.com/video.mpd');
    expect(result.strategy).toBe('dash');
    expect(result.format).toBe('dash');
  });

  it('detects native mp4', () => {
    const result = detectVideoFormat('https://example.com/video.mp4', 'video/mp4');
    expect(result.strategy).toBe('native');
    expect(result.extension).toBe('mp4');
  });

  it('detects unsupported mkv', () => {
    const result = detectVideoFormat('https://example.com/video.mkv');
    expect(result.strategy).toBe('unsupported');
    expect(result.extension).toBe('mkv');
  });

  it('falls back to native for unknown video mime', () => {
    const result = detectVideoFormat('https://example.com/video', 'video/x-custom');
    expect(result.strategy).toBe('native');
  });

  it('detects webm', () => {
    const result = detectVideoFormat('https://example.com/video.webm', 'video/webm');
    expect(result.strategy).toBe('native');
    expect(result.extension).toBe('webm');
  });

  it('handles query parameters', () => {
    const result = detectVideoFormat('https://example.com/video.mp4?token=abc');
    expect(result.extension).toBe('mp4');
  });

  it('detects HLS from apple mpegurl mime even without extension', () => {
    const result = detectVideoFormat(
      'https://example.com/stream',
      'application/vnd.apple.mpegurl'
    );
    expect(result.strategy).toBe('hls');
  });

  it('detects DASH from dash+xml mime even without extension', () => {
    const result = detectVideoFormat('https://example.com/stream', 'application/dash+xml');
    expect(result.strategy).toBe('dash');
  });

  it('detects HLS from .m3u8 even with extra query/hash', () => {
    const result = detectVideoFormat('https://cdn.example.com/a/b.m3u8?sig=xyz#t=10');
    expect(result.strategy).toBe('hls');
  });

  it('treats avi / wmv / flv as unsupported', () => {
    for (const ext of ['avi', 'wmv', 'flv']) {
      expect(detectVideoFormat(`https://example.com/v.${ext}`).strategy).toBe('unsupported');
    }
  });

  it('detects quicktime mov as native', () => {
    const result = detectVideoFormat('https://example.com/clip.mov', 'video/quicktime');
    expect(result.strategy).toBe('native');
  });
});
