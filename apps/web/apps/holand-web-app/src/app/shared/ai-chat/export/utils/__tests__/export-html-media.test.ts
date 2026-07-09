import { describe, expect, it } from 'vitest';
import {
  mediaPlayerId,
  renderAudioPlayer,
  renderMediaPreview,
} from '../export-html-media';

describe('export-html-media', () => {
  it('sanitizes player ids', () => {
    expect(mediaPlayerId('file/one.two')).toBe('mp-file_one_two');
  });

  it('renders compact audio player with progress strip and controls', () => {
    const html = renderAudioPlayer('https://example.com/a.mp3', 'clip.mp3', 'inline', 'mp-1');
    expect(html).toContain('export-audio-player compact');
    expect(html).toContain('export-audio-progress-strip');
    expect(html).toContain('export-audio-play');
    expect(html).toContain('export-audio-seek');
    expect(html).toContain('export-audio-vol');
    expect(html).toContain('clip.mp3');
  });

  it('renders expanded modal audio player shell', () => {
    const html = renderAudioPlayer('https://example.com/a.mp3', 'clip.mp3', 'modal', 'mp-2');
    expect(html).toContain('export-audio-player expanded');
    expect(html).toContain('export-audio-icon');
  });

  it('routes audio mime types through renderAudioPlayer', () => {
    const html = renderMediaPreview('audio/mpeg', 'https://x/y.mp3', 'y.mp3', 'inline', 'mp-3');
    expect(html).toContain('export-audio-player compact');
  });
});
