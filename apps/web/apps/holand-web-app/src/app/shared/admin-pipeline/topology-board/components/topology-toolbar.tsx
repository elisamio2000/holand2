'use client';



import { Tooltip } from '@/components/tooltip';
import { useCallback, useRef, useState } from 'react';

import { Text, ActionIcon, Popover } from 'rizzui';

import { useTranslation } from 'react-i18next';

import {

  PiArrowCounterClockwiseBold,

  PiArrowClockwiseBold,

  PiFloppyDiskBold,

  PiArrowClockwiseBold as PiRefreshBold,

  PiDownloadBold,

  PiUploadBold,

  PiSquaresFourBold,

  PiCheckCircleBold,

  PiMagnifyingGlassPlusBold,

  PiMagnifyingGlassMinusBold,

  PiArrowsOutBold,

  PiGearBold,

  PiPlayBold,

  PiCornersOutBold,

  PiEyeBold,

  PiQuestionBold,

  PiFlowArrowBold,

} from 'react-icons/pi';

import { useReactFlow } from '@xyflow/react';

import toast from 'react-hot-toast';

import { useTopologyBoardStore } from '../store/topology-board-store';

import type { TopologyEdge, TopologyNode } from '../helpers/topology-board-types';

import { useTopologyBoardSettingsStore, type TopologyLayoutAlgorithm, type TopologyClusterMode } from '../helpers/topology-board-settings';

import { layoutTopologyGraph } from '../helpers/layout-elk';

import { exportTopologyJson, importTopologyJsonFromFile } from '../helpers/layout-storage';

import { validateTopologyGraph } from '../helpers/validate-topology-graph';

import { saveTopologyToApi } from '../helpers/save-to-api';

import { TopologyDisplaySettingsContent } from './topology-display-panel';

import PipelineAdminDrawer from '../../components/pipeline-admin-drawer';

import TopologyShortcutsHelp from './topology-shortcuts-help';

import { activeFilterCount } from '../helpers/display-filter';
import { useTopologyDisplayFilterStore } from '../store/topology-display-filter-store';
import {
  PiSidebarSimpleBold,
  PiListMagnifyingGlassBold,
  PiColumnsBold,
  PiBrainBold,
  PiCpuBold,
  PiCirclesFourBold,
  PiMapTrifoldBold,
  PiFunnelBold,
} from 'react-icons/pi';



interface Props {

  onRefresh: () => Promise<void>;

  onSaveComplete?: () => void;

  zenMode?: boolean;

  fullscreenMode?: boolean;

  onToggleZen?: () => void;

  onToggleFullscreen?: () => void;

  onSimulate?: () => void;

  onStartTour?: () => void;

  onTogglePalette?: () => void;

  onToggleFilter?: () => void;

  onToggleInspector?: () => void;

  paletteVisible?: boolean;

  filterVisible?: boolean;

  inspectorVisible?: boolean;

  minimapVisible?: boolean;

  onToggleMinimap?: () => void;

  onCreateRoute?: () => void;

}



