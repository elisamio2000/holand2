import { describe, expect, it } from 'vitest';
import {
  BACKEND_CAPABILITY_GAPS,
  capabilityGapsForDevPanel,
  capabilityGapsForMode,
} from '../backend-capability-gaps';

describe('BACKEND_CAPABILITY_GAPS', () => {
  it('includes P0 visual and semantic gaps', () => {
    const ids = BACKEND_CAPABILITY_GAPS.map((g) => g.id);
    expect(ids).toContain('visual-similarity-binding');
    expect(ids).toContain('semantic-text-binding');
  });

  it('filters gaps by image mode', () => {
    const imageGaps = capabilityGapsForMode('image');
    expect(imageGaps.every((g) => g.modes === 'any' || g.modes.includes('image'))).toBe(true);
    expect(imageGaps.some((g) => g.id === 'visual-similarity-binding')).toBe(true);
  });

  it('includes feRequest and expectedResponse on every gap', () => {
    for (const gap of BACKEND_CAPABILITY_GAPS) {
      expect(gap.feRequest.length).toBeGreaterThan(10);
      expect(gap.expectedResponse.length).toBeGreaterThan(10);
    }
  });

  it('filters gaps by text mode without visual-only items', () => {
    const textGaps = capabilityGapsForMode('text');
    expect(textGaps.some((g) => g.id === 'visual-similarity-binding')).toBe(false);
    expect(textGaps.some((g) => g.id === 'semantic-text-binding')).toBe(true);
  });

  it('marks integration gaps as resolved where BE shipped', () => {
    const resolved = BACKEND_CAPABILITY_GAPS.filter((g) => g.resolved);
    const ids = resolved.map((g) => g.id);
    expect(ids).toContain('exclude-query-artifact');
    expect(ids).toContain('server-sort');
    expect(ids).toContain('pagination');
    expect(ids).toContain('rest-federated');
    expect(ids).toContain('artifact-transcript-get');
  });

  it('maps dev panel gaps with uiSurface for active mode', () => {
    const audioGaps = capabilityGapsForDevPanel('audio');
    expect(audioGaps.length).toBeGreaterThan(0);
    expect(audioGaps.every((g) => g.uiSurface)).toBe(true);
    expect(audioGaps.some((g) => g.id === 'audio-waveform-peaks')).toBe(true);
  });
});
