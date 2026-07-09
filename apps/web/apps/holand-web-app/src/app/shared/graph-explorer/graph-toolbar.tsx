'use client';

/**
 * GraphToolbar — Top toolbar for graph explorer controls.
 *
 * Provides zoom controls, layout picker, display settings dropdown,
 * simulation pause/resume, export options, and dimension toggle.
 *
 * @requires @/components/tooltip — SmartTooltip
 * @requires rizzui — ActionIcon, Badge
 * @requires react-icons/pi — Phosphor icons
 *
 * @example
 * ```tsx
 * <GraphToolbar settings={settings} onSettingsChange={setSettings} canvasRef={canvasRef} />
 * ```
 */

import { Tooltip } from '@/components/tooltip';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ActionIcon, Badge } from 'rizzui';
import {
  PiMagnifyingGlassPlusBold,
  PiMagnifyingGlassMinusBold,
  PiArrowsOutBold,
  PiArrowCounterClockwiseBold,
  PiPauseBold,
  PiPlayBold,
  PiExportBold,
  PiImageBold,
  PiVectorThreeBold,
  PiFilePdfBold,
  PiGearBold,
  PiGraphBold,
  PiCircleBold,
  PiGridFourBold,
  PiTreeStructureBold,
  PiTargetBold,
  PiCirclesFourBold,
  PiTagBold,
  PiLinkBold,
  PiCirclesThreeBold,
  PiEyeBold,
  PiLightningBold,
  PiCaretDownBold,
  PiBracketsCurlyBold,
  PiPathBold,
  PiCrosshairBold,
  PiCodeBold,
  PiPackageBold,
  PiFunnelBold,
  PiSidebarSimpleFill,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';

import type { GraphSettings, LayoutAlgorithm } from '@/types/graph-explorer.types';
import type { GraphCanvasHandle } from './graph-canvas';
import { GraphDisplaySettingsForm } from './graph-display-settings-form';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphToolbarProps {
  settings: GraphSettings;
  onSettingsChange: (settings: GraphSettings) => void;
  canvasRef: React.RefObject<GraphCanvasHandle>;
  isPaused: boolean;
  onPauseToggle: () => void;
  nodeCount: number;
  linkCount: number;
  /** Whether Query Builder panel is open */
  showQueryBuilder?: boolean;
  /** A query filter is applied (panel may be collapsed) */
  queryFilterActive?: boolean;
  /** Toggle Query Builder panel */
  onToggleQueryBuilder?: () => void;
  /** Pathfinding toolbar: start from selection, or toggle side panel when a session exists. */
  onPathfindingToolbarClick?: () => void;
  pathfindingDisabled?: boolean;
  /** Path result exists — used for pathfinding panel tooltips only. */
  pathSessionActive?: boolean;
  pathfindingPanelOpen?: boolean;
  /** A completed path is on the graph — show amber chip to toggle the floating path summary. */
  pathResultsSummaryAvailable?: boolean;
  pathResultsStripVisible?: boolean;
  onPathResultsSummaryToggle?: () => void;
  /** Open self-contained interactive HTML export dialog. */
  onOpenInteractiveExport?: () => void;
  /** Board graph: filter sidebar visible */
  filterPanelOpen?: boolean;
  onToggleFilterPanel?: () => void;
  /** Board graph: inspector sidebar visible */
  inspectorPanelOpen?: boolean;
  onToggleInspectorPanel?: () => void;
  /** When embedded in board editor — match BoardToolbar chrome (no extra border row). */
  embedded?: boolean;
  /** Hide gear dropdown; board graph uses the settings sidebar instead. */
  hideDisplaySettings?: boolean;
  className?: string;
}

interface LayoutOption {
  value: LayoutAlgorithm;
  label: string;
  icon: React.ReactNode;
}

// ─── Layout options ───────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: LayoutOption[] = [
  { value: 'force', label: 'Force-Directed', icon: <PiGraphBold className="w-4 h-4" /> },
  { value: 'circular', label: 'Circular', icon: <PiCircleBold className="w-4 h-4" /> },
  { value: 'grid', label: 'Grid', icon: <PiGridFourBold className="w-4 h-4" /> },
  { value: 'hierarchical', label: 'Tree (Vertical)', icon: <PiTreeStructureBold className="w-4 h-4" /> },
  { value: 'hierarchical-horizontal', label: 'Tree (Horizontal)', icon: <PiTreeStructureBold className="w-4 h-4 rotate-90" /> },
  { value: 'radial', label: 'Radial', icon: <PiTargetBold className="w-4 h-4" /> },
  { value: 'cluster', label: 'Cluster (community)', icon: <PiPackageBold className="w-4 h-4" /> },
  { value: 'concentric', label: 'Concentric', icon: <PiCirclesThreeBold className="w-4 h-4" /> },
];

