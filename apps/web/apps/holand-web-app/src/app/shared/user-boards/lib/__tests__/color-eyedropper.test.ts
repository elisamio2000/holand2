import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  isEyeDropperSupported,
  pickColorFromScreen,
  pickColorWithFallback,
} from '../color-eyedropper';

describe('color-eyedropper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports unsupported when EyeDropper is missing', () => {
    expect(isEyeDropperSupported()).toBe(false);
  });

  it('returns sampled hex when EyeDropper succeeds', async () => {
    class MockEyeDropper {
      open() {
        return Promise.resolve({ sRGBHex: '#ff00aa' });
      }
    }
    vi.stubGlobal('EyeDropper', MockEyeDropper);
    await expect(pickColorFromScreen()).resolves.toBe('#ff00aa');
  });

  it('prefers custom eyedropper after overlay delay', async () => {
    const startCustom = vi.fn().mockResolvedValue('#112233');
    const promise = pickColorWithFallback(startCustom, { overlayDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe('#112233');
    expect(startCustom).toHaveBeenCalledOnce();
  });
});