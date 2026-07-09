import { createId } from '@paralleldrive/cuid2';
import type { BoardSnapshot, BoardNodeObject, BoardStickyObject } from '../lib/board-types';

const ROLE_COLORS: Record<BoardNodeObject['nodeRole'], string> = {
  person: '#3b82f6',
  organization: '#8b5cf6',
  evidence: '#f59e0b',
  topic: '#22c55e',
  question: '#ef4444',
  custom: '#64748b',
};

export function applyEvidenceWallTemplate(): BoardSnapshot {
  const nodes: BoardNodeObject[] = [
    { id: createId(), type: 'node', x: -200, y: -80, width: 140, height: 56, label: 'Suspect', nodeRole: 'person', color: ROLE_COLORS.person },
    { id: createId(), type: 'node', x: 120, y: -80, width: 140, height: 56, label: 'Witness', nodeRole: 'person', color: ROLE_COLORS.person },
    { id: createId(), type: 'node', x: -40, y: 120, width: 160, height: 56, label: 'Evidence A', nodeRole: 'evidence', color: ROLE_COLORS.evidence },
  ];

  const stickies: BoardStickyObject[] = [
    {
      id: createId(),
      type: 'sticky',
      x: -320,
      y: 200,
      width: 200,
      height: 120,
      text: 'Open questions',
      color: '#fef08a',
    },
  ];

  return {
    version: 1,
    viewBox: { x: -500, y: -300, width: 1200, height: 800 },
    objects: [...nodes, ...stickies],
    inkStrokes: [],
    comments: [],
    reportTitle: 'Evidence wall',
    reportContent: '',
    legalHold: false,
  };
}
