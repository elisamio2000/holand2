/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrubPreview } from '../use-scrub-preview';

const spriteMeta = {
  spriteUrl: '/sprite.jpg',
  tileWidth: 160,
  tileHeight: 90,
  tileCount: 10,
  intervalSec: 10,
};

describe('useScrubPreview', () => {
  it('returns null preview when no hover', () => {
    const { result } = renderHook(() =>
      useScrubPreview({ duration: 100, spriteMeta })
    );
    expect(result.current.previewStyle).toBeNull();
    expect(result.current.hoverTime).toBeNull();
  });

  it('computes sprite background position from hover ratio', () => {
    const { result } = renderHook(() =>
      useScrubPreview({ duration: 100, spriteMeta })
    );
    act(() => {
      result.current.onHoverRatio(0.25);
    });
    expect(result.current.hoverTime).toBe(25);
    expect(result.current.previewStyle?.backgroundPosition).toBe('-320px 0');
  });

  it('clamps tile index at last frame', () => {
    const { result } = renderHook(() =>
      useScrubPreview({ duration: 100, spriteMeta })
    );
    act(() => {
      result.current.onHoverRatio(0.99);
    });
    expect(result.current.previewStyle?.backgroundPosition).toBe('-1440px 0');
  });

  it('clears preview when ratio is null', () => {
    const { result } = renderHook(() =>
      useScrubPreview({ duration: 60, spriteMeta })
    );
    act(() => {
      result.current.onHoverRatio(0.5);
      result.current.onHoverRatio(null);
    });
    expect(result.current.hoverTime).toBeNull();
    expect(result.current.previewStyle).toBeNull();
  });
});
