'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'rizzui';
import { PiSparkleBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { BoardObject } from '../lib/board-types';

export interface BoardAiSelectionPanelProps {
  boardId: string;
  selectedObjects: BoardObject[];
  className?: string;
}

/** Surfaces selected canvas objects as AI chat context (ERMINE integration stub). */
export function BoardAiSelectionPanel({
  boardId,
  selectedObjects,
  className,
}: BoardAiSelectionPanelProps) {
  const { t } = useTranslation();
  const labels = selectedObjects
    .map((o) => {
      if (o.type === 'node' && 'label' in o) return o.label;
      if (o.type === 'sticky' && 'text' in o) return o.text.slice(0, 40);
      if (o.type === 'media' && 'name' in o) return o.name;
      return o.type;
    })
    .filter(Boolean);

  const contextQuery = encodeURIComponent(
    `Board ${boardId}: discuss selection — ${labels.join(', ') || 'empty selection'}`
  );

  return (
    <div className={`space-y-3 p-3 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <PiSparkleBold className="h-4 w-4 text-primary" />
        <Text className="text-sm font-semibold">
          {t('boards.ai.selectionTitle', 'AI on selection')}
        </Text>
      </div>
      <Text className="text-xs text-gray-500">
        {selectedObjects.length
          ? t('boards.ai.selectionCount', '{{n}} object(s) selected', { n: selectedObjects.length })
          : t('boards.ai.selectObjects', 'Select objects on the canvas to build context.')}
      </Text>
      {labels.length ? (
        <ul className="max-h-24 space-y-1 overflow-y-auto text-[10px] text-gray-600">
          {labels.map((label, i) => (
            <li key={`${label}-${i}`} className="truncate">
              · {label}
            </li>
          ))}
        </ul>
      ) : null}
      <Button size="sm" className="w-full" disabled={!selectedObjects.length} as="span">
        <Link href={`${routes.aiChat.root}?context=${contextQuery}`}>
          {t('boards.ai.openChat', 'Open AI chat with context')}
        </Link>
      </Button>
    </div>
  );
}
