import { describe, expect, it } from 'vitest';
import {
  createConnectSession,
  getCircleBoundaryPoint,
  getObjectAnchorPoint,
  getRectBoundaryPoint,
  isConnectableType,
  updateConnectCursor,
} from '../connect-session';
import { getObjectMinSize } from '../resize-session';
import { readGridPreferences, writeGridPreferences, effectiveGridVisible } from '../grid-preference';
import { computeGridBackgroundStyle } from '../grid-background';

describe('grid-preference', () => {
  it('reads defaults', () => {
    const prefs = readGridPreferences();
    expect(prefs.style).toBe('dots');
    expect(prefs.opacity).toBeGreaterThan(0);
  });

  it('effective visibility follows snap when visible is null', () => {
    expect(effectiveGridVisible({ visible: null, opacity: 0.2, style: 'dots', color: null }, true)).toBe(true);
    expect(effectiveGridVisible({ visible: null, opacity: 0.2, style: 'dots', color: null }, false)).toBe(false);
  });

  it('persists style', () => {
    const next = writeGridPreferences({ style: 'lines', opacity: 0.25 });
    expect(next.style).toBe('lines');
    expect(next.opacity).toBe(0.25);
    writeGridPreferences({ style: 'dots' });
  });
});

describe('computeGridBackgroundStyle', () => {
  it('returns dot pattern when visible', () => {
    const style = computeGridBackgroundStyle(
      800,
      600,
      { x: 0, y: 0, width: 1400, height: 900 },
      24,
      { visible: true, opacity: 0.2, style: 'dots', color: null },
      true,
      false
    );
    expect(style?.backgroundImage).toContain('radial-gradient');
  });

  it('returns null when grid hidden', () => {
    const style = computeGridBackgroundStyle(
      800,
      600,
      { x: 0, y: 0, width: 1400, height: 900 },
      24,
      { visible: false, opacity: 0.2, style: 'dots', color: null },
      false,
      false
    );
    expect(style).toBeNull();
  });
});

describe('connect-session', () => {
  it('detects connectable types', () => {
    expect(isConnectableType('node')).toBe(true);
    expect(isConnectableType('connector')).toBe(false);
  });

  it('marks moved after threshold', () => {
    const s = createConnectSession('a', 0, 0);
    const next = updateConnectCursor(s, 10, 0);
    expect(next.moved).toBe(true);
  });

  it('computes circle boundary point', () => {
    const p = getCircleBoundaryPoint(0, 0, 10, 20, 0);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });

  it('computes node anchor', () => {
    const p = getObjectAnchorPoint(
      { type: 'node', x: 0, y: 0, width: 40, height: 40 },
      100,
      0
    );
    expect(p.x).toBeGreaterThan(15);
  });

  it('computes rect top port', () => {
    const p = getObjectAnchorPoint(
      { type: 'sticky', x: 0, y: 0, width: 100, height: 80 },
      50,
      50,
      'top'
    );
    expect(p.y).toBe(0);
    expect(p.x).toBe(50);
  });

  it('computes rect boundary', () => {
    const p = getRectBoundaryPoint({ x: 0, y: 0, width: 100, height: 50 }, 200, 25);
    expect(p.x).toBe(100);
  });

  it('uses larger min size for sticky', () => {
    const sticky = getObjectMinSize('sticky');
    expect(sticky.minWidth).toBeGreaterThan(80);
    expect(sticky.minHeight).toBeGreaterThan(56);
  });
});
