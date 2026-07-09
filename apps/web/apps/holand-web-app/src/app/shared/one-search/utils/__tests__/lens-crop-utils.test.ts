import { describe, expect, it } from 'vitest';
import {
  isLensSelectionValid,
  normalizeLensCrop,
} from '../lens-crop-utils';

describe('lens-crop-utils', () => {
  it('normalizes negative width and height from drag direction', () => {
    expect(normalizeLensCrop({ x: 50, y: 50, width: -20, height: -15 })).toEqual({
      x: 30,
      y: 35,
      width: 20,
      height: 15,
    });
  });

  it('clamps crop to image bounds', () => {
    expect(normalizeLensCrop({ x: 95, y: 95, width: 20, height: 20 })).toEqual({
      x: 95,
      y: 95,
      width: 5,
      height: 5,
    });
  });

  it('validates minimum selection size', () => {
    expect(isLensSelectionValid({ x: 1, y: 1, width: 2, height: 2 })).toBe(false);
    expect(isLensSelectionValid({ x: 1, y: 1, width: 10, height: 10 })).toBe(true);
  });
});
