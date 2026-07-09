import type { VideoChapter, VideoSubtitleTrack } from '@/components/video-player';

export const MOCK_CHAPTERS: VideoChapter[] = [
  { id: 'ch-1', title: 'Introduction', start: 0, end: 10 },
  { id: 'ch-2', title: 'Main topic', start: 10, end: 22 },
  { id: 'ch-3', title: 'Conclusion', start: 22, end: 30 },
];

export const MOCK_SUBTITLES: VideoSubtitleTrack[] = [
  { id: 'sub-en', label: 'English', language: 'en', default: true },
  { id: 'sub-fa', label: 'Persian', language: 'fa' },
];

export const MOCK_BOOKMARKS = [5, 15, 25];

export const MOCK_QUEUE_TITLES = [
  'Queue track 1 — female_02',
  'Queue track 2 — sample',
  'Queue track 3 — sample',
];
