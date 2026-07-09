'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import type { BooleanOp } from '../../lib/canvas/boolean-combine';
import {
  IconBooleanExclude,
  IconBooleanIntersect,
  IconBooleanSubtract,
  IconBooleanUnion,
} from '../../components/board-design-icons';
import { BoardIconTool, BoardIconToolbar } from '../../components/board-icon-toolbar';

export interface InspectorBooleanToolbarProps {
  onCombine: (op: BooleanOp) => void;
  disabled?: boolean;
}

const OPS: { op: BooleanOp; icon: ReactNode; labelKey: string; fallback: string }[] = [
  { op: 'union', icon: <IconBooleanUnion />, labelKey: 'boards.boolean.union', fallback: 'Union' },
  { op: 'subtract', icon: <IconBooleanSubtract />, labelKey: 'boards.boolean.subtract', fallback: 'Subtract' },
  { op: 'intersect', icon: <IconBooleanIntersect />, labelKey: 'boards.boolean.intersect', fallback: 'Intersect' },
  { op: 'exclude', icon: <IconBooleanExclude />, labelKey: 'boards.boolean.exclude', fallback: 'Exclude' },
];

export function InspectorBooleanToolbar({ onCombine, disabled }: InspectorBooleanToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      <Text className="text-xs text-gray-500">{t('boards.boolean.title', 'Combine shapes')}</Text>
      <BoardIconToolbar>
        {OPS.map(({ op, icon, labelKey, fallback }) => (
          <BoardIconTool
            key={op}
            icon={icon}
            label={t(labelKey, fallback)}
            disabled={disabled}
            onClick={() => onCombine(op)}
          />
        ))}
      </BoardIconToolbar>
    </div>
  );
}
