import { describe, expect, it } from 'vitest';
import {
  resolveFloatingPlacement,
  resolveTooltipPlacement,
  resolveTooltipPreset,
} from '@core/ui/floating/resolve-floating-placement';

const ALL_PLACEMENTS = [
  'top',
  'bottom',
  'left',
  'right',
  'top-start',
  'top-end',
  'bottom-start',
  'bottom-end',
  'left-start',
  'left-end',
  'right-start',
  'right-end',
] as const;

describe('resolveFloatingPlacement', () => {
  it('returns the same placement for LTR', () => {
    for (const placement of ALL_PLACEMENTS) {
      expect(resolveFloatingPlacement(placement, 'ltr')).toBe(placement);
    }
  });

  it('mirrors horizontal sides and alignments in RTL', () => {
    expect(resolveFloatingPlacement('bottom-end', 'rtl')).toBe('bottom-start');
    expect(resolveFloatingPlacement('bottom-start', 'rtl')).toBe('bottom-end');
    expect(resolveFloatingPlacement('left', 'rtl')).toBe('right');
    expect(resolveFloatingPlacement('right-start', 'rtl')).toBe('left-end');
    expect(resolveFloatingPlacement('top-end', 'rtl')).toBe('top-start');
    expect(resolveFloatingPlacement('bottom', 'rtl')).toBe('bottom');
    expect(resolveFloatingPlacement('top', 'rtl')).toBe('top');
  });
});

describe('resolveTooltipPreset', () => {
  it('maps presets to baseline placements', () => {
    expect(resolveTooltipPreset('toolbar')).toBe('bottom');
    expect(resolveTooltipPreset('header-edge')).toBe('bottom-end');
    expect(resolveTooltipPreset('media')).toBe('top');
    expect(resolveTooltipPreset('sidebar')).toBe('right-start');
  });
});

describe('resolveTooltipPlacement', () => {
  it('applies RTL to header-edge preset', () => {
    expect(
      resolveTooltipPlacement({ preset: 'header-edge', dir: 'ltr' })
    ).toBe('bottom-end');
    expect(
      resolveTooltipPlacement({ preset: 'header-edge', dir: 'rtl' })
    ).toBe('bottom-start');
  });

  it('prefers explicit placement over preset', () => {
    expect(
      resolveTooltipPlacement({
        preset: 'toolbar',
        placement: 'left',
        dir: 'rtl',
      })
    ).toBe('right');
  });
});
