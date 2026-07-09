'use client';

import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useTopologyBoardStore } from '../store/topology-board-store';

interface Props {
  x: number;
  y: number;
  nodeId?: string;
  onClose: () => void;
  onAutoLayout: () => void;
}

export default function TopologyContextMenu({
  x,
  y,
  nodeId,
  onClose,
  onAutoLayout,
}: Props) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const removeNode = useTopologyBoardStore((s) => s.removeNode);
  const duplicateNode = useTopologyBoardStore((s) => s.duplicateNode);
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const nodeKind = nodeId ? nodes.find((n) => n.id === nodeId)?.data.kind : null;
  const canDuplicate = nodeKind === 'group';
  const updateNodeData = useTopologyBoardStore((s) => s.updateNodeData);
  const toggleEdgeKind = useTopologyBoardStore((s) => s.toggleEdgeKind);
  const createGroupFromSelection = useTopologyBoardStore((s) => s.createGroupFromSelection);
  const selectedEdgeId = useTopologyBoardStore((s) => s.selectedEdgeId);

  const run = useCallback(
    (fn: () => void) => {
      fn();
      onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-lg border border-muted bg-white py-1 shadow-xl dark:bg-gray-50"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {nodeId && (
        <>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
            onClick={() =>
              run(() => updateNodeData(nodeId, { muted: !useTopologyBoardStore.getState().nodes.find((n) => n.id === nodeId)?.data.muted }))
            }
          >
            {t('pipeline.topology.board.context.bypass', 'Toggle bypass')}
          </button>
          <button
            type="button"
            className={`block w-full px-3 py-1.5 text-left text-xs ${
              canDuplicate ? 'hover:bg-gray-100' : 'cursor-not-allowed text-gray-400'
            }`}
            disabled={!canDuplicate}
            title={
              canDuplicate
                ? undefined
                : t(
                    'pipeline.topology.board.context.duplicateDisabled',
                    'API-backed nodes cannot be duplicated — use groups for visual clusters'
                  )
            }
            onClick={() => canDuplicate && run(() => duplicateNode(nodeId))}
          >
            {t('pipeline.topology.board.context.duplicate', 'Duplicate')}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
            onClick={() => run(() => removeNode(nodeId))}
          >
            {t('pipeline.topology.board.context.delete', 'Delete node')}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
            onClick={() => run(() => createGroupFromSelection('Cluster'))}
          >
            {t('pipeline.topology.board.context.group', 'Group selection (Ctrl+G)')}
          </button>
        </>
      )}
      {selectedEdgeId && (
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
          onClick={() => run(() => toggleEdgeKind(selectedEdgeId))}
        >
          {t('pipeline.topology.board.context.toggleLoop', 'Toggle primary / loop')}
        </button>
      )}
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
        onClick={() => run(onAutoLayout)}
      >
        {t('pipeline.topology.board.context.layout', 'Auto layout (Ctrl+L)')}
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100"
        onClick={() => run(() => fitView({ padding: 0.2 }))}
      >
        {t('pipeline.topology.board.context.fit', 'Fit view (Ctrl+0)')}
      </button>
    </div>
  );
}
