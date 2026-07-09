import { describe, expect, it } from 'vitest';
import { pickSrcTracker, shouldSkipWaveSurferReinit } from '../src-ref-guard';

describe('shouldSkipWaveSurferReinit', () => {
  it('skips when src unchanged and instance exists', () => {
    expect(shouldSkipWaveSurferReinit('blob:a', 'blob:a', true)).toBe(true);
  });

  it('does not skip when src changed', () => {
    expect(shouldSkipWaveSurferReinit('blob:a', 'blob:b', true)).toBe(false);
  });

  it('does not skip when no instance', () => {
    expect(shouldSkipWaveSurferReinit('blob:a', 'blob:a', false)).toBe(false);
  });

  it('does not skip when next src empty', () => {
    expect(shouldSkipWaveSurferReinit('blob:a', '', true)).toBe(false);
  });
});

describe('pickSrcTracker', () => {
  it('keeps main and inline refs isolated', () => {
    const pair = { mainSrcRef: 'main', inlineSrcRef: 'inline' };
    const main = pickSrcTracker(pair, 'main');
    const inline = pickSrcTracker(pair, 'inline');

    main.set('main-v2');
    inline.set('inline-v2');

    expect(main.get()).toBe('main-v2');
    expect(inline.get()).toBe('inline-v2');
    expect(pair.mainSrcRef).toBe('main-v2');
    expect(pair.inlineSrcRef).toBe('inline-v2');
  });
});
