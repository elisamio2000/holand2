// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoardHistory } from '../use-board-history';
import { createEmptySnapshot } from '../../lib/board-snapshot';
import type { BoardNodeObject } from '../../lib/board-types';

const node = (id: string, label = id): BoardNodeObject => ({
  type: 'node',
  id,
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  label,
  nodeRole: 'topic',
  color: '#3b82f6',
});

describe('useBoardHistory', () => {
  it('commit creates undo step', () => {
    const initial = createEmptySnapshot();
    initial.objects = [node('a')];
    const { result } = renderHook(() => useBoardHistory(initial));

    act(() => {
      result.current.commitDocument({
        ...result.current.document,
        objects: [node('a', 'changed')],
      });
    });

    expect(result.current.snapshot.objects[0].type === 'node' && result.current.snapshot.objects[0].label).toBe('changed');

    act(() => {
      result.current.undo();
    });

    const first = result.current.snapshot.objects[0];
    expect(first.type === 'node' && first.label).toBe('a');
  });

  it('gesture drag produces one undo step', () => {
    const initial = createEmptySnapshot();
    initial.objects = [node('a')];
    const { result } = renderHook(() => useBoardHistory(initial));

    act(() => {
      result.current.beginGesture();
      result.current.replaceDuringGesture({
        ...result.current.document,
        objects: [node('a', 'dragged')],
      });
      result.current.endGesture();
    });

    act(() => {
      result.current.undo();
    });

    const first = result.current.snapshot.objects[0];
    expect(first.type === 'node' && first.label).toBe('a');
  });

  it('replace without gesture does not create undo step', () => {
    const initial = createEmptySnapshot();
    initial.objects = [node('a')];
    const { result } = renderHook(() => useBoardHistory(initial));

    act(() => {
      result.current.replaceDocument({
        ...result.current.document,
        objects: [node('a', 'silent')],
      });
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('undo/redo round-trip', () => {
    const initial = createEmptySnapshot();
    initial.objects = [node('a')];
    const { result } = renderHook(() => useBoardHistory(initial));

    act(() => {
      result.current.commitDocument({
        ...result.current.document,
        objects: [node('a', 'v2')],
      });
    });

    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });

    const first = result.current.snapshot.objects[0];
    expect(first.type === 'node' && first.label).toBe('v2');
  });

  it('undo restores viewBox captured at commit time', () => {
    const initial = createEmptySnapshot();
    initial.viewBox = { x: 0, y: 0, width: 800, height: 600 };
    initial.objects = [node('a')];
    const { result } = renderHook(() => useBoardHistory(initial));

    act(() => {
      result.current.setViewBox({ x: 100, y: 50, width: 800, height: 600 });
      result.current.commitDocument({
        ...result.current.document,
        objects: [node('a', 'moved')],
      });
    });

    expect(result.current.viewBox.x).toBe(100);

    act(() => {
      result.current.undo();
    });

    expect(result.current.viewBox.x).toBe(100);
    const first = result.current.snapshot.objects[0];
    expect(first.type === 'node' && first.label).toBe('a');
  });
});
