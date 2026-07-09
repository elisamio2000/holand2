'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import TopologyCanvas2D from './components/topology-canvas-2d';
import TopologyToolbar from './components/topology-toolbar';
import TopologyInspector from './components/topology-inspector';
import TopologyStatsBar from './components/topology-stats-bar';
import ApiCapabilityFootnote from './components/api-capability-footnote';
import TopologyEntityPaletteContent from './components/topology-entity-palette-content';
import TopologyFilterSidebarContent from './components/topology-filter-sidebar-content';
import TopologyMiniMap from './components/topology-minimap';
import AddEntityModal, { type AddEntityModalConfig } from './components/add-entity-modal';
import CreateRouteModal from './components/create-route-modal';
import SimulationModal from './components/simulation-modal';
import { useTopologyUrlFilters } from './hooks/use-topology-url-filters';
import OnboardingTour from './components/onboarding-tour';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { adminRemoteNodesService } from '@/services/admin-remote-nodes.service';
import type { TopologyPipelineData } from './helpers/topology-board-types';
import { useTopologyBoardSettingsStore } from './helpers/topology-board-settings';
import { layoutTopologyGraph } from './helpers/layout-elk';
import { entityNodeId } from './helpers/topology-board-types';
import { fetchServerLayout } from './helpers/topology-layout-api';
import { useTopologyBoardStore } from './store/topology-board-store';
import type { EntityValues } from '../entity-settings/build-entity-values';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import NodeSettingsModal from '../entity-settings/node-settings-modal';
import { prefetchEntitySchemas } from '../entity-settings/get-entity-schema';
import ZenFloatingToolbar from './components/zen-floating-toolbar';
import { BoardPanelShell } from '@/app/shared/user-boards/board-editor/components/board-panel-shell';
import type { BoardPanelMode } from '@/app/shared/user-boards/lib/board-panel-prefs';
import {
  patchTopologyPanel,
  readTopologyPanelPrefs,
  writeTopologyPanelPrefs,
  type TopologyPanelPrefs,
} from './helpers/topology-panel-prefs';

interface Props {
  pipelineData: TopologyPipelineData;
  onRefresh: () => Promise<void>;
}

