'use client';

import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import type { BoardNodeObject, BoardObject } from '../../lib/board-types';
import {
  getAnchorLinksAmong,
  getNodeAnchorPeers,
  listMagnetChildren,
  magnetDetachPatch,
} from '../../lib/canvas/node-magnet';

function objectLabel(objects: BoardObject[], id: string): string {
  const obj = objects.find((o) => o.id === id);
  if (!obj) return id.slice(0, 8);
  if (obj.type === 'node') return (obj as BoardNodeObject).label || id.slice(0, 8);
  if (obj.type === 'sticky') return obj.text?.slice(0, 24) || 'Sticky';
  if (obj.type === 'frame') return obj.title || 'Frame';
  if (obj.type === 'media') return obj.caption || 'Media';
  return id.slice(0, 8);
}

export interface InspectorAnchorLinksSectionProps {
  objects: BoardObject[];
  /** Single node id for peer list, or multiple for pair list among selection */
  nodeIds: string[];
  readOnly?: boolean;
  onAnchorLinkChange?: (nodeId: string, otherId: string, linked: boolean) => void;
  onUnlinkAllAmong?: () => void;
  onDetachMagnetChild?: (childId: string) => void;
  /** Show magnet children for the first node when single selection */
  showMagnetChildren?: boolean;
}

export function InspectorAnchorLinksSection({
  objects,
  nodeIds,
  readOnly = false,
  onAnchorLinkChange,
  onUnlinkAllAmong,
  onDetachMagnetChild,
  showMagnetChildren = false,
}: InspectorAnchorLinksSectionProps) {
  const { t } = useTranslation();

  const pairs =
    nodeIds.length >= 2
      ? getAnchorLinksAmong(objects, nodeIds)
      : nodeIds.length === 1
        ? getNodeAnchorPeers(objects, nodeIds[0]).map(
            (peer) => [nodeIds[0], peer] as [string, string]
          )
        : [];

  const magnetChildren =
    showMagnetChildren && nodeIds.length === 1 ? listMagnetChildren(objects, nodeIds[0]) : [];

  if (pairs.length === 0 && magnetChildren.length === 0) {
    return (
      <Text className="text-[10px] text-gray-500">
        {t('boards.inspector.noMoveLinks', 'No move links')}
      </Text>
    );
  }

  return (
    <div className="space-y-2">
      {pairs.length > 0 ? (
        <div className="space-y-1">
          <Text className="text-[10px] font-medium text-gray-600">
            {t('boards.inspector.anchorLinks', 'Move links')}
          </Text>
          {pairs.map(([a, b]) => (
            <div key={`${a}|${b}`} className="flex items-center justify-between gap-2">
              <Text className="truncate text-[10px]">
                {objectLabel(objects, a)} ↔ {objectLabel(objects, b)}
              </Text>
              {!readOnly && onAnchorLinkChange ? (
                <button
                  type="button"
                  className="shrink-0 text-[10px] text-primary underline"
                  onClick={() => onAnchorLinkChange(a, b, false)}
                >
                  {t('boards.inspector.unlink', 'Unlink')}
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly && onUnlinkAllAmong && pairs.length > 1 && nodeIds.length >= 2 ? (
            <button
              type="button"
              className="text-[10px] text-primary underline"
              onClick={() => onUnlinkAllAmong()}
            >
              {t('boards.link.unlinkAll', 'Unlink all in selection')}
            </button>
          ) : null}
        </div>
      ) : null}

      {magnetChildren.length > 0 ? (
        <div className="space-y-1">
          <Text className="text-[10px] font-medium text-gray-600">
            {t('boards.inspector.magnetChildren', 'Magnet-attached items')}
          </Text>
          {magnetChildren.map((child) => (
            <div key={child.id} className="flex items-center justify-between gap-2">
              <Text className="truncate text-[10px]">{objectLabel(objects, child.id)}</Text>
              {!readOnly && onDetachMagnetChild ? (
                <button
                  type="button"
                  className="shrink-0 text-[10px] text-primary underline"
                  onClick={() => onDetachMagnetChild(child.id)}
                >
                  {t('boards.inspector.detachMagnet', 'Detach from node')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
