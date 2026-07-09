'use client';

import { useTranslation } from 'react-i18next';
import { Text, Title } from 'rizzui';
import type {
  BoardStyleDefaults,
} from '../../lib/board-types';
import { DEFAULT_BOARD_STYLE } from '../../lib/board-style-defaults';
import { BoardColorPicker } from '../../components/board-color-picker';
import { OpacityField } from '../../components/opacity-field';
import {
  ArrowDirectionField,
  RouteStyleField,
  StrokeStyleField,
} from '../../components/connector-style-fields';

export interface BoardDefaultsPanelProps {
  styleDefaults: BoardStyleDefaults;
  onChange: (patch: Partial<BoardStyleDefaults>) => void;
}

import { CompactNumField } from '../../components/compact-num-field';

export function BoardDefaultsPanel({ styleDefaults, onChange }: BoardDefaultsPanelProps) {
  const { t } = useTranslation();
  const d = { ...DEFAULT_BOARD_STYLE, ...styleDefaults } as Required<BoardStyleDefaults>;

  return (
    <div className="mt-3 space-y-1.5 border-t border-muted pt-3">
      <Title as="h6" className="text-xs">
        {t('boards.inspector.boardDefaults', 'Board defaults')}
      </Title>
      <Text className="text-[10px] text-gray-500">
        {t('boards.inspector.boardDefaultsHint', 'Applied to new items; per-item settings override these.')}
      </Text>

      <OpacityField
        label={t('boards.inspector.objectOpacity', 'Object opacity')}
        value={d.objectOpacity ?? 1}
        step={0.01}
        onChange={(v) => onChange({ objectOpacity: v })}
      />
      <BoardColorPicker
        label={t('boards.inspector.nodeColor', 'Node color')}
        value={d.nodeColor ?? DEFAULT_BOARD_STYLE.nodeColor}
        onChange={(nodeColor) => onChange({ nodeColor })}
      />
      <BoardColorPicker
        label={t('boards.inspector.stickyColor', 'Sticky color')}
        value={d.stickyColor ?? DEFAULT_BOARD_STYLE.stickyColor}
        onChange={(stickyColor) => onChange({ stickyColor })}
      />

      <Text className="pt-1 text-[10px] font-medium text-gray-600">
        {t('boards.inspector.connectorDefaults', 'Connector defaults')}
      </Text>
      <BoardColorPicker
        label={t('boards.inspector.color', 'Color')}
        value={d.connectorColor ?? DEFAULT_BOARD_STYLE.connectorColor}
        onChange={(connectorColor) => onChange({ connectorColor })}
      />
      <CompactNumField
        label={t('boards.inspector.strokeWidth', 'Stroke width')}
        value={d.connectorStrokeWidth ?? 2}
        min={0.5}
        max={24}
        step={0.5}
        onChange={(v) => onChange({ connectorStrokeWidth: v })}
      />
      <StrokeStyleField
        value={d.connectorStrokeStyle ?? 'solid'}
        onChange={(connectorStrokeStyle) => onChange({ connectorStrokeStyle })}
      />
      <OpacityField
        label={t('boards.inspector.opacity', 'Opacity')}
        value={d.connectorOpacity ?? 1}
        step={0.01}
        onChange={(v) => onChange({ connectorOpacity: v })}
      />
      <ArrowDirectionField
        value={d.connectorArrowDirection ?? 'forward'}
        onChange={(connectorArrowDirection) => onChange({ connectorArrowDirection })}
      />
      <RouteStyleField
        value={d.connectorRouteStyle ?? 'curved'}
        onChange={(connectorRouteStyle) => onChange({ connectorRouteStyle })}
      />

      <Text className="pt-1 text-[10px] font-medium text-gray-600">
        {t('boards.inspector.inkDefaults', 'Draw defaults')}
      </Text>
      <BoardColorPicker
        label={t('boards.inspector.color', 'Color')}
        value={d.inkColor ?? DEFAULT_BOARD_STYLE.inkColor}
        onChange={(inkColor) => onChange({ inkColor })}
      />
      <CompactNumField
        label={t('boards.inspector.strokeWidth', 'Stroke width')}
        value={d.inkStrokeWidth ?? 3}
        min={0.5}
        max={24}
        step={0.5}
        onChange={(v) => onChange({ inkStrokeWidth: v })}
      />
      <OpacityField
        label={t('boards.inspector.opacity', 'Opacity')}
        value={d.inkOpacity ?? 1}
        step={0.01}
        onChange={(v) => onChange({ inkOpacity: v })}
      />
    </div>
  );
}
