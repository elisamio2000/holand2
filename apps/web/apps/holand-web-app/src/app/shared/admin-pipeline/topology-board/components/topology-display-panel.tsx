'use client';

import { Tooltip } from '@/components/tooltip';
import { Button, Select, Switch, Text, ActionIcon } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  useTopologyBoardSettingsStore,
  type TopologyLayoutAlgorithm,
  type TopologyClusterMode,
} from '../helpers/topology-board-settings';
import { useTopologyBoardStore } from '../store/topology-board-store';
import { layoutTopologyGraph } from '../helpers/layout-elk';
import { ENTITY_REGISTRY } from '../helpers/entity-registry';
import {
  SHAPE_CONFIGURABLE_KINDS,
  TOPOLOGY_NODE_SHAPE_OPTIONS,
  nodeShapePreviewStyle,
  type TopologyNodeShape,
} from '../helpers/topology-node-shapes';
import { PiCirclesFourBold, PiCpuBold, PiBrainBold } from 'react-icons/pi';

function ShapePreview({ shape, className }: { shape: TopologyNodeShape; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 border border-gray-400 bg-gray-100',
        shape === 'pill' ? 'h-3 w-5' : 'size-4',
        className
      )}
      style={nodeShapePreviewStyle(shape)}
      aria-hidden
    />
  );
}

