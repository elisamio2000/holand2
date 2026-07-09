import { describe, expect, it } from 'vitest';
import {
  PLATFORM_Z_INDEX,
  resolveTooltipZIndexFromStack,
  TOOLTIP_Z_INDEX_MIN,
} from '@core/ui/floating/platform-z-index';

describe('resolveTooltipZIndexFromStack', () => {
  it('uses overlay floor when trigger stack is low (plain page content)', () => {
    expect(resolveTooltipZIndexFromStack(0)).toBe(TOOLTIP_Z_INDEX_MIN);
    expect(resolveTooltipZIndexFromStack(990)).toBe(TOOLTIP_Z_INDEX_MIN);
  });

  it('uses stack + 1 when trigger lives above overlay floor', () => {
    expect(resolveTooltipZIndexFromStack(PLATFORM_Z_INDEX.floatingPanel)).toBe(
      PLATFORM_Z_INDEX.floatingPanel + 1
    );
    expect(resolveTooltipZIndexFromStack(10050)).toBe(10051);
  });

  it('is exactly one layer above sticky header when that is the highest ancestor', () => {
    expect(resolveTooltipZIndexFromStack(PLATFORM_Z_INDEX.stickyHeader)).toBe(
      TOOLTIP_Z_INDEX_MIN
    );
  });
});
