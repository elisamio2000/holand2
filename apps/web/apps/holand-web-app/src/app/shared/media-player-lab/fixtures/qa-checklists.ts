import type { ChecklistItem } from '@/platform/lab';

export const AUDIO_GALLERY_CHECKLIST: ChecklistItem[] = [
  { id: 'a1', label: 'All compact variants render without layout break' },
  { id: 'a2', label: 'Waveform loads in full/advanced tab' },
  { id: 'a3', label: 'Sticky bar/dock preview matches production chrome' },
  { id: 'a4', label: 'Play/pause/seek works per variant' },
];

export const VIDEO_GALLERY_CHECKLIST: ChecklistItem[] = [
  { id: 'v1', label: 'ultraCompact preview/inline/mini modes distinct' },
  { id: 'v2', label: 'chatInline controls align with shared video stage' },
  { id: 'v3', label: 'expanded/full/advanced tab switches without crash' },
  { id: 'v4', label: 'PiP opens via global host' },
];

export const STATES_CHECKLIST: ChecklistItem[] = [
  { id: 's1', label: 'Loading shows idle/spinner state' },
  { id: 's2', label: 'Error/unsupported show retry UI' },
  { id: 's3', label: 'Mirror row reflects paused/playing' },
];

export const SCENARIO_CHAT_CHECKLIST: ChecklistItem[] = [
  { id: 'c1', label: 'Inline play works (audio + video)' },
  { id: 'c2', label: 'Expand preserves playback position' },
  { id: 'c3', label: 'Close modal resumes inline' },
  { id: 'c4', label: 'PiP/fullscreen in modal' },
];

export const SCENARIO_EXPLORER_CHECKLIST: ChecklistItem[] = [
  { id: 'e1', label: 'Audio modal opens and plays' },
  { id: 'e2', label: 'Video modal opens and plays' },
];

export const SCENARIO_STICKY_CHECKLIST: ChecklistItem[] = [
  { id: 'st1', label: 'Scroll down shows global sticky bar' },
  { id: 'st2', label: 'Sticky seek/play works' },
  { id: 'st3', label: 'Queue prev/next on sticky' },
];

export const SCENARIO_WATCH_CHECKLIST: ChecklistItem[] = [
  { id: 'w1', label: 'Watch layout player plays' },
  { id: 'w2', label: 'Expand opens global modal' },
];

export const SCENARIO_MESSAGES_CHECKLIST: ChecklistItem[] = [
  { id: 'm1', label: 'Audio ultraCompact inline plays without layout shift' },
  { id: 'm2', label: 'Video ultraCompact inline plays' },
  { id: 'm3', label: 'Expand opens preview modal with MPS handoff' },
];

export const SCENARIO_ARTIFACTS_CHECKLIST: ChecklistItem[] = [
  { id: 'ap1', label: 'Panel audio ultraCompact plays' },
  { id: 'ap2', label: 'Panel video ultraCompact plays' },
  { id: 'ap3', label: 'Expand preserves playback in modal' },
];
