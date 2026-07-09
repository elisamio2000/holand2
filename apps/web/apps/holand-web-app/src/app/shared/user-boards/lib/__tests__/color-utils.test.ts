import { describe, expect, it } from 'vitest';
import { normalizeHexColor, resolveDisplayHex } from '../color-utils';

describe('normalizeHexColor', () => {
  it('accepts 6-digit hex with hash', () => {
    expect(normalizeHexColor('#FF00AA')).toBe('#ff00aa');
  });

  it('expands 3-digit shorthand', () => {
    expect(normalizeHexColor('#f0a')).toBe('#ff00aa');
  });

  it('adds hash to bare hex', () => {
    expect(normalizeHexColor('1e293b')).toBe('#1e293b');
  });

  it('rejects invalid values', () => {
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('#gggggg')).toBeNull();
  });
});

describe('resolveDisplayHex', () => {
  it('falls back when value is empty', () => {
    expect(resolveDisplayHex('', '#94a3b8')).toBe('#94a3b8');
  });
});
