'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Text } from 'rizzui';
import { PiFrameCornersBold } from 'react-icons/pi';
import type { GraphNode } from '@/types/graph-explorer.types';

export interface BoardGraphInspectorExtrasProps {
  node: GraphNode | null;
  onShowOnCanvas?: () => void;
}

export function BoardGraphInspectorExtras({ node, onShowOnCanvas }: BoardGraphInspectorExtrasProps) {
  const { t } = useTranslation();
  if (!node) return null;

  const props = node.properties ?? {};
  const boardRole = props.boardNodeRole as string | undefined;
  const attachmentCount = props.attachmentCount as number | undefined;
  const noteCount = props.noteCount as number | undefined;

  return (
    <div className="border-b border-muted bg-gray-50/80 px-3 py-2 dark:bg-gray-100/5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {t('boards.graph.boardContext', 'Board context')}
        </Text>
        {onShowOnCanvas ? (
          <Tooltip content={t('boards.graph.showOnCanvas', 'Show on canvas')} placement="left">
            <ActionIcon size="sm" variant="outline" onClick={onShowOnCanvas} aria-label={t('boards.graph.showOnCanvas', 'Show on canvas')}>
              <PiFrameCornersBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>
      {boardRole ? (
        <Text className="text-xs text-gray-700">
          {t('boards.inspector.nodeRole', 'Role')}: {boardRole}
        </Text>
      ) : null}
      {typeof attachmentCount === 'number' && attachmentCount > 0 ? (
        <Text className="text-xs text-gray-600">
          {t('boards.graph.commentPins', 'Comment pins')}: {attachmentCount}
        </Text>
      ) : null}
      {typeof noteCount === 'number' && noteCount > 0 ? (
        <Text className="text-xs text-gray-600">
          {t('boards.graph.nearbyNotes', 'Nearby stickies')}: {noteCount}
        </Text>
      ) : null}
    </div>
  );
}
