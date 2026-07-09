'use client';

import { Tooltip } from '@/components/tooltip';
import { ActionIcon, Badge, Button, Text } from 'rizzui';
import {
  PiXBold,
  PiCopyBold,
  PiDownloadSimpleBold,
  PiArrowsOutBold,
  PiFunnelBold,
  PiCaretRightBold,
  PiCaretDownBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiTrashBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { GraphData, GraphNode } from '@/types/graph-explorer.types';
import type { PathfindingLayerState } from './pathfinding-layer-state';
import { resolvePathLayerRgb } from './path-layer-colors';
import { getRelationConfig } from '@/config/graph-config';
import { getPathLinkIds, type PathfindingMode } from './graph-pathfinding';

export interface PathResultsStripProps {
  layers: PathfindingLayerState[];
  graphData: GraphData;
  nodeMap: Map<string, GraphNode>;
  onLayerActiveResultChange: (layerId: string, index: number) => void;
  onLayerHighlightToggle: (layerId: string, enabled: boolean) => void;
  onLayerExpandedChange: (layerId: string, expanded: boolean) => void;
  onRemoveLayer: (layerId: string) => void;
  onDismissStrip: () => void;
  onReleaseIsolate?: () => void;
  isolateFilterActive?: boolean;
  isolateLayerId?: string | null;
  onClearSession?: () => void;
  onFitPath: (nodeIds: string[]) => void;
  onIsolatePath?: (layerId: string, nodeIds: string[], linkIds: string[]) => void;
}

function modeLabel(mode: PathfindingMode, resultCount: number) {
  if (mode === 'shortest') return 'Shortest';
  if (mode === 'strongest') return 'Strongest';
  return `K-shortest (${resultCount})`;
}

export default function PathResultsStrip({
  layers,
  graphData,
  nodeMap,
  onLayerActiveResultChange,
  onLayerHighlightToggle,
  onLayerExpandedChange,
  onRemoveLayer,
  onDismissStrip,
  onReleaseIsolate,
  isolateFilterActive,
  isolateLayerId,
  onClearSession,
  onFitPath,
  onIsolatePath,
}: PathResultsStripProps) {
  const { t } = useTranslation();
  if (layers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-[90] w-[min(100%,44rem)] -translate-x-1/2 px-3">
      <div className="pointer-events-auto flex max-h-[min(55vh,440px)] flex-col overflow-hidden rounded-xl border border-muted bg-gray-0/95 shadow-xl backdrop-blur-md dark:bg-gray-50/95">
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-muted px-3 py-2">
          <div className="min-w-0 flex-1">
            <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
              {t('graphExplorer.pathResultsStrip.title')}
            </Text>
            <Text className="text-[10px] text-gray-500">
              {t('graphExplorer.pathResultsStrip.routesOnGraph', { count: layers.length })}
            </Text>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
            {isolateFilterActive && onReleaseIsolate && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-amber-500 px-2.5 text-[11px] text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
                onClick={onReleaseIsolate}
              >
                {t('graphExplorer.pathResultsStrip.exitIsolate')}
              </Button>
            )}
            {onClearSession && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-red-300 px-2.5 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={onClearSession}
              >
                {t('graphExplorer.pathResultsStrip.clearAll')}
              </Button>
            )}
            <Tooltip content={t('graphExplorer.pathResultsStrip.hidePanel')} placement="bottom">
              <ActionIcon variant="outline" size="sm" onClick={onDismissStrip} className="text-gray-600 dark:text-gray-400">
                <PiXBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
          {layers.map((layer, layerIndex) => {
            const routeColor = resolvePathLayerRgb(layerIndex);
            const active = layer.results[layer.activeResultIndex];
            const found = !!active?.found;
            const thisLayerIsolated = isolateFilterActive && isolateLayerId === layer.id;

            return (
              <div
                key={layer.id}
                className="flex overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50"
              >
                <div
                  className="w-1 shrink-0 rounded-l-[0.45rem]"
                  style={{ backgroundColor: routeColor }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 border-b border-muted/70 px-2 py-1.5">
                    <Tooltip
                      content={
                        layer.expanded
                          ? t('graphExplorer.pathResultsStrip.collapseDetails')
                          : t('graphExplorer.pathResultsStrip.expandDetails')
                      }
                      placement="bottom"
                    >
                      <ActionIcon
                        variant="outline"
                        size="sm"
                        onClick={() => onLayerExpandedChange(layer.id, !layer.expanded)}
                        aria-expanded={layer.expanded}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        {layer.expanded ? (
                          <PiCaretDownBold className="h-3.5 w-3.5" />
                        ) : (
                          <PiCaretRightBold className="h-3.5 w-3.5" />
                        )}
                      </ActionIcon>
                    </Tooltip>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-gray-800 dark:text-gray-200">
                        {layer.sourceNode.label} → {layer.targetNode.label}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <Badge size="sm" className="font-normal uppercase tracking-wide text-[9px]">
                          {modeLabel(layer.mode, layer.results.length)}
                        </Badge>
                        {found && (
                          <Text as="span" className="text-[9px] text-gray-500 dark:text-gray-400">
                            {active.hops} hops · w{' '}
                            {Number.isFinite(active.totalWeight) ? active.totalWeight.toFixed(2) : '—'}
                          </Text>
                        )}
                      </div>
                    </div>
                    <Tooltip
                      content={
                        layer.highlightEnabled
                          ? t('graphExplorer.pathResultsStrip.hideOnGraph')
                          : t('graphExplorer.pathResultsStrip.showOnGraph')
                      }
                      placement="bottom"
                    >
                      <ActionIcon
                        variant="outline"
                        size="sm"
                        onClick={() => onLayerHighlightToggle(layer.id, !layer.highlightEnabled)}
                        className={cn(
                          layer.highlightEnabled &&
                            'border-primary text-primary bg-primary/10 dark:bg-primary/15'
                        )}
                      >
                        {layer.highlightEnabled ? (
                          <PiEyeBold className="h-3.5 w-3.5" />
                        ) : (
                          <PiEyeSlashBold className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip content={t('graphExplorer.pathResultsStrip.removePath')} placement="bottom">
                      <ActionIcon
                        variant="outline"
                        size="sm"
                        onClick={() => onRemoveLayer(layer.id)}
                        className="text-red-600 hover:border-red-300 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <PiTrashBold className="h-3.5 w-3.5" />
                      </ActionIcon>
                    </Tooltip>
                  </div>

                  {layer.expanded && found && active && (
                    <div className="px-2 pb-2 pt-2">
                      <div className="mb-2 flex flex-wrap items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px]"
                          onClick={() => onFitPath(active.path)}
                        >
                          <PiArrowsOutBold className="mr-1 h-3.5 w-3.5" />
                          {t('graphExplorer.pathResultsStrip.fit')}
                        </Button>
                        {onIsolatePath && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-8 px-2.5 text-[11px]',
                              thisLayerIsolated &&
                                'border-amber-500 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40'
                            )}
                            onClick={() => {
                              if (thisLayerIsolated && onReleaseIsolate) {
                                onReleaseIsolate();
                              } else {
                                const linkIds = getPathLinkIds(active, graphData);
                                onIsolatePath(layer.id, active.path, [...linkIds]);
                              }
                            }}
                          >
                            <PiFunnelBold className="mr-1 h-3.5 w-3.5" />
                            {thisLayerIsolated
                              ? t('graphExplorer.pathResultsStrip.exitIsolate')
                              : t('graphExplorer.pathResultsStrip.isolate')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px]"
                          onClick={() => {
                            const text = active.path.map((id) => nodeMap.get(id)?.label ?? id).join(' → ');
                            navigator.clipboard.writeText(text).then(() => toast.success('Path copied'));
                          }}
                        >
                          <PiCopyBold className="mr-1 h-3.5 w-3.5" />
                          {t('graphExplorer.pathResultsStrip.copy')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px]"
                          onClick={() => {
                            const payload =
                              layer.results.length > 1
                                ? layer.results.map((r, i) => ({
                                    rank: i + 1,
                                    hops: r.hops,
                                    totalWeight: r.totalWeight,
                                    path: r.path.map((id) => ({ id, label: nodeMap.get(id)?.label ?? id })),
                                    edges: r.edges,
                                  }))
                                : {
                                    mode: layer.mode,
                                    source: layer.sourceNode.label,
                                    target: layer.targetNode.label,
                                    hops: active.hops,
                                    totalWeight: active.totalWeight,
                                    path: active.path.map((id) => ({ id, label: nodeMap.get(id)?.label ?? id })),
                                    edges: active.edges,
                                  };
                            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `path-${layer.sourceNode.label}-to-${layer.targetNode.label}.json`.replace(
                              /\s+/g,
                              '_'
                            );
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success('Exported JSON');
                          }}
                        >
                          <PiDownloadSimpleBold className="mr-1 h-3.5 w-3.5" />
                          {t('graphExplorer.pathResultsStrip.json')}
                        </Button>
                      </div>

                      {layer.results.length > 1 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {layer.results.map((r, i) => (
                            <Button
                              key={i}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onLayerActiveResultChange(layer.id, i)}
                              className={cn(
                                'h-7 min-w-0 px-2 text-[10px]',
                                i === layer.activeResultIndex
                                  ? 'border-primary bg-primary/10 font-medium text-primary dark:bg-primary/15'
                                  : 'text-gray-600 dark:text-gray-400'
                              )}
                            >
                              #{i + 1} · {r.hops}h
                            </Button>
                          ))}
                        </div>
                      )}

                      <ol className="max-h-[180px] space-y-1 overflow-y-auto rounded-md border border-muted bg-gray-50/50 px-2 py-2 dark:bg-gray-100/30">
                        {active.path.map((nodeId, idx) => {
                          const n = nodeMap.get(nodeId);
                          const edge = idx < active.edges.length ? active.edges[idx] : null;
                          return (
                            <li key={`${layer.id}-${nodeId}-${idx}`}>
                              <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                                {idx + 1}. {n?.label ?? nodeId}
                                {idx === 0 && (
                                  <span className="ml-1 text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                                    {t('graphExplorer.pathResultsStrip.pathStart')}
                                  </span>
                                )}
                                {idx === active.path.length - 1 && (
                                  <span className="ml-1 text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                    {t('graphExplorer.pathResultsStrip.pathEnd')}
                                  </span>
                                )}
                              </div>
                              {edge && (
                                <div className="ml-3 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                  — {getRelationConfig(edge.relation).label}{' '}
                                  <span className="font-mono text-gray-400">({edge.strength})</span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
