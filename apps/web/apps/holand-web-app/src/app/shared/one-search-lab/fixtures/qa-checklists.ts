import type { ChecklistItem } from '@/platform/lab';

export const SCENARIO_COMPACT_CHECKLIST: ChecklistItem[] = [
  { id: 'cb1', label: 'Compact bar renders with query and filter affordances' },
  { id: 'cb2', label: 'Scroll pins bar to viewport top (fixed positioning)' },
  { id: 'cb3', label: 'Submit preserves query in URL-synced production flow' },
];

export const SCENARIO_STICKY_CHECKLIST: ChecklistItem[] = [
  { id: 'st1', label: 'Scroll down shows global sticky audio bar' },
  { id: 'st2', label: 'Sticky seek/play works' },
  { id: 'st3', label: 'Queue prev/next on sticky' },
];

export const SCENARIO_WATCH_CHECKLIST: ChecklistItem[] = [
  { id: 'w1', label: 'Watch layout player plays' },
  { id: 'w2', label: 'Expand opens global modal with MPS handoff' },
];
