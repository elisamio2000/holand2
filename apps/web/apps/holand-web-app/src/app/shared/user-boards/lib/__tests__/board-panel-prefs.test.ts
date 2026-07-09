import { describe, expect, it } from 'vitest';
import { readBoardPanelPrefs, DEFAULT_BOARD_PANEL_PREFS } from '../board-panel-prefs';

describe('board-panel-prefs', () => {
  it('merges defaults for all panel ids', () => {
    const prefs = readBoardPanelPrefs('test-board');
    expect(prefs.selection.visible).toBe(DEFAULT_BOARD_PANEL_PREFS.selection.visible);
    expect(prefs.comments).toBeDefined();
    expect(prefs.minimap).toBeDefined();
  });
});
