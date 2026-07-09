import { describe, expect, it } from 'vitest';
import { appendVisualParams } from '../use-search-url-state';

describe('appendVisualParams', () => {
  it('adds visualArtifact and crop to search params', () => {
    const p = new URLSearchParams();
    appendVisualParams(p, {
      artifact_id: 'art-1',
      crop: { x: 1.4, y: 2.6, width: 10.2, height: 20.8 },
    });
    expect(p.get('visualArtifact')).toBe('art-1');
    expect(p.get('crop')).toBe('1,3,10,21');
  });

  it('adds visualArtifact without crop when crop is missing', () => {
    const p = new URLSearchParams();
    appendVisualParams(p, { artifact_id: 'art-2' });
    expect(p.get('visualArtifact')).toBe('art-2');
    expect(p.has('crop')).toBe(false);
  });

  it('does nothing when visual is null or missing artifact_id', () => {
    const p = new URLSearchParams({ q: 'test' });
    appendVisualParams(p, null);
    expect(p.toString()).toBe('q=test');
    appendVisualParams(p, { artifact_id: '' });
    expect(p.toString()).toBe('q=test');
  });
});