export default function TopologyToolbar({

  onRefresh,

  onSaveComplete,

  zenMode,

  fullscreenMode,

  onToggleZen,

  onToggleFullscreen,

  onSimulate,

  onStartTour,

  onTogglePalette,

  onToggleFilter,

  onToggleInspector,

  paletteVisible,

  filterVisible,

  inspectorVisible,

  minimapVisible,

  onToggleMinimap,

  onCreateRoute,

}: Props) {

  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = useTopologyBoardStore((s) => s.isDirty);

  const undo = useTopologyBoardStore((s) => s.undo);

  const redo = useTopologyBoardStore((s) => s.redo);

  const hydrate = useTopologyBoardStore((s) => s.hydrate);

  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);

  const setGraph = useTopologyBoardStore((s) => s.setGraph);

  const nodes = useTopologyBoardStore((s) => s.nodes);

  const edges = useTopologyBoardStore((s) => s.edges);

  const markClean = useTopologyBoardStore((s) => s.markClean);

  const historyIndex = useTopologyBoardStore((s) => s.historyIndex);

  const history = useTopologyBoardStore((s) => s.history);

  const layoutAlgorithm = useTopologyBoardSettingsStore((s) => s.layoutAlgorithm);

  const clusterMode = useTopologyBoardSettingsStore((s) => s.clusterMode);

  const patchSettings = useTopologyBoardSettingsStore((s) => s.patchSettings);

  const displayFilter = useTopologyDisplayFilterStore();
  const filterActive = activeFilterCount(displayFilter);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);



  const { fitView, zoomIn, zoomOut } = useReactFlow();



  const handleLayout = useCallback(async () => {
    try {
      const laid = await layoutTopologyGraph(nodes, edges, clusterMode, layoutAlgorithm);
      setGraph(laid, edges);
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 280 }));
      toast.success(t('pipeline.topology.board.layoutApplied', 'Layout applied'));
    } catch {
      toast.error(t('common.error'));
    }
  }, [clusterMode, layoutAlgorithm, nodes, edges, setGraph, fitView, t]);

  const applyLayoutAlgorithm = useCallback(
    async (algorithm: TopologyLayoutAlgorithm) => {
      patchSettings({ layoutAlgorithm: algorithm });
      try {
        const laid = await layoutTopologyGraph(nodes, edges, clusterMode, algorithm);
        setGraph(laid, edges);
        requestAnimationFrame(() => fitView({ padding: 0.2, duration: 280 }));
        toast.success(t('pipeline.topology.board.layoutApplied', 'Layout applied'));
      } catch {
        toast.error(t('common.error'));
      }
    },
    [clusterMode, nodes, edges, patchSettings, setGraph, fitView, t]
  );

  const applyCluster = useCallback(
    async (mode: TopologyClusterMode) => {
      patchSettings({ clusterMode: mode });
      try {
        const laid = await layoutTopologyGraph(nodes, edges, mode, layoutAlgorithm);
        setGraph(laid, edges);
        requestAnimationFrame(() => fitView({ padding: 0.2, duration: 280 }));
      } catch {
        toast.error(t('common.error'));
      }
    },
    [nodes, edges, layoutAlgorithm, patchSettings, setGraph, fitView, t]
  );

  const clusterOptions: { mode: TopologyClusterMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'none',
      label: t('pipeline.topology.board.clusterNone', 'No clusters'),
      icon: <PiCirclesFourBold className="h-4 w-4" />,
    },
    {
      mode: 'byModel',
      label: t('pipeline.topology.board.clusterByModel', 'Cluster by model'),
      icon: <PiBrainBold className="h-4 w-4" />,
    },
    {
      mode: 'byRemoteNode',
      label: t('pipeline.topology.board.clusterByNode', 'Cluster by remote node'),
      icon: <PiCpuBold className="h-4 w-4" />,
    },
  ];



  const handleReload = async () => {

    await onRefresh();

    const data = useTopologyBoardStore.getState().pipelineData;

    if (data) hydrate(data);

  };



  const handleSave = async () => {

    if (!pipelineData) return;

    try {

      const result = await saveTopologyToApi(

        nodes,

        edges,

        pipelineData.bindings,

        pipelineData.pluginBindings

      );

      markClean();

      onSaveComplete?.();

      if (result.errors.length) {
        const failed = result.entityResults.filter((r) => !r.ok);
        const detail = failed.map((r) => `${r.kind}:${r.id}`).join(', ');
        toast.error(
          t('pipeline.topology.board.savePartial', {
            count: result.errors.length,
            defaultValue: `${result.errors.length} items failed: ${detail}`,
          })
        );
      } else {

        toast.success(

          t('pipeline.topology.board.saveSuccess', {

            tools: result.toolsSaved,

            routes: result.routesSaved,

            defaultValue: `Saved ${result.toolsSaved} tools, ${result.routesSaved} routes`,

          })

        );

      }

      await onRefresh();

    } catch {

      toast.error(t('common.error'));

    }

  };



  const handleExport = () => {

    exportTopologyJson({ nodes, edges, exportedAt: new Date().toISOString() });

  };



  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {

    const file = event.target.files?.[0];

    if (!file) return;

    try {

      const data = await importTopologyJsonFromFile(file);

      setGraph(data.nodes as TopologyNode[], data.edges as TopologyEdge[]);

      toast.success(t('pipeline.topology.board.importSuccess', 'Import successful'));

    } catch {

      toast.error(t('pipeline.topology.board.importFailed', 'Invalid topology JSON'));

    }

    event.target.value = '';

  };



  const handleValidate = () => {

    const issues = validateTopologyGraph(nodes, edges, pipelineData);

    if (issues.length === 0) {

      toast.success(t('pipeline.topology.board.validateOk', 'Graph validation passed'));

      return;

    }

    issues.slice(0, 5).forEach((i) =>

      toast.error(i.message, { icon: i.severity === 'warning' ? '⚠️' : '✕' })

    );

  };



  const layoutOptions = [

    { label: t('pipeline.topology.board.settings.layoutElk', 'ELK layered'), value: 'elk' },

    { label: t('pipeline.topology.board.settings.layoutColumn', 'Columns'), value: 'column' },

    { label: t('pipeline.topology.board.settings.layoutRadial', 'Radial'), value: 'radial' },

  ];



  return (

    <div className="relative flex flex-wrap items-center gap-2 border-b border-muted bg-gray-0 px-3 py-2 dark:bg-gray-50" data-tour="topology-toolbar">

      {/* History zone */}

      <div className="flex items-center gap-1 border-r border-muted pe-2">
        <Tooltip content={t('pipeline.topology.board.shortcuts.undo', 'Undo')}>
          <ActionIcon size="sm" variant="outline" onClick={undo} disabled={historyIndex <= 0}>
            <PiArrowCounterClockwiseBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('pipeline.topology.board.shortcuts.redo', 'Redo')}>
          <ActionIcon
            size="sm"
            variant="outline"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            <PiArrowClockwiseBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-r border-muted pe-2">
        {onCreateRoute && (
          <Tooltip content={t('pipeline.routes.addRoute', 'Add route')}>
            <ActionIcon size="sm" variant="outline" onClick={onCreateRoute}>
              <PiFlowArrowBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip content={t('pipeline.topology.board.save', 'Save all')}>
          <ActionIcon size="sm" variant="solid" onClick={handleSave}>
            <PiFloppyDiskBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('pipeline.topology.board.simulate', 'Simulate')}>
          <ActionIcon
            size="sm"
            variant="outline"
            onClick={() => {
              if (onSimulate) onSimulate();
              else {
                const state = useTopologyBoardStore.getState();
                const sel = state.selectedNodeId;
                const selected = state.nodes.filter((n) => n.selected || n.id === sel);
                const routeNode = selected.find(
                  (n) => n.data.kind === 'route' || n.data.kind === 'role'
                );
                const params = new URLSearchParams();
                params.set('tab', 'simulator');
                if (routeNode?.data.entityId) params.set('route_key', routeNode.data.entityId);
                const focusNodes = selected.map((n) => n.id).join(',');
                if (focusNodes) params.set('focus_nodes', focusNodes);
                window.location.href = `/admin/pipeline?${params.toString()}`;
              }
            }}
          >
            <PiPlayBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('pipeline.topology.board.validate', 'Validate')}>
          <ActionIcon size="sm" variant="outline" onClick={handleValidate}>
            <PiCheckCircleBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('pipeline.topology.board.reload', 'Reload')}>
          <ActionIcon size="sm" variant="outline" onClick={handleReload}>
            <PiRefreshBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('pipeline.topology.board.export', 'Export')}>
          <ActionIcon size="sm" variant="outline" onClick={handleExport}>
            <PiDownloadBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('pipeline.topology.board.import', 'Import')}>
          <ActionIcon size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <PiUploadBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      <div className="flex items-center gap-1 border-r border-muted pe-2">
        <Popover>
          <Popover.Trigger>
            <ActionIcon
              size="sm"
              variant={clusterMode !== 'none' ? 'solid' : 'outline'}
              title={t('pipeline.topology.board.clusterMode', 'Clustering')}
              aria-label={t('pipeline.topology.board.clusterMode', 'Clustering')}
            >
              {clusterMode === 'byModel' ? (
                <PiBrainBold className="h-4 w-4" />
              ) : clusterMode === 'byRemoteNode' ? (
                <PiCpuBold className="h-4 w-4" />
              ) : (
                <PiCirclesFourBold className="h-4 w-4" />
              )}
            </ActionIcon>
          </Popover.Trigger>
          <Popover.Content className="z-50 flex gap-1 p-2">
            {clusterOptions.map((opt) => (
              <Tooltip key={opt.mode} content={opt.label}>
                <ActionIcon
                  size="sm"
                  variant={clusterMode === opt.mode ? 'solid' : 'outline'}
                  onClick={() => applyCluster(opt.mode)}
                  aria-label={opt.label}
                >
                  {opt.icon}
                </ActionIcon>
              </Tooltip>
            ))}
          </Popover.Content>
        </Popover>
        <Popover>
          <Popover.Trigger>
            <ActionIcon
              size="sm"
              variant={layoutAlgorithm !== 'elk' ? 'solid' : 'outline'}
              title={t('pipeline.topology.board.settings.layout', 'Layout algorithm')}
              aria-label={t('pipeline.topology.board.settings.layout', 'Layout algorithm')}
            >
              <PiColumnsBold className="h-4 w-4" />
            </ActionIcon>
          </Popover.Trigger>
          <Popover.Content className="z-50 w-48 p-2">
            <Text className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {t('pipeline.topology.board.settings.layout', 'Layout algorithm')}
            </Text>
            {layoutOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`mb-0.5 w-full rounded-md px-2 py-1.5 text-left text-xs last:mb-0 ${
                  layoutAlgorithm === opt.value
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-200/50'
                }`}
                onClick={() => void applyLayoutAlgorithm(opt.value as TopologyLayoutAlgorithm)}
              >
                {opt.label}
              </button>
            ))}
          </Popover.Content>
        </Popover>
        <Tooltip content={t('pipeline.topology.board.autoLayout', 'Apply layout')}>
          <ActionIcon size="sm" variant="outline" onClick={handleLayout}>
            <PiSquaresFourBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
      </div>



      <div className="hidden items-center gap-0.5 border-r border-muted pe-2 xl:flex" aria-hidden />



      {/* Zoom zone */}

      <div className="flex items-center gap-1 border-r border-muted pe-2">

          <Tooltip content={t('pipeline.topology.board.shortcuts.zoomIn', 'Zoom in')}>

            <ActionIcon size="sm" variant="outline" onClick={() => zoomIn()}>

              <PiMagnifyingGlassPlusBold className="h-4 w-4" />

            </ActionIcon>

          </Tooltip>

          <Tooltip content={t('pipeline.topology.board.shortcuts.zoomOut', 'Zoom out')}>

            <ActionIcon size="sm" variant="outline" onClick={() => zoomOut()}>

              <PiMagnifyingGlassMinusBold className="h-4 w-4" />

            </ActionIcon>

          </Tooltip>

          <Tooltip content={t('pipeline.topology.board.shortcuts.fit', 'Fit view')}>
            <ActionIcon size="sm" variant="outline" onClick={() => fitView({ padding: 0.2 })}>
              <PiArrowsOutBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          {onToggleMinimap && (
            <Tooltip content={t('pipeline.topology.board.minimap', 'Minimap')}>
              <ActionIcon
                size="sm"
                variant={minimapVisible ? 'solid' : 'outline'}
                onClick={onToggleMinimap}
                aria-label={t('pipeline.topology.board.minimap', 'Minimap')}
              >
                <PiMapTrifoldBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          )}
        </div>



      {/* Settings zone */}

      <div className="relative ms-auto flex items-center gap-1">
        {onTogglePalette && (
          <Tooltip content={t('pipeline.topology.board.palette', 'Palette')}>
            <ActionIcon
              size="sm"
              variant={paletteVisible ? 'solid' : 'outline'}
              onClick={onTogglePalette}
            >
              <PiSidebarSimpleBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}
        {onToggleFilter && (
          <Tooltip content={t('pipeline.topology.board.displayFilter', 'Display filter')}>
            <ActionIcon
              size="sm"
              variant={filterVisible ? 'solid' : 'outline'}
              onClick={onToggleFilter}
              className="relative"
              aria-label={t('pipeline.topology.board.displayFilter', 'Display filter')}
            >
              <PiFunnelBold className="h-4 w-4" />
              {filterActive > 0 ? (
                <span className="absolute -end-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                  {filterActive}
                </span>
              ) : null}
            </ActionIcon>
          </Tooltip>
        )}
        {onToggleInspector && (
          <Tooltip content={t('pipeline.topology.board.inspector', 'Inspector')}>
            <ActionIcon
              size="sm"
              variant={inspectorVisible ? 'solid' : 'outline'}
              onClick={onToggleInspector}
            >
              <PiListMagnifyingGlassBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {onToggleZen && (
          <Tooltip content={t('pipeline.topology.board.zenMode', 'Zen mode')}>
            <ActionIcon
              size="sm"
              variant={zenMode ? 'solid' : 'outline'}
              onClick={onToggleZen}
            >
              <PiEyeBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {onToggleFullscreen && (

          <Tooltip content={t('pipeline.topology.board.fullscreen', 'Fullscreen')}>

            <ActionIcon

              size="sm"

              variant={fullscreenMode ? 'solid' : 'outline'}

              onClick={onToggleFullscreen}

            >

              <PiCornersOutBold className="h-4 w-4" />

            </ActionIcon>

          </Tooltip>

        )}

        <TopologyShortcutsHelp />

        {onStartTour && (
          <Tooltip
            content={t(
              'pipeline.topology.board.tour.restart',
              'Show interactive board tour'
            )}
          >
            <ActionIcon size="sm" variant="outline" onClick={onStartTour}>
              <PiQuestionBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        )}

        <Tooltip content={t('pipeline.topology.board.settings.title', 'Display settings')}>
          <ActionIcon
            size="sm"
            variant={displaySettingsOpen ? 'solid' : 'outline'}
            onClick={() => setDisplaySettingsOpen(true)}
            aria-label={t('pipeline.topology.board.settings.title', 'Display settings')}
          >
            <PiGearBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <PipelineAdminDrawer
          open={displaySettingsOpen}
          onClose={() => setDisplaySettingsOpen(false)}
          title={t('pipeline.topology.board.settings.title', 'Display settings')}
          size="md"
        >
          <TopologyDisplaySettingsContent />
        </PipelineAdminDrawer>

      </div>



      {isDirty && (

        <Text className="w-full text-xs text-amber-600 sm:w-auto">

          {t('pipeline.topology.board.unsaved', 'Unsaved changes')}

        </Text>

      )}

    </div>

  );

}

