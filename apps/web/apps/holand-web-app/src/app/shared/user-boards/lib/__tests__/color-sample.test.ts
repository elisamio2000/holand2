// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  colorFromElement,
  parseCssColorWithAlpha,
  sampleColorAtPoint,
} from '../color-sample';

describe('color-sample', () => {
  it('parses rgba with alpha', () => {
    expect(parseCssColorWithAlpha('rgba(248, 250, 252, 1)')).toEqual({
      r: 248,
      g: 250,
      b: 252,
      a: 1,
    });
    expect(parseCssColorWithAlpha('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseCssColorWithAlpha('transparent')).toBeNull();
  });

  it('ignores default text color on transparent svg hit targets', () => {
    document.body.innerHTML = `
      <div id="bg" style="position:fixed;inset:0;background-color:#f8fafc;"></div>
      <svg width="200" height="200" style="position:fixed;left:0;top:0">
        <rect width="200" height="200" fill="transparent" />
      </svg>
    `;
    const rect = document.querySelector('rect')!;
    expect(colorFromElement(rect, 50, 50)).toBeNull();

    document.elementsFromPoint = () => {
      const rectEl = document.querySelector('rect')!;
      const bg = document.querySelector('#bg')!;
      return [rectEl, bg];
    };
    expect(sampleColorAtPoint(50, 50)).toBe('#f8fafc');
  });

  it('reads svg fill for painted shapes', () => {
    document.body.innerHTML = `
      <svg width="100" height="100">
        <rect width="100" height="100" fill="#dc2626" />
      </svg>
    `;
    const rect = document.querySelector('rect')!;
    expect(colorFromElement(rect, 10, 10)).toBe('#dc2626');
  });

  it('reads html background before inherited text color', () => {
    document.body.innerHTML = `<div style="width:100px;height:100px;background-color:#ffffff;color:#000000"></div>`;
    const div = document.querySelector('div')!;
    expect(colorFromElement(div, 10, 10)).toBe('#ffffff');
  });
});
