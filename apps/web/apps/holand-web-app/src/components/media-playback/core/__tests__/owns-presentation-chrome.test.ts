import { describe, expect, it } from 'vitest';
import { ownsPresentationChrome } from '../owns-presentation-chrome';
import { createEmptySession } from '../types';

function session(primary: 'inline' | 'modal') {
  return {
    ...createEmptySession('s1', { kind: 'audio', src: 'x' }),
    presentation: { primary, mirrors: [] },
  };
}

describe('ownsPresentationChrome', () => {
  it('returns true without MPS session', () => {
    expect(ownsPresentationChrome(undefined, undefined, 'full')).toBe(true);
  });

  it('chatInline owns inline presentation only', () => {
    expect(ownsPresentationChrome('s1', session('inline'), 'chatInline')).toBe(true);
    expect(ownsPresentationChrome('s1', session('modal'), 'chatInline')).toBe(false);
  });

  it('full owns modal presentation only', () => {
    expect(ownsPresentationChrome('s1', session('modal'), 'full')).toBe(true);
    expect(ownsPresentationChrome('s1', session('inline'), 'full')).toBe(false);
  });

  it('ultraCompact owns inline presentation', () => {
    expect(ownsPresentationChrome('s1', session('inline'), 'ultraCompact')).toBe(true);
    expect(ownsPresentationChrome('s1', session('modal'), 'ultraCompact')).toBe(false);
  });
});
