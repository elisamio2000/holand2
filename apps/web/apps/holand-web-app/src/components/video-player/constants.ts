export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const NATIVE_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/3gpp2',
]);

export const UNSUPPORTED_BROWSER_EXTENSIONS = new Set([
  'mkv',
  'avi',
  'wmv',
  'flv',
  'rm',
  'rmvb',
  'asf',
  'vob',
  'ts',
  'm2ts',
]);

export const HLS_EXTENSIONS = new Set(['m3u8']);
export const DASH_EXTENSIONS = new Set(['mpd']);

export const BOOKMARKS_STORAGE_PREFIX = 'video-bookmarks:';

export const DEFAULT_VIDEO_SETTINGS = {
  volume: 0.8,
  playbackRate: 1,
  isMuted: false,
  loop: false,
  quality: undefined as string | undefined,
  activeSubtitleId: null as string | null,
};