// ─── Dropdown wrapper ─────────────────────────────────────────────────────────

function ToolbarDropdown({
  trigger,
  isOpen,
  onToggle,
  children,
  align = 'left',
}: {
  trigger: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={onToggle}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[200px] bg-gray-0 dark:bg-gray-50 border border-muted rounded-lg shadow-xl p-2',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * GraphToolbar — Toolbar with zoom, layout, display settings, and export controls.
 */
export default function GraphToolbar({
  settings,
  onSettingsChange,
  canvasRef,
  isPaused,
  onPauseToggle,
  nodeCount,
  linkCount,
  showQueryBuilder,
  queryFilterActive,
  onToggleQueryBuilder,
  onPathfindingToolbarClick,
  pathfindingDisabled,
  pathSessionActive,
  pathfindingPanelOpen,
  pathResultsSummaryAvailable,
  pathResultsStripVisible,
  onPathResultsSummaryToggle,
  onOpenInteractiveExport,
  filterPanelOpen,
  onToggleFilterPanel,
  inspectorPanelOpen,
  onToggleInspectorPanel,
  embedded = false,
  hideDisplaySettings = false,
  className,
}: GraphToolbarProps) {
  const { t } = useTranslation();
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const handleLayoutChange = useCallback(
    (layout: LayoutAlgorithm) => {
      onSettingsChange({ ...settings, layout });
      setLayoutOpen(false);
    },
    [settings, onSettingsChange]
  );

  const currentLayout = LAYOUT_OPTIONS.find((l) => l.value === settings.layout) ?? LAYOUT_OPTIONS[0];

  return (
    <div
      className={cn(
        'flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-gray-0 dark:bg-gray-50 border-b border-muted',
        embedded && 'border-0 bg-transparent px-0 py-0 dark:bg-transparent',
        className
      )}
    >
      {/* Left section: Zoom + Layout */}
      <div className="flex items-center gap-1">
        {/* Zoom controls */}
        <Tooltip content={t('graphExplorer.toolbar.zoomIn', { defaultValue: 'Zoom In' })} placement="bottom">
          <ActionIcon variant="outline" size="sm" onClick={() => canvasRef.current?.zoomIn()}>
            <PiMagnifyingGlassPlusBold className="w-4 h-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('graphExplorer.toolbar.zoomOut', { defaultValue: 'Zoom Out' })} placement="bottom">
          <ActionIcon variant="outline" size="sm" onClick={() => canvasRef.current?.zoomOut()}>
            <PiMagnifyingGlassMinusBold className="w-4 h-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('graphExplorer.toolbar.fitToScreen', { defaultValue: 'Fit to View' })} placement="bottom">
          <ActionIcon variant="outline" size="sm" onClick={() => canvasRef.current?.fitView()}>
            <PiArrowsOutBold className="w-4 h-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('graphExplorer.toolbar.resetView', { defaultValue: 'Reset View' })} placement="bottom">
          <ActionIcon variant="outline" size="sm" onClick={() => canvasRef.current?.resetView()}>
            <PiArrowCounterClockwiseBold className="w-4 h-4" />
          </ActionIcon>
        </Tooltip>

        <div className="w-px h-5 bg-muted mx-1" />

        {/* Layout picker */}
        <ToolbarDropdown
          isOpen={layoutOpen}
          onToggle={() => setLayoutOpen(!layoutOpen)}
          trigger={
            <Tooltip
              content={t('graphExplorer.toolbar.layout', {
                defaultValue: 'Layout: {{name}}',
                name: currentLayout.label,
              })}
              placement="bottom"
            >
              <ActionIcon
                variant="outline"
                size="sm"
                aria-label={currentLayout.label}
                className={cn(layoutOpen && 'border-primary text-primary bg-primary/10')}
              >
                {currentLayout.icon}
              </ActionIcon>
            </Tooltip>
          }
        >
          <div className="space-y-0.5">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleLayoutChange(opt.value)}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors',
                  settings.layout === opt.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-200'
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </ToolbarDropdown>

        <div className="w-px h-5 bg-muted mx-1" />

        {/* Play / Pause */}
        <Tooltip
          content={
            isPaused
              ? t('graphExplorer.toolbar.resumeSimulation', { defaultValue: 'Resume Simulation' })
              : t('graphExplorer.toolbar.pauseSimulation', { defaultValue: 'Pause Simulation' })
          }
          placement="bottom"
        >
          <ActionIcon
            variant="outline"
            size="sm"
            onClick={onPauseToggle}
            className={cn(isPaused && 'border-amber-500 text-amber-500')}
          >
            {isPaused ? <PiPlayBold className="w-4 h-4" /> : <PiPauseBold className="w-4 h-4" />}
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Center: Stats badges */}
      <div className="hidden md:flex items-center gap-1.5">
        <Badge variant="outline" size="sm">
          {t('graphExplorer.stats.nodes', { defaultValue: 'Nodes' })}: {nodeCount}
        </Badge>
        <Badge variant="outline" size="sm">
          {t('graphExplorer.stats.edges', { defaultValue: 'Edges' })}: {linkCount}
        </Badge>
      </div>

      {/* Right section: side panels + Query Builder + Display Settings + Export */}
      <div className="flex items-center gap-1">
        {onToggleFilterPanel && (
          <Tooltip
            content={
              filterPanelOpen
                ? t('boards.graph.hideFilter', { defaultValue: 'Hide filter panel' })
                : t('boards.graph.showFilter', { defaultValue: 'Show filter panel' })
            }
            placement="bottom"
          >
            <ActionIcon
              variant="outline"
              size="sm"
              onClick={onToggleFilterPanel}
              aria-label={t('boards.graph.filterPanel', { defaultValue: 'Graph filter' })}
              className={cn(filterPanelOpen && 'border-primary text-primary bg-primary/10')}
            >
              <PiFunnelBold className="w-4 h-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {onToggleInspectorPanel && (
          <Tooltip
            content={
              inspectorPanelOpen
                ? t('boards.graph.hideInspector', { defaultValue: 'Hide inspector panel' })
                : t('boards.graph.showInspector', { defaultValue: 'Show inspector panel' })
            }
            placement="bottom"
          >
            <ActionIcon
              variant="outline"
              size="sm"
              onClick={onToggleInspectorPanel}
              aria-label={t('boards.graph.inspectorPanel', { defaultValue: 'Graph inspector' })}
              className={cn(inspectorPanelOpen && 'border-primary text-primary bg-primary/10')}
            >
              <PiSidebarSimpleFill className="w-4 h-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {(onToggleFilterPanel || onToggleInspectorPanel) && onToggleQueryBuilder ? (
          <div className="w-px h-5 bg-muted mx-0.5" />
        ) : null}

        {/* Query Builder toggle */}
        {onToggleQueryBuilder && (
          <Tooltip
            content={
              showQueryBuilder
                ? t('graphExplorer.query.close', { defaultValue: 'Close Query Builder' })
                : queryFilterActive
                  ? t('graphExplorer.query.active', { defaultValue: 'Query Builder (filter active)' })
                  : t('graphExplorer.query.title', { defaultValue: 'Query Builder' })
            }
            placement="bottom"
          >
            <ActionIcon
              variant="outline"
              size="sm"
              onClick={onToggleQueryBuilder}
              className={cn(
                (showQueryBuilder || queryFilterActive) &&
                  'border-primary text-primary bg-primary/10'
              )}
            >
              <PiBracketsCurlyBold className="w-4 h-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {pathResultsSummaryAvailable && onPathResultsSummaryToggle && (
          <Tooltip
            content={
              pathResultsStripVisible
                ? t('graphExplorer.pathResultsSummary.toggleHide', {
                    defaultValue: 'Hide path summary (highlight & isolate stay)',
                  })
                : t('graphExplorer.pathResultsSummary.toggleShow', {
                    defaultValue: 'Show path summary',
                  })
            }
            placement="bottom"
          >
            <ActionIcon
              variant="outline"
              size="sm"
              onClick={onPathResultsSummaryToggle}
              className={cn(
                'border-amber-500 text-amber-700 bg-amber-50/90 dark:border-amber-500 dark:text-amber-400 dark:bg-amber-950/35',
                pathResultsStripVisible && 'ring-2 ring-amber-400/45'
              )}
            >
              <PiCrosshairBold className="w-4 h-4" />
            </ActionIcon>
          </Tooltip>
        )}

        {onPathfindingToolbarClick && (
          <Tooltip
            content={
              pathSessionActive
                ? pathfindingPanelOpen
                  ? t('graphExplorer.pathfinding.hidePanel', { defaultValue: 'Hide pathfinding panel (session stays)' })
                  : t('graphExplorer.pathfinding.showPanel', {
                      defaultValue: 'Open pathfinding panel — new destination or clear session',
                    })
                : t('graphExplorer.pathfinding.fromSelected', { defaultValue: 'Pathfinding from selected node' })
            }
            placement="bottom"
          >
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={pathfindingDisabled}
              onClick={onPathfindingToolbarClick}
              className={cn(
                'disabled:opacity-40',
                pathfindingPanelOpen && 'border-primary text-primary bg-primary/10 ring-2 ring-primary/30'
              )}
            >
              <PiPathBold className="w-4 h-4" />
            </ActionIcon>
          </Tooltip>
        )}

        <div className="w-px h-5 bg-muted mx-0.5" />

        {!hideDisplaySettings ? (
        <ToolbarDropdown
          isOpen={settingsOpen}
          onToggle={() => setSettingsOpen(!settingsOpen)}
          align="right"
          trigger={
            <Tooltip content={t('graphExplorer.toolbar.displaySettings', { defaultValue: 'Display Settings' })} placement="bottom">
              <ActionIcon variant="outline" size="sm">
                <PiGearBold className="w-4 h-4" />
              </ActionIcon>
            </Tooltip>
          }
        >
          <GraphDisplaySettingsForm
            settings={settings}
            onSettingsChange={onSettingsChange}
            className="min-w-[230px]"
          />
        </ToolbarDropdown>
        ) : null}

        {/* Export dropdown */}
        <ToolbarDropdown
          isOpen={exportOpen}
          onToggle={() => setExportOpen(!exportOpen)}
          align="right"
          trigger={
            <Tooltip content={t('common.export', { defaultValue: 'Export' })} placement="bottom">
              <ActionIcon variant="outline" size="sm">
                <PiExportBold className="w-4 h-4" />
              </ActionIcon>
            </Tooltip>
          }
        >
          <div className="space-y-0.5">
            <button
              onClick={() => {
                console.info('[GraphToolbar] Exporting PNG...');
                canvasRef.current?.exportPNG();
                setExportOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors"
            >
              <PiImageBold className="w-4 h-4" />
              {t('graphExplorer.export.png', { defaultValue: 'Export as PNG' })}
            </button>
            <button
              onClick={() => {
                console.info('[GraphToolbar] Exporting SVG...');
                canvasRef.current?.exportSVG();
                setExportOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors"
            >
              <PiVectorThreeBold className="w-4 h-4" />
              {t('graphExplorer.export.svg', { defaultValue: 'Export as SVG' })}
            </button>
            <button
              onClick={() => {
                console.info('[GraphToolbar] Exporting JSON...');
                canvasRef.current?.exportJSON();
                setExportOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors"
            >
              <PiFilePdfBold className="w-4 h-4" />
              {t('graphExplorer.export.json', { defaultValue: 'Export as JSON' })}
            </button>
            {onOpenInteractiveExport && (
              <button
                onClick={() => {
                  setExportOpen(false);
                  onOpenInteractiveExport();
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors"
              >
                <PiCodeBold className="w-4 h-4" />
                {t('graphExplorer.export.interactiveHtml', { defaultValue: 'Interactive HTML…' })}
              </button>
            )}
          </div>
        </ToolbarDropdown>
      </div>
    </div>
  );
}