export function TopologyDisplaySettingsContent() {
  const { t } = useTranslation();
  const settings = useTopologyBoardSettingsStore();
  const patch = useTopologyBoardSettingsStore((s) => s.patchSettings);
  const patchNodeShape = useTopologyBoardSettingsStore((s) => s.patchNodeShape);
  const reset = useTopologyBoardSettingsStore((s) => s.resetSettings);
  const hydrate = useTopologyBoardStore((s) => s.hydrate);
  const setGraph = useTopologyBoardStore((s) => s.setGraph);
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const edges = useTopologyBoardStore((s) => s.edges);

  const clusterOptions: { mode: TopologyClusterMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'none', label: t('pipeline.topology.board.clusterNone', 'No clusters'), icon: <PiCirclesFourBold className="size-3.5" /> },
    { mode: 'byModel', label: t('pipeline.topology.board.clusterByModel', 'By model'), icon: <PiBrainBold className="size-3.5" /> },
    { mode: 'byRemoteNode', label: t('pipeline.topology.board.clusterByNode', 'By remote node'), icon: <PiCpuBold className="size-3.5" /> },
  ];

  const applyCluster = async (mode: TopologyClusterMode) => {
    patch({ clusterMode: mode });
    try {
      const laid = await layoutTopologyGraph(nodes, edges, mode, settings.layoutAlgorithm);
      setGraph(laid, edges);
    } catch {
      /* layout optional in settings panel */
    }
  };

  const applyLayoutAlgorithm = async (algorithm: TopologyLayoutAlgorithm) => {
    patch({ layoutAlgorithm: algorithm });
    try {
      const laid = await layoutTopologyGraph(nodes, edges, settings.clusterMode, algorithm);
      setGraph(laid, edges);
    } catch {
      /* layout optional in settings panel */
    }
  };

  const layoutOptions = [
    { label: t('pipeline.topology.board.settings.layoutElk', 'ELK layered'), value: 'elk' },
    { label: t('pipeline.topology.board.settings.layoutColumn', 'Columns'), value: 'column' },
    { label: t('pipeline.topology.board.settings.layoutRadial', 'Radial'), value: 'radial' },
  ];

  const shapeOptions = TOPOLOGY_NODE_SHAPE_OPTIONS.map((opt) => ({
    label: t(opt.labelKey, opt.fallback),
    value: opt.value,
  }));

  const rehydrateIfNeeded = () => {
    const data = useTopologyBoardStore.getState().pipelineData;
    if (data) hydrate(data);
  };

  return (
    <div className="space-y-3" data-tour="topology-display-panel">
      <Switch
        label={t('pipeline.topology.board.settings.nodeLabels', 'Node labels')}
        checked={settings.showNodeLabels}
        onChange={(e) => patch({ showNodeLabels: e.target.checked })}
      />
      <Switch
        label={t('pipeline.topology.board.settings.edgeLabels', 'Edge labels')}
        checked={settings.showEdgeLabels}
        onChange={(e) => patch({ showEdgeLabels: e.target.checked })}
      />
      <Switch
        label={t('pipeline.topology.board.settings.healthOverlay', 'Health-colored edges')}
        checked={settings.healthOverlay}
        onChange={(e) => patch({ healthOverlay: e.target.checked })}
      />
      <Switch
        label={t('pipeline.topology.board.settings.snapGrid', 'Snap to grid')}
        checked={settings.snapToGrid}
        onChange={(e) => patch({ snapToGrid: e.target.checked })}
      />
      <Switch
        label={t('pipeline.topology.board.settings.showOrphanNodes', 'Show saved orphan nodes')}
        checked={settings.showOrphanNodes}
        onChange={(e) => {
          patch({ showOrphanNodes: e.target.checked });
          rehydrateIfNeeded();
        }}
      />
      <Switch
        label={t('pipeline.topology.board.settings.minimap', 'Minimap')}
        checked={settings.showMinimap}
        onChange={(e) => patch({ showMinimap: e.target.checked })}
      />
      <Switch
        label={t('pipeline.topology.board.settings.minimapAuto', 'Auto-hide minimap when sparse')}
        checked={settings.minimapAuto}
        onChange={(e) => patch({ minimapAuto: e.target.checked })}
      />
      {settings.minimapAuto && (
        <Select
          size="sm"
          label={t('pipeline.topology.board.settings.minimapThreshold', 'Minimap node threshold')}
          options={[3, 6, 12, 24, 48].map((n) => ({ label: String(n), value: n }))}
          value={settings.minimapThreshold}
          onChange={(v: { value: number }) => patch({ minimapThreshold: v.value })}
        />
      )}

      <div className="space-y-2 border-t border-muted pt-3" data-tour="topology-node-shapes">
        <Text className="text-xs font-medium text-gray-600">
          {t('pipeline.topology.board.settings.nodeShapes', 'Node shapes')}
        </Text>
        <Text className="text-[10px] text-gray-400">
          {t(
            'pipeline.topology.board.settings.nodeShapesHint',
            'Choose how each entity type appears on the board.'
          )}
        </Text>
        <div className="space-y-1.5">
          {SHAPE_CONFIGURABLE_KINDS.map((kind) => {
            const meta = ENTITY_REGISTRY[kind];
            const shape = settings.nodeShapes[kind];
            return (
              <div key={kind} className="flex items-center gap-2">
                <ShapePreview shape={shape} />
                <Text className="min-w-0 flex-1 truncate text-[11px]">
                  {t(meta.i18nKey, meta.label)}
                </Text>
                <Select
                  size="sm"
                  className="w-[118px] shrink-0"
                  options={shapeOptions}
                  value={shape}
                  onChange={(v: { value: TopologyNodeShape }) => patchNodeShape(kind, v.value)}
                  getOptionDisplayValue={(opt) => (
                    <span className="flex items-center gap-1.5">
                      <ShapePreview shape={opt.value as TopologyNodeShape} />
                      <span className="truncate text-[10px]">{opt.label}</span>
                    </span>
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Text className="text-xs font-medium text-gray-600">
          {t('pipeline.topology.board.clusterMode', 'Clustering')}
        </Text>
        <div className="flex flex-wrap gap-1">
          {clusterOptions.map((opt) => (
            <Tooltip key={opt.mode} content={opt.label}>
              <ActionIcon
                size="sm"
                variant={settings.clusterMode === opt.mode ? 'solid' : 'outline'}
                onClick={() => applyCluster(opt.mode)}
                aria-label={opt.label}
              >
                {opt.icon}
              </ActionIcon>
            </Tooltip>
          ))}
        </div>
      </div>

      <Select
        size="sm"
        label={t('pipeline.topology.board.settings.layout', 'Layout algorithm')}
        options={layoutOptions}
        value={settings.layoutAlgorithm}
        onChange={(v: { value: TopologyLayoutAlgorithm }) => void applyLayoutAlgorithm(v.value)}
      />

      <Button size="sm" variant="outline" className="w-full" onClick={reset}>
        {t('pipeline.topology.board.settings.reset', 'Reset to defaults')}
      </Button>
    </div>
  );
}
