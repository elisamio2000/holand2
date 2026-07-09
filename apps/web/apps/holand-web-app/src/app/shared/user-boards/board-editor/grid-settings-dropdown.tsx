'use client';

import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Text } from 'rizzui';
import { PiCaretDown, PiGridFour } from 'react-icons/pi';
import type { GridPreferences, GridStyle } from '../lib/canvas/grid-preference';
import { GRID_OPACITY_MAX, GRID_OPACITY_MIN } from '../lib/canvas/grid-tokens';
import { BoardColorPicker } from '../components/board-color-picker';
import { OpacityField } from '../components/opacity-field';

export interface GridSettingsDropdownProps {
  preferences: GridPreferences;
  snapToGrid: boolean;
  onChange: (patch: Partial<GridPreferences>) => void;
  onToggleSnap: () => void;
}

export function GridSettingsDropdown({
  preferences,
  snapToGrid,
  onChange,
  onToggleSnap,
}: GridSettingsDropdownProps) {
  const { t } = useTranslation();

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button
          size="sm"
          variant={snapToGrid ? 'solid' : 'outline'}
          className="gap-1 px-2"
          aria-label={t('boards.snap.grid', 'Grid settings')}
        >
          <PiGridFour className="size-4" />
          <PiCaretDown className="size-3" />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Menu className="min-w-[220px] p-3">
        <Text className="mb-2 text-xs font-semibold">{t('boards.grid.title', 'Grid')}</Text>
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={onToggleSnap}
          />
          {t('boards.grid.snap', 'Snap to grid')}
        </label>
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={preferences.visible ?? snapToGrid}
            onChange={(e) => onChange({ visible: e.target.checked })}
          />
          {t('boards.grid.show', 'Show grid')}
        </label>
        <OpacityField
          label={t('boards.grid.opacity', 'Opacity')}
          value={preferences.opacity}
          min={GRID_OPACITY_MIN}
          max={GRID_OPACITY_MAX}
          step={0.01}
          onChange={(opacity) => onChange({ opacity })}
          className="mb-3"
        />
        <Text className="mb-1 text-[10px] text-gray-500">{t('boards.grid.style', 'Style')}</Text>
        <div className="mb-3 flex gap-1">
          {(['dots', 'lines'] as GridStyle[]).map((style) => (
            <Button
              key={style}
              size="sm"
              variant={preferences.style === style ? 'solid' : 'outline'}
              className="flex-1 text-xs"
              onClick={() => onChange({ style })}
            >
              {t(`boards.grid.style.${style}`, style)}
            </Button>
          ))}
        </div>
        <BoardColorPicker
          label={t('boards.grid.color', 'Color (advanced)')}
          value={preferences.color ?? ''}
          placeholder="#94a3b8"
          allowClear
          onClear={() => onChange({ color: null })}
          onChange={(color) => onChange({ color })}
        />
      </Dropdown.Menu>
    </Dropdown>
  );
}
