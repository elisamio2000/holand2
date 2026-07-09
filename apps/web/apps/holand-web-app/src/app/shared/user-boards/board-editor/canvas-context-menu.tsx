'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CanvasContextHit } from '../lib/canvas-hit-resolve';
import { formatBindings } from '../lib/shortcuts/format';
import { getCommandDef } from '../lib/shortcuts/registry';
import type { BoardNodeShape } from '../lib/board-types';
import { NODE_SHAPE_OPTIONS } from './board-node-shape-picker';
import { ContextSubmenu } from './components/context-submenu';
import type { LayerMove } from '../lib/canvas/layer-order';
import type { BooleanOp } from '../lib/canvas/boolean-combine';
import {
  IconBooleanExclude,
  IconBooleanIntersect,
  IconBooleanSubtract,
  IconBooleanUnion,
  IconLayerBack,
  IconLayerBackward,
  IconLayerForward,
  IconLayerFront,
} from '../components/board-design-icons';

export type CanvasContextAction =
  | { type: 'add-sticky'; worldX: number; worldY: number }
  | { type: 'add-node'; worldX: number; worldY: number }
  | { type: 'add-image'; worldX: number; worldY: number }
  | { type: 'add-frame'; worldX: number; worldY: number }
  | { type: 'paste' }
  | { type: 'fit-all' }
  | { type: 'center-view' }
  | { type: 'toggle-snap' }
  | { type: 'clear-selection' }
  | { type: 'duplicate' }
  | { type: 'delete' }
  | { type: 'layer-move'; move: LayerMove }
  | { type: 'lock-toggle' }
  | { type: 'copy-id'; id: string }
  | { type: 'start-connection'; nodeId: string }
  | { type: 'reverse-connector'; id: string }
  | { type: 'delete-ink'; id: string }
  | { type: 'set-node-shape'; id: string; shape: BoardNodeShape }
  | { type: 'edit-node-label'; id: string }
  | { type: 'edit-connector-label'; id: string }
  | { type: 'import-shape' }
  | { type: 'edit-path'; id: string }
  | { type: 'convert-to-node'; id: string }
  | { type: 'boolean-combine'; op: BooleanOp }
  | { type: 'group-selection' }
  | { type: 'ungroup-selection' }
  | { type: 'link-nodes-move' }
  | { type: 'link-connected-nodes' }
  | { type: 'unlink-nodes-move' };

export interface CanvasContextMenuProps {
  x: number;
  y: number;
  open: boolean;
  hit: CanvasContextHit | null;
  snapEnabled: boolean;
  canPaste?: boolean;
  /** Current shape of the node under the menu (for checkmark). */
  activeNodeShape?: BoardNodeShape;
  /** Selected spatial count for combine submenu */
  selectionCount?: number;
  spatialSelectionCount?: number;
  nodeSelectionCount?: number;
  canUngroup?: boolean;
  canUnlinkNodes?: boolean;
  onClose: () => void;
  onAction: (action: CanvasContextAction) => void;
}

