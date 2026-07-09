/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoardPanels } from '../use-board-panels';

describe('useBoardPanels', () => {
  it('opens panels in docked mode by default', () => {
    const { result } = renderHook(() => useBoardPanels('panel-default-test'));

    act(() => {
      result.current.setPanelMode('selection', 'floating');
      result.current.hidePanel('selection');
    });

    act(() => {
      result.current.showPanel('selection');
    });

    expect(result.current.prefs.selection.visible).toBe(true);
    expect(result.current.prefs.selection.mode).toBe('docked');
  });

  it('restores docked mode when toggled open', () => {
    const { result } = renderHook(() => useBoardPanels('panel-toggle-test'));

    act(() => {
      result.current.setPanelMode('settings', 'floating');
      result.current.hidePanel('settings');
    });

    act(() => {
      result.current.togglePanel('settings');
    });

    expect(result.current.prefs.settings.visible).toBe(true);
    expect(result.current.prefs.settings.mode).toBe('docked');
  });
});
