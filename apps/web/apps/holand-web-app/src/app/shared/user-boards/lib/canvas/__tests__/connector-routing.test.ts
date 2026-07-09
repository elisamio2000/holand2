import { describe, expect, it } from 'vitest';
import {
  anchorOnSide,
  boundsOfObject,
  computeConnectorRoute,
  defaultOrthogonalBend,
  reactFlowHandleSides,
  resolveConnectorEndpoints,
} from '../connector-routing';
import type { BoardConnectorObject, BoardNodeObject, BoardStickyObject } from '../../board-types';

const node = (id: string, x: number, y: number): BoardNodeObject => ({
  type: 'node',
  id,
  x,
  y,
  width: 80,
  height: 80,
  label: id,
  nodeRole: 'topic',
  color: '#3b82f6',
});

const sticky = (id: string, x: number, y: number): BoardStickyObject => ({
  type: 'sticky',
  id,
  x,
  y,
  width: 160,
  height: 120,
  text: '',
  color: '#fef08a',
});

const connector = (overrides: Partial<BoardConnectorObject> = {}): BoardConnectorObject => ({
  type: 'connector',
  id: 'c1',
  sourceId: 'a',
  targetId: 'b',
  ...overrides,
});

describe('connector-routing', () => {
  it('anchors on shape boundary toward the peer object', () => {
    const a = node('a', 0, 0);
    const b = node('b', 200, 0);
    const { source, target } = resolveConnectorEndpoints(a, b);
    expect(source.x).toBeGreaterThan(a.x + a.width / 2 - 1);
    expect(target.x).toBeLessThan(b.x + b.width / 2 + 1);
  });

  it('supports sticky-to-node connections', () => {
    const a = sticky('a', 0, 0);
    const b = node('b', 300, 40);
    const route = computeConnectorRoute(connector(), a, b);
    expect(route).not.toBeNull();
    expect(route!.pathD).toMatch(/^M /);
    expect(route!.source.x).toBeGreaterThan(a.x);
    expect(route!.target.x).toBeLessThan(b.x + b.width);
  });

  it('builds curved path by default', () => {
    const route = computeConnectorRoute(connector(), node('a', 0, 0), node('b', 200, 100));
    expect(route!.pathD).toContain('C ');
  });

  it('builds orthogonal path', () => {
    const route = computeConnectorRoute(
      connector({ routeStyle: 'orthogonal' }),
      node('a', 0, 0),
      node('b', 200, 100)
    );
    expect(route!.pathD.split(' L ').length).toBeGreaterThan(2);
    expect(route!.bendHandle).toBeDefined();
  });

  it('picks vertical flow handles when nodes are stacked', () => {
    const sides = reactFlowHandleSides(node('a', 100, 0), node('b', 100, 200));
    expect(sides.sourceSide).toBe('bottom');
    expect(sides.targetSide).toBe('top');
  });

  it('orthogonal path uses side-aware routing for vertical stack', () => {
    const route = computeConnectorRoute(
      connector({ routeStyle: 'orthogonal' }),
      node('a', 100, 0),
      node('b', 100, 200)
    );
    expect(route!.from?.side).toBe('bottom');
    expect(route!.to?.side).toBe('top');
    expect(route!.pathD).toContain(`L ${route!.from!.x}`);
  });

  it('picks horizontal flow handles when nodes are side by side', () => {
    const sides = reactFlowHandleSides(node('a', 0, 0), node('b', 240, 0));
    expect(sides.sourceSide).toBe('right');
    expect(sides.targetSide).toBe('left');
  });

  it('computes default orthogonal elbow', () => {
    const bend = defaultOrthogonalBend({ x: 0, y: 0 }, { x: 200, y: 100 });
    expect(bend.x).toBe(100);
    expect(bend.y).toBe(0);
  });

  it('rotates anchor points with object rotation', () => {
    const n = { ...node('a', 0, 0), rotation: 45 };
    const bounds = boundsOfObject(n);
    const flat = anchorOnSide({ ...bounds, rotation: 0 }, 'right');
    const rotated = anchorOnSide(bounds, 'right');
    expect(rotated.x).not.toBeCloseTo(flat.x, 0);
    expect(rotated.y).not.toBeCloseTo(flat.y, 0);
  });
});