function BoardShell({ pipelineData, onRefresh }: Props) {
  const { t } = useTranslation();
  const [panelPrefs, setPanelPrefs] = useState<TopologyPanelPrefs>(() => readTopologyPanelPrefs());
  const [addModalConfig, setAddModalConfig] = useState<AddEntityModalConfig | null>(null);
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [pendingDropPosition, setPendingDropPosition] = useState<{ x: number; y: number } | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [tourStartSignal, setTourStartSignal] = useState(0);

  const zenMode = useTopologyBoardSettingsStore((s) => s.zenMode);
  const fullscreenMode = useTopologyBoardSettingsStore((s) => s.fullscreenMode);
  const showMinimap = useTopologyBoardSettingsStore((s) => s.showMinimap);
  const minimapAuto = useTopologyBoardSettingsStore((s) => s.minimapAuto);
  const minimapThreshold = useTopologyBoardSettingsStore((s) => s.minimapThreshold);
  const patchSettings = useTopologyBoardSettingsStore((s) => s.patchSettings);
  const layoutAlgorithm = useTopologyBoardSettingsStore((s) => s.layoutAlgorithm);
  const clusterMode = useTopologyBoardSettingsStore((s) => s.clusterMode);
  const setGraph = useTopologyBoardStore((s) => s.setGraph);
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const edges = useTopologyBoardStore((s) => s.edges);
  const selectedNodeIds = useTopologyBoardStore((s) => s.selectedNodeIds);
  const pipelineDataStore = useTopologyBoardStore((s) => s.pipelineData);
  const addEntityNode = useTopologyBoardStore((s) => s.addEntityNode);
  const markClean = useTopologyBoardStore((s) => s.markClean);
  const hydrateSettings = useTopologyBoardSettingsStore((s) => s.hydrate);
  const advancedSettingsNodeId = useTopologyBoardStore((s) => s.advancedSettingsNodeId);
  const openAdvancedSettings = useTopologyBoardStore((s) => s.openAdvancedSettings);
  const closeAdvancedSettings = useTopologyBoardStore((s) => s.closeAdvancedSettings);
  const advancedNode = nodes.find((n) => n.id === advancedSettingsNodeId) ?? null;

  const showMinimapPanel =
    showMinimap && (!minimapAuto || nodes.length >= minimapThreshold);

  const patchPanel = useCallback((id: keyof TopologyPanelPrefs, patch: Partial<TopologyPanelPrefs['palette']>) => {
    setPanelPrefs((prev) => {
      const next = patchTopologyPanel(prev, id, patch);
      writeTopologyPanelPrefs(next);
      return next;
    });
  }, []);

  const togglePanel = useCallback((id: keyof TopologyPanelPrefs) => {
    patchPanel(id, { visible: !panelPrefs[id].visible });
  }, [panelPrefs, patchPanel]);

  const handleLayout = useCallback(async () => {
    try {
      const laid = await layoutTopologyGraph(nodes, edges, clusterMode, layoutAlgorithm);
      setGraph(laid, edges);
      toast.success(t('pipeline.topology.board.layoutApplied', 'Layout applied'));
    } catch {
      toast.error(t('common.error'));
    }
  }, [clusterMode, layoutAlgorithm, nodes, edges, setGraph, t]);

  const handleSave = useCallback(async () => {
    if (!pipelineDataStore) return;
    const { saveTopologyToApi } = await import('./helpers/save-to-api');
    try {
      const result = await saveTopologyToApi(
        nodes,
        edges,
        pipelineDataStore.bindings,
        pipelineDataStore.pluginBindings
      );
      markClean();
      if (result.errors.length) {
        const failed = result.entityResults.filter((r) => !r.ok);
        const detail = failed.map((r) => `${r.kind}:${r.id}`).join(', ');
        toast.error(
          t('pipeline.topology.board.savePartial', {
            count: result.errors.length,
            defaultValue: `${result.errors.length} failed: ${detail}`,
          })
        );
      } else {
        toast.success(
          t('pipeline.topology.board.saveSuccess', {
            tools: result.toolsSaved,
            routes: result.routesSaved,
          })
        );
      }
      await onRefresh();
    } catch {
      toast.error(t('common.error'));
    }
  }, [nodes, edges, pipelineDataStore, markClean, onRefresh, t]);

  const handleRequestAdd = useCallback(
    (config: AddEntityModalConfig, position?: { x: number; y: number }) => {
      setAddModalConfig(config);
      setPendingDropPosition(position ?? null);
    },
    []
  );

  const handleConfirmAdd = useCallback(
    (config: AddEntityModalConfig, values: EntityValues) => {
      const dataPatch: Record<string, unknown> = {};
      if (config.kind === 'tool') {
        dataPatch.binding = {
          model: values.model,
          fallback_model: values.fallback_model,
          api: values.api,
        };
      }
      if (config.kind === 'route') {
        dataPatch.route = {
          route_key: config.entityId,
          model_name: values.model_name,
          fallback_model_name: values.fallback_model_name,
          is_active: values.is_active,
        };
      }
      addEntityNode(
        config.kind,
        config.entityId,
        config.label,
        pendingDropPosition ?? undefined,
        dataPatch
      );
      setPendingDropPosition(null);
    },
    [addEntityNode, pendingDropPosition]
  );

  const closeAddModal = useCallback(() => {
    setAddModalConfig(null);
    setPendingDropPosition(null);
  }, []);

  const handleRouteCreated = useCallback(
    async (routeKey: string) => {
      await onRefresh();
      const data = useTopologyBoardStore.getState().pipelineData;
      if (data) {
        useTopologyBoardStore.getState().hydrate(data);
      }
      addEntityNode('route', routeKey, routeKey);
      useTopologyBoardStore.getState().setSelectedNodeId(entityNodeId('route', routeKey));
    },
    [addEntityNode, onRefresh]
  );

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  useTopologyUrlFilters();

  useEffect(() => {
    void fetchServerLayout();
    void prefetchEntitySchemas([
      'tool',
      'plugin',
      'route',
      'role',
      'model',
      'endpoint',
      'remoteNode',
      'service',
      'group',
      'edge',
    ]);
  }, []);

  useEffect(() => {
    if (zenMode) {
      setPanelPrefs((prev) => {
        const next = {
          palette: { ...prev.palette, visible: false },
          filter: { ...prev.filter, visible: false },
          inspector: { ...prev.inspector, visible: false },
        };
        writeTopologyPanelPrefs(next);
        return next;
      });
    }
  }, [zenMode]);

  const shellClass = fullscreenMode
    ? 'fixed inset-0 z-[100] flex flex-col bg-gray-0 dark:bg-gray-50'
    : 'overflow-hidden';

  const renderPalettePanel = (mode: BoardPanelMode, docked: boolean) => (
    <BoardPanelShell
      id="topology-palette"
      title={t('pipeline.topology.board.palette', 'Palette')}
      visible
      mode={mode}
      side="left"
      defaultWidth={200}
      minWidth={176}
      maxWidth={320}
      supportsPopout={false}
      onModeChange={(m) => patchPanel('palette', { mode: m })}
      onClose={() => patchPanel('palette', { visible: false })}
      className={docked ? 'h-full shrink-0' : undefined}
    >
      <TopologyEntityPaletteContent onRequestAdd={handleRequestAdd} />
    </BoardPanelShell>
  );

  const renderFilterPanel = (mode: BoardPanelMode, docked: boolean) => (
    <BoardPanelShell
      id="topology-filter"
      title={t('pipeline.topology.board.displayFilter', 'Display filter')}
      visible
      mode={mode}
      side="left"
      defaultWidth={232}
      minWidth={200}
      maxWidth={320}
      supportsPopout={false}
      onModeChange={(m) => patchPanel('filter', { mode: m })}
      onClose={() => patchPanel('filter', { visible: false })}
      className={docked ? 'h-full shrink-0' : undefined}
    >
      <TopologyFilterSidebarContent />
    </BoardPanelShell>
  );

  const renderInspectorPanel = (mode: BoardPanelMode, docked: boolean) => (
    <BoardPanelShell
      id="topology-inspector"
      title={t('pipeline.topology.board.inspector', 'Inspector')}
      visible
      mode={mode}
      side="right"
      defaultWidth={288}
      minWidth={240}
      maxWidth={480}
      supportsPopout={false}
      onModeChange={(m) => patchPanel('inspector', { mode: m })}
      onClose={() => patchPanel('inspector', { visible: false })}
      className={docked ? 'h-full shrink-0' : undefined}
    >
      <TopologyInspector embedded onRefresh={onRefresh} onOpenAdvanced={openAdvancedSettings} />
    </BoardPanelShell>
  );

  return (
    <div className={shellClass}>
      <TopologyToolbar
        onRefresh={onRefresh}
        zenMode={zenMode}
        fullscreenMode={fullscreenMode}
        onToggleZen={() => patchSettings({ zenMode: !zenMode })}
        onToggleFullscreen={() => {
          const el = document.documentElement;
          if (!document.fullscreenElement) {
            void el.requestFullscreen?.();
            patchSettings({ fullscreenMode: true });
          } else {
            void document.exitFullscreen?.();
            patchSettings({ fullscreenMode: false });
          }
        }}
        onSimulate={() => setSimulationOpen(true)}
        onStartTour={() => setTourStartSignal((n) => n + 1)}
        onTogglePalette={() => togglePanel('palette')}
        onToggleFilter={() => togglePanel('filter')}
        onToggleInspector={() => togglePanel('inspector')}
        paletteVisible={panelPrefs.palette.visible}
        filterVisible={panelPrefs.filter.visible}
        inspectorVisible={panelPrefs.inspector.visible}
        minimapVisible={showMinimapPanel}
        onToggleMinimap={() => patchSettings({ showMinimap: !showMinimap })}
        onCreateRoute={() => setCreateRouteOpen(true)}
      />

      {!zenMode && <TopologyStatsBar />}

      <div
        className={
          fullscreenMode
            ? 'flex min-h-0 flex-1'
            : 'flex min-h-[480px] h-[clamp(480px,62vh,680px)]'
        }
      >
        {!zenMode &&
          panelPrefs.palette.visible &&
          panelPrefs.palette.mode === 'docked' &&
          renderPalettePanel('docked', true)}

        {!zenMode &&
          panelPrefs.filter.visible &&
          panelPrefs.filter.mode === 'docked' &&
          renderFilterPanel('docked', true)}

        <div className="relative min-w-0 flex-1">
          <TopologyCanvas2D
            onSave={handleSave}
            onLayout={handleLayout}
            onRequestAdd={handleRequestAdd}
          />
          {!zenMode && showMinimapPanel && (
            <TopologyMiniMap onClose={() => patchSettings({ showMinimap: false })} />
          )}
          {zenMode && (
            <ZenFloatingToolbar
              onSave={handleSave}
              onToggleZen={() => patchSettings({ zenMode: false })}
              onToggleFullscreen={() => {
                const el = document.documentElement;
                if (!document.fullscreenElement) {
                  void el.requestFullscreen?.();
                  patchSettings({ fullscreenMode: true });
                } else {
                  void document.exitFullscreen?.();
                  patchSettings({ fullscreenMode: false });
                }
              }}
            />
          )}
          {!zenMode && <OnboardingTour startSignal={tourStartSignal} />}
        </div>

        {!zenMode &&
          panelPrefs.inspector.visible &&
          panelPrefs.inspector.mode === 'docked' &&
          renderInspectorPanel('docked', true)}
      </div>

      {!zenMode && panelPrefs.palette.visible && panelPrefs.palette.mode !== 'docked' &&
        renderPalettePanel(panelPrefs.palette.mode, false)}
      {!zenMode && panelPrefs.filter.visible && panelPrefs.filter.mode !== 'docked' &&
        renderFilterPanel(panelPrefs.filter.mode, false)}
      {!zenMode && panelPrefs.inspector.visible && panelPrefs.inspector.mode !== 'docked' &&
        renderInspectorPanel(panelPrefs.inspector.mode, false)}

      {!zenMode && <ApiCapabilityFootnote />}

      <NodeSettingsModal
        open={!!advancedNode}
        node={advancedNode}
        pipelineData={pipelineDataStore}
        onClose={closeAdvancedSettings}
        onRefresh={onRefresh}
      />

      <AddEntityModal
        open={!!addModalConfig}
        config={addModalConfig}
        pipelineData={pipelineDataStore}
        onConfirm={handleConfirmAdd}
        onClose={closeAddModal}
      />

      <CreateRouteModal
        open={createRouteOpen}
        models={pipelineDataStore?.models ?? pipelineData.models}
        logicalCatalog={pipelineDataStore?.logicalCatalog ?? pipelineData.logicalCatalog}
        onClose={() => setCreateRouteOpen(false)}
        onCreated={handleRouteCreated}
      />

      <SimulationModal
        open={simulationOpen}
        onClose={() => setSimulationOpen(false)}
        nodes={nodes}
        edges={edges}
        routes={pipelineDataStore?.routes ?? pipelineData.routes}
        models={pipelineDataStore?.models ?? pipelineData.models}
        tools={pipelineDataStore?.tools ?? pipelineData.tools}
        selectedNodeIds={selectedNodeIds}
      />
    </div>
  );
}

export default function TopologyBoardView(props: Props) {
  return (
    <ReactFlowProvider>
      <BoardShell {...props} />
    </ReactFlowProvider>
  );
}

export async function loadTopologyPipelineData(): Promise<TopologyPipelineData> {
  const base = await pipelineAdminService.loadAllV2();
  const [pluginBindings, serviceBindings, remoteNodes, pools] = await Promise.all([
    pipelineAdminService.listPluginBindings().catch(() => ({})),
    pipelineAdminService.listServiceBindings().catch(() => []),
    adminRemoteNodesService.listRemoteNodes({ live: false }).catch(() => []),
    pipelineAdminService.listPools().catch(() => []),
  ]);
  return {
    ...base,
    pluginBindings,
    serviceBindings,
    remoteNodes,
    pools,
  };
}