export function CanvasContextMenu({
  x,
  y,
  open,
  hit,
  snapEnabled,
  canPaste,
  activeNodeShape,
  selectionCount = 0,
  spatialSelectionCount = 0,
  nodeSelectionCount = 0,
  canUngroup = false,
  canUnlinkNodes = false,
  onClose,
  onAction,
}: CanvasContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !hit) return null;

  const item = (label: string, action: () => void, shortcutId?: string, icon?: React.ReactNode) => {
    const sc = shortcutId ? getCommandDef(shortcutId) : undefined;
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start text-xs hover:bg-muted"
        onClick={() => {
          action();
          onClose();
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="whitespace-nowrap">{label}</span>
        </span>
        {sc ? (
          <kbd className="shrink-0 whitespace-nowrap font-mono text-[9px] text-gray-400">
            {formatBindings(sc.defaults)}
          </kbd>
        ) : null}
      </button>
    );
  };

  const sep = () => <div className="my-1 h-px bg-muted" />;

  const isSpatialObject =
    hit.kind === 'object' && hit.objectType !== 'connector';

  const arrangeBlock = () => {
    if (!isSpatialObject) return null;
    const layerItem = (move: LayerMove, label: string, shortcutId?: string, icon?: React.ReactNode) => {
      const sc = shortcutId ? getCommandDef(shortcutId) : undefined;
      return (
        <button
          key={move}
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start text-xs hover:bg-muted"
          onClick={() => {
            onAction({ type: 'layer-move', move });
            onClose();
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            {icon}
            <span className="whitespace-nowrap">{label}</span>
          </span>
          {sc ? (
            <kbd className="shrink-0 whitespace-nowrap font-mono text-[9px] text-gray-400">
              {formatBindings(sc.defaults)}
            </kbd>
          ) : null}
        </button>
      );
    };
    return (
      <>
        <ContextSubmenu
          label={t('boards.arrange.bringToFront', 'Bring to Front')}
          icon={<IconLayerFront />}
        >
          {layerItem('front', t('boards.arrange.front', 'Bring to Front'), 'arrange.front', <IconLayerFront />)}
          {layerItem('forward', t('boards.arrange.forward', 'Bring Forward'), 'arrange.forward', <IconLayerForward />)}
        </ContextSubmenu>
        <ContextSubmenu
          label={t('boards.arrange.sendToBack', 'Send to Back')}
          icon={<IconLayerBack />}
        >
          {layerItem('back', t('boards.arrange.back', 'Send to Back'), 'arrange.back', <IconLayerBack />)}
          {layerItem('backward', t('boards.arrange.backward', 'Send Backward'), 'arrange.backward', <IconLayerBackward />)}
        </ContextSubmenu>
        {sep()}
      </>
    );
  };

  const shapeItem = (objectId: string, shape: BoardNodeShape, label: string) => {
    const isActive = activeNodeShape === shape;
    return (
      <button
        type="button"
        key={shape}
        className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-start text-xs hover:bg-muted ${
          isActive ? 'bg-muted/60 font-medium' : ''
        }`}
        onClick={() => {
          onAction({ type: 'set-node-shape', id: objectId, shape });
          onClose();
        }}
      >
        <span>{label}</span>
        {isActive ? <span className="text-[10px] text-primary">✓</span> : null}
      </button>
    );
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-md border border-muted bg-white py-1 shadow-lg dark:bg-gray-100"
      style={{ left: x, top: y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {hit.kind === 'canvas' ? (
        <>
          {item(t('boards.context.addSticky', 'Add sticky here'), () =>
            onAction({ type: 'add-sticky', worldX: hit.worldX, worldY: hit.worldY })
          )}
          {item(t('boards.context.addNode', 'Add node here'), () =>
            onAction({ type: 'add-node', worldX: hit.worldX, worldY: hit.worldY })
          )}
          {item(t('boards.context.addImage', 'Add image here'), () =>
            onAction({ type: 'add-image', worldX: hit.worldX, worldY: hit.worldY })
          )}
          {item(t('boards.context.addFrame', 'Add frame here'), () =>
            onAction({ type: 'add-frame', worldX: hit.worldX, worldY: hit.worldY })
          )}
          {item(t('boards.context.importShape', 'Import shape…'), () => onAction({ type: 'import-shape' }))}
          {canPaste
            ? item(t('boards.context.paste', 'Paste'), () => onAction({ type: 'paste' }), 'edit.paste')
            : null}
          {sep()}
          {item(t('boards.context.fitAll', 'Fit all'), () => onAction({ type: 'fit-all' }), 'view.fit')}
          {item(t('boards.context.centerView', 'Center view'), () => onAction({ type: 'center-view' }))}
          {item(
            snapEnabled
              ? t('boards.context.snapOff', 'Disable snap to grid')
              : t('boards.context.snapOn', 'Enable snap to grid'),
            () => onAction({ type: 'toggle-snap' }),
            'view.toggleSnap'
          )}
          {item(t('boards.context.clearSelection', 'Clear selection'), () =>
            onAction({ type: 'clear-selection' })
          )}
        </>
      ) : null}

      {hit.kind === 'object' ? (
        <>
          {hit.objectType === 'node' ? (
            <>
              {item(t('boards.context.editLabel', 'Edit label'), () =>
                onAction({ type: 'edit-node-label', id: hit.id })
              )}
              {item(t('boards.context.startConnection', 'Start connection'), () =>
                onAction({ type: 'start-connection', nodeId: hit.id })
              )}
              {sep()}
              <div className="px-3 py-1 text-[9px] font-medium uppercase text-gray-400">
                {t('boards.shape.title', 'Shape')}
              </div>
              {NODE_SHAPE_OPTIONS.map(({ shape, labelKey }) =>
                shapeItem(hit.id, shape, t(labelKey, shape))
              )}
              {sep()}
            </>
          ) : null}
          {hit.objectType === 'connector' ? (
            <>
              {item(t('boards.context.editLabel', 'Edit label'), () =>
                onAction({ type: 'edit-connector-label', id: hit.id })
              )}
              {item(t('boards.context.reverseEdge', 'Reverse direction'), () =>
                onAction({ type: 'reverse-connector', id: hit.id })
              )}
              {sep()}
            </>
          ) : null}
          {hit.objectType === 'vector' ? (
            <>
              {item(t('boards.context.editPath', 'Edit points'), () =>
                onAction({ type: 'edit-path', id: hit.id })
              )}
              {item(t('boards.context.convertToNode', 'Convert to node'), () =>
                onAction({ type: 'convert-to-node', id: hit.id })
              )}
              {sep()}
            </>
          ) : null}
          {hit.objectType === 'sticky' || hit.objectType === 'frame' ? (
            <>
              {item(t('boards.context.editLabel', 'Edit label'), () =>
                onAction({ type: 'edit-node-label', id: hit.id })
              )}
              {sep()}
            </>
          ) : null}
          {item(t('boards.context.duplicate', 'Duplicate'), () => onAction({ type: 'duplicate' }), 'edit.duplicate')}
          {spatialSelectionCount >= 2
            ? item(t('boards.group.title', 'Group'), () => onAction({ type: 'group-selection' }))
            : null}
          {canUngroup
            ? item(t('boards.group.ungroup', 'Ungroup'), () => onAction({ type: 'ungroup-selection' }))
            : null}
          {nodeSelectionCount >= 2
            ? item(t('boards.link.syncMove', 'Link for synchronized move'), () =>
                onAction({ type: 'link-nodes-move' })
              )
            : null}
          {nodeSelectionCount >= 2
            ? item(t('boards.link.connected', 'Link connected nodes'), () =>
                onAction({ type: 'link-connected-nodes' })
              )
            : null}
          {canUnlinkNodes
            ? item(t('boards.link.unlinkMove', 'Unlink synchronized move'), () =>
                onAction({ type: 'unlink-nodes-move' })
              )
            : null}
          {(spatialSelectionCount >= 2 || canUngroup || nodeSelectionCount >= 2 || canUnlinkNodes) ? sep() : null}
          {arrangeBlock()}
          {selectionCount >= 2 ? (
            <>
              <ContextSubmenu
                label={t('boards.boolean.title', 'Combine shapes')}
                icon={<IconBooleanUnion />}
              >
                {(
                  [
                    ['union', <IconBooleanUnion key="u" />],
                    ['subtract', <IconBooleanSubtract key="s" />],
                    ['intersect', <IconBooleanIntersect key="i" />],
                    ['exclude', <IconBooleanExclude key="e" />],
                  ] as const
                ).map(([op, icon]) => (
                  <button
                    key={op}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs hover:bg-muted"
                    onClick={() => {
                      onAction({ type: 'boolean-combine', op });
                      onClose();
                    }}
                  >
                    {icon}
                    <span>{t(`boards.boolean.${op}`, op)}</span>
                  </button>
                ))}
              </ContextSubmenu>
              {sep()}
            </>
          ) : null}
          {item(t('boards.context.lock', 'Toggle lock'), () => onAction({ type: 'lock-toggle' }))}
          {item(t('boards.context.copyId', 'Copy object ID'), () => onAction({ type: 'copy-id', id: hit.id }))}
          {sep()}
          {item(t('boards.context.delete', 'Delete'), () => onAction({ type: 'delete' }), 'edit.delete')}
        </>
      ) : null}

      {hit.kind === 'ink' ? (
        <>
          {item(t('boards.context.deleteInk', 'Delete stroke'), () =>
            onAction({ type: 'delete-ink', id: hit.id })
          )}
        </>
      ) : null}
    </div>
  );
}
