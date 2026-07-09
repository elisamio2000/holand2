'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import type { LayerMove } from '../../lib/canvas/layer-order';
import {
  IconLayerBack,
  IconLayerBackward,
  IconLayerForward,
  IconLayerFront,
} from '../../components/board-design-icons';
import { BoardIconTool, BoardIconToolbar } from '../../components/board-icon-toolbar';

export interface InspectorArrangeToolbarProps {
  onLayerMove: (move: LayerMove) => void;
  disabled?: boolean;
}

export function InspectorArrangeToolbar({ onLayerMove, disabled }: InspectorArrangeToolbarProps) {
  const { t } = useTranslation();

  const tools: { move: LayerMove; icon: ReactNode; label: string }[] = [
    { move: 'front', icon: <IconLayerFront />, label: t('boards.arrange.front', 'Bring to Front') },
    { move: 'forward', icon: <IconLayerForward />, label: t('boards.arrange.forward', 'Bring Forward') },
    { move: 'backward', icon: <IconLayerBackward />, label: t('boards.arrange.backward', 'Send Backward') },
    { move: 'back', icon: <IconLayerBack />, label: t('boards.arrange.back', 'Send to Back') },
  ];

  return (
    <div className="space-y-1">
      <Text className="text-xs text-gray-500">{t('boards.arrange.title', 'Arrange')}</Text>
      <BoardIconToolbar>
        {tools.map(({ move, icon, label }) => (
          <BoardIconTool
            key={move}
            icon={icon}
            label={label}
            disabled={disabled}
            onClick={() => onLayerMove(move)}
          />
        ))}
      </BoardIconToolbar>
    </div>
  );
}
