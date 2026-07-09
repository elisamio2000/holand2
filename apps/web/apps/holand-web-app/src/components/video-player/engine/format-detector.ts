import {
  DASH_EXTENSIONS,
  HLS_EXTENSIONS,
  NATIVE_VIDEO_MIMES,
  UNSUPPORTED_BROWSER_EXTENSIONS,
} from '../constants';
import type { PlaybackStrategy } from '../types';

export interface FormatDetection {
  strategy: PlaybackStrategy;
  format: string;
  extension: string;
}

function getExtension(src: string, mimeType?: string): string {
  if (mimeType) {
    const sub = mimeType.split('/')[1];
    if (sub && sub !== 'octet-stream') return sub.replace('x-', '').split(';')[0];
  }
  try {
    const path = src.split('?')[0].split('#')[0];
    const parts = path.split('.');
    if (parts.length > 1) return parts.pop()!.toLowerCase();
  } catch {
    /* ignore */
  }
  return '';
}

const HLS_MIMES = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl',
  'vnd.apple.mpegurl',
]);

const DASH_MIMES = new Set(['application/dash+xml', 'dash+xml']);

export function detectVideoFormat(
  src: string,
  mimeType?: string
): FormatDetection {
  const extension = getExtension(src, mimeType);
  const format = extension || mimeType?.split('/')[1] || 'unknown';
  const normalizedMime = mimeType?.toLowerCase().split(';')[0].trim();

  if (
    HLS_EXTENSIONS.has(extension) ||
    src.includes('.m3u8') ||
    (normalizedMime ? HLS_MIMES.has(normalizedMime) : false)
  ) {
    return { strategy: 'hls', format: 'hls', extension: extension || 'm3u8' };
  }

  if (
    DASH_EXTENSIONS.has(extension) ||
    src.includes('.mpd') ||
    (normalizedMime ? DASH_MIMES.has(normalizedMime) : false)
  ) {
    return { strategy: 'dash', format: 'dash', extension: extension || 'mpd' };
  }

  if (UNSUPPORTED_BROWSER_EXTENSIONS.has(extension)) {
    return { strategy: 'unsupported', format, extension };
  }

  if (mimeType && NATIVE_VIDEO_MIMES.has(mimeType)) {
    return { strategy: 'native', format, extension };
  }

  const nativeExts = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', '3gp', '3g2']);
  if (nativeExts.has(extension)) {
    return { strategy: 'native', format, extension };
  }

  if (mimeType?.startsWith('video/')) {
    return { strategy: 'native', format, extension };
  }

  if (extension) {
    return { strategy: 'unsupported', format, extension };
  }

  return { strategy: 'native', format: 'unknown', extension: '' };
}
