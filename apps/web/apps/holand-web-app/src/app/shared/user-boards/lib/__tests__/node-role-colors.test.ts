import { describe, expect, it } from 'vitest';
import { NODE_COLORS, resolveNodeColor, ROLE_DEFAULT_SHAPES } from '../node-role-colors';

describe('resolveNodeColor', () => {
  it('uses role color for non-custom roles', () => {
    expect(resolveNodeColor('evidence')).toBe(NODE_COLORS.evidence);
    expect(resolveNodeColor('person')).toBe(NODE_COLORS.person);
  });

  it('uses board default only for custom role', () => {
    expect(resolveNodeColor('custom', '#ff0000')).toBe('#ff0000');
    expect(resolveNodeColor('custom')).toBe(NODE_COLORS.custom);
  });

  it('ignores board default for evidence role', () => {
    expect(resolveNodeColor('evidence', '#3b82f6')).toBe(NODE_COLORS.evidence);
  });
});

describe('ROLE_DEFAULT_SHAPES', () => {
  it('assigns diamond to evidence', () => {
    expect(ROLE_DEFAULT_SHAPES.evidence).toBe('diamond');
  });
});
