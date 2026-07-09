import type { ChecklistItem } from '@/platform/lab';

export const SCENARIO_INLINE_CHECKLIST: ChecklistItem[] = [
  { id: 'c1', label: 'Inline play works (audio + video)' },
  { id: 'c2', label: 'Expand preserves playback position' },
  { id: 'c3', label: 'Close modal resumes inline' },
];

export const SCENARIO_DEV_PANEL_CHECKLIST: ChecklistItem[] = [
  { id: 'd1', label: 'Dev requirements panel expands' },
  { id: 'd2', label: 'API requirement rows render with live/mock status' },
  { id: 'd3', label: 'Backend capability gaps table readable' },
];

export const SCENARIO_SEARCH_MODAL_CHECKLIST: ChecklistItem[] = [
  { id: 's1', label: 'Modal opens from lab trigger' },
  { id: 's2', label: 'Tabs switch between sessions/messages/files' },
  { id: 's3', label: 'Escape closes modal' },
];
