'use client';



import { useCallback, useMemo, useRef } from 'react';

import { Button, Text } from 'rizzui';

import { useTranslation } from 'react-i18next';

import { useRouter } from 'next/navigation';

import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi';

import { useTopologyBoardStore } from '../store/topology-board-store';

import { useTopologyBoardSettingsStore } from '../helpers/topology-board-settings';

import NodeSettingsPanel from '../../entity-settings/node-settings-panel';

import TopologyEdgeInspector from './topology-edge-inspector';

import MultiSelectSummary from './multi-select-summary';

import GraphOverview from './graph-overview';

import { buildPipelineUrl } from '../../helpers/pipeline-tab-url';

import { entityNodeId } from '../helpers/topology-board-types';

import { useTopologySelectionStore } from '../../store/topology-selection-store';



interface Props {

  collapsed?: boolean;

  onToggleCollapse?: () => void;

  embedded?: boolean;

  onRefresh: () => Promise<void>;

  onOpenAdvanced?: (nodeId: string) => void;

}



export default function TopologyInspector({

  collapsed,

  onToggleCollapse,

  embedded = false,

  onRefresh,

  onOpenAdvanced,

}: Props) {

  const { t } = useTranslation();

  const router = useRouter();

  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  const selectedNodeId = useTopologyBoardStore((s) => s.selectedNodeId);

  const selectedNodeIds = useTopologyBoardStore((s) => s.selectedNodeIds);

  const selectedEdgeId = useTopologyBoardStore((s) => s.selectedEdgeId);

  const nodes = useTopologyBoardStore((s) => s.nodes);

  const edges = useTopologyBoardStore((s) => s.edges);

  const catalog = useTopologyBoardStore((s) => s.catalog);

  const placedNodeIds = useTopologyBoardStore((s) => s.placedNodeIds);

  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);

  const setSelectedNodeIds = useTopologyBoardStore((s) => s.setSelectedNodeIds);

  const createGroupFromSelection = useTopologyBoardStore((s) => s.createGroupFromSelection);

  const inspectorWidth = useTopologyBoardSettingsStore((s) => s.inspectorWidth);

  const patchSettings = useTopologyBoardSettingsStore((s) => s.patchSettings);



  const node = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));

  const unboundCatalog = catalog.filter(

    (e) => e.kind === 'tool' && !placedNodeIds.includes(e.nodeId)

  );

  const unboundToolsCount = useMemo(() => {
    const tools = pipelineData?.tools ?? [];
    const bindings = pipelineData?.bindings ?? {};
    return tools.filter((tool) => !bindings[tool.tool_id]?.model).length;
  }, [pipelineData]);

  const fixUnboundInGraph = useCallback(() => {
    const tools = pipelineData?.tools ?? [];
    const bindings = pipelineData?.bindings ?? {};
    const placedSet = new Set(placedNodeIds);
    const highlightIds = tools
      .filter((tool) => !bindings[tool.tool_id]?.model)
      .map((tool) => entityNodeId('tool', tool.tool_id))
      .filter((id) => placedSet.has(id));
    if (highlightIds.length === 0) {
      const firstUnbound = tools.find((tool) => !bindings[tool.tool_id]?.model);
      if (firstUnbound) {
        router.push(
          buildPipelineUrl('topology', {
            lens: 'graph',
            focus: `tool:${firstUnbound.tool_id}`,
            highlight: entityNodeId('tool', firstUnbound.tool_id),
          })
        );
      }
      return;
    }
    useTopologySelectionStore.getState().setHighlightedNodeIds(highlightIds);
    useTopologyBoardStore.getState().setSelectedNodeIds(highlightIds.slice(0, 1));
  }, [pipelineData, placedNodeIds, router]);

  const fixUnboundInTable = useCallback(() => {
    router.push(buildPipelineUrl('topology', { unbound: true, lens: 'graph' }));
  }, [router]);



  const onResizeStart = useCallback(

    (e: React.MouseEvent) => {

      e.preventDefault();

      resizeRef.current = { startX: e.clientX, startW: inspectorWidth };

      const onMove = (ev: MouseEvent) => {

        if (!resizeRef.current) return;

        const delta = resizeRef.current.startX - ev.clientX;

        const next = Math.min(480, Math.max(240, resizeRef.current.startW + delta));

        patchSettings({ inspectorWidth: next });

      };

      const onUp = () => {

        resizeRef.current = null;

        window.removeEventListener('mousemove', onMove);

        window.removeEventListener('mouseup', onUp);

      };

      window.addEventListener('mousemove', onMove);

      window.addEventListener('mouseup', onUp);

    },

    [inspectorWidth, patchSettings]

  );



  if (collapsed && !embedded) {

    return (

      <div className="flex h-full w-10 flex-col items-center border-l border-muted bg-gray-0 py-2 dark:bg-gray-50">

        <Button size="sm" variant="text" onClick={onToggleCollapse} aria-label="Expand inspector">

          <PiCaretLeftBold className="h-4 w-4" />

        </Button>

      </div>

    );

  }



  const panelStyle = embedded
    ? undefined
    : { width: inspectorWidth, minWidth: inspectorWidth, maxWidth: inspectorWidth };

  const shellClass = embedded
    ? 'flex h-full min-h-0 flex-col overflow-hidden'
    : 'relative flex h-full flex-col border-l border-muted bg-gray-0 dark:bg-gray-50';

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto" data-tour="topology-inspector">
        {selectedEdgeId ? (
          <TopologyEdgeInspector onRefresh={onRefresh} />
        ) : selectedNodeIds.length > 1 ? (
          <MultiSelectSummary
            nodes={selectedNodes}
            onClear={() => setSelectedNodeIds([])}
            onGroup={() =>
              createGroupFromSelection(t('pipeline.topology.board.groupDefault', 'Group'))
            }
          />
        ) : !node ? (
          <GraphOverview
            placedCount={placedNodeIds.length}
            catalogCount={catalog.length}
            edgeCount={edges.length}
            unboundCatalog={unboundCatalog}
            unboundToolsCount={unboundToolsCount}
            onFixUnboundInTable={fixUnboundInTable}
            onFixUnboundInGraph={fixUnboundInGraph}
          />
        ) : (
          <>
            {onOpenAdvanced && (
              <div className="flex justify-end border-b border-muted px-2 py-1">
                <Button size="sm" variant="text" onClick={() => onOpenAdvanced(node.id)}>
                  {t('pipeline.settings.expand', 'Advanced')}
                </Button>
              </div>
            )}
            <NodeSettingsPanel
              node={node}
              pipelineData={pipelineData}
              onRefresh={onRefresh}
              mode="compact"
            />
          </>
        )}
      </div>
    );
  }

  if (selectedEdgeId) {

    return (

      <div

        className="relative flex h-full flex-col border-l border-muted bg-gray-0 dark:bg-gray-50"
        data-tour="topology-inspector"

        style={panelStyle}

      >

        <div

          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"

          onMouseDown={onResizeStart}

          aria-hidden

        />

        <div className="flex items-center border-b border-muted p-2">

          <Button size="sm" variant="text" onClick={onToggleCollapse}>

            <PiCaretRightBold className="h-4 w-4" />

          </Button>

        </div>

        <TopologyEdgeInspector onRefresh={onRefresh} />

      </div>

    );

  }



  if (selectedNodeIds.length > 1) {

    return (

      <div

        className="relative flex h-full flex-col overflow-y-auto border-l border-muted bg-gray-0 dark:bg-gray-50"

        style={panelStyle}

      >

        <div

          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"

          onMouseDown={onResizeStart}

          aria-hidden

        />

        <div className="flex items-center border-b border-muted p-2">

          <Text className="flex-1 px-1 text-sm font-semibold">

            {t('pipeline.topology.board.inspector', 'Inspector')}

          </Text>

          <Button size="sm" variant="text" onClick={onToggleCollapse}>

            <PiCaretRightBold className="h-4 w-4" />

          </Button>

        </div>

        <MultiSelectSummary

          nodes={selectedNodes}

          onClear={() => setSelectedNodeIds([])}

          onGroup={() => createGroupFromSelection(t('pipeline.topology.board.groupDefault', 'Group'))}

        />

      </div>

    );

  }



  if (!node) {

    return (

      <div

        className="relative flex h-full flex-col border-l border-muted bg-gray-0 dark:bg-gray-50"
        data-tour="topology-inspector"

        style={panelStyle}

      >

        <div

          className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"

          onMouseDown={onResizeStart}

          aria-hidden

        />

        <div className="flex items-center border-b border-muted p-2">

          <Text className="flex-1 px-1 text-sm font-semibold">

            {t('pipeline.topology.board.inspector', 'Inspector')}

          </Text>

          <Button size="sm" variant="text" onClick={onToggleCollapse}>

            <PiCaretRightBold className="h-4 w-4" />

          </Button>

        </div>

        <GraphOverview

          placedCount={placedNodeIds.length}

          catalogCount={catalog.length}

          edgeCount={edges.length}

          unboundCatalog={unboundCatalog}

          unboundToolsCount={unboundToolsCount}

          onFixUnboundInTable={fixUnboundInTable}

          onFixUnboundInGraph={fixUnboundInGraph}

        />

      </div>

    );

  }



  return (

    <div

      className="relative flex h-full flex-col overflow-y-auto border-l border-muted bg-gray-0 dark:bg-gray-50"

      style={panelStyle}

    >

      <div

        className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"

        onMouseDown={onResizeStart}

        aria-hidden

      />

      <div className="flex items-center border-b border-muted p-2">

        <Button size="sm" variant="text" onClick={onToggleCollapse}>

          <PiCaretRightBold className="h-4 w-4" />

        </Button>

        {onOpenAdvanced && (

          <Button

            size="sm"

            variant="text"

            className="ms-auto text-xs"

            onClick={() => onOpenAdvanced(node.id)}

          >

            {t('pipeline.settings.expand', 'Advanced')}

          </Button>

        )}

      </div>

      <NodeSettingsPanel

        node={node}

        pipelineData={pipelineData}

        mode="compact"

        onRefresh={onRefresh}

      />

    </div>

  );

}

