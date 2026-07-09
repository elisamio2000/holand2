'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Button, Dropdown } from 'rizzui';
import cn from '@core/utils/class-names';
import type { BoardEditorTab, BoardMode, BoardNodeRole, BoardNodeShape } from '../lib/board-types';
import type { GridPreferences } from '../lib/canvas/grid-preference';
import { getBindingsLabel } from '../lib/shortcuts/registry';
import { ShortcutsHelpDrawer, ShortcutsHelpPanel } from '../components/shortcuts-help-panel';
import { GridSettingsDropdown } from './grid-settings-dropdown';
import { BoardNodeShapePicker } from './board-node-shape-picker';
import { BoardDisplayFilter } from './board-display-filter';
import {
  PiArrowCounterClockwise,
  PiArrowClockwise,
  PiArrowLeft,
  PiChatCircle,
  PiClipboardText,
  PiCursor,
  PiDotsThreeOutline,
  PiHand,
  PiImage,
  PiNotePencil,
  PiPresentation,
  PiShareNetwork,
  PiGitBranch,
  PiPencilLine,
  PiDownloadSimple,
  PiCaretDown,
  PiSlidersHorizontal,
  PiSidebar,
  PiFrameCorners,
  PiPenNib,
  PiUploadSimple,
  PiPaperclip,
  PiMagnifyingGlass,
  PiWall,
  PiBracketsCurly,
  PiFileImage,
  PiMapTrifold,
  PiKeyboard,
} from 'react-icons/pi';

export type BoardExportFormat = 'json' | 'svg' | 'png';

export interface BoardToolbarProps {
  mode: BoardMode;
  activeTab: BoardEditorTab;
  canUndo: boolean;
  canRedo: boolean;
  legalHold?: boolean;
  isPresenting?: boolean;
  snapToGrid?: boolean;
  gridPreferences: GridPreferences;
  onGridPreferencesChange: (patch: Partial<GridPreferences>) => void;
  onModeChange: (mode: BoardMode) => void;
  onTabChange: (tab: BoardEditorTab) => void;
  onUndo: () => void;
  onRedo: () => void;
  onShare: () => void;
  onExport: (format: BoardExportFormat) => void;
  onPresent: () => void;
  onToggleSnap?: () => void;
  onCommentsOpen?: () => void;
  onAttachmentsOpen?: () => void;
  onOneSearch?: () => void;
  onApplyTemplate?: () => void;
  onBackToHub?: () => void;
  selectionPanelVisible?: boolean;
  settingsPanelVisible?: boolean;
  toolsPanelVisible?: boolean;
  onToggleSelectionPanel?: () => void;
  onToggleSettingsPanel?: () => void;
  onToggleToolsPanel?: () => void;
  miniMapVisible?: boolean;
  onToggleMiniMap?: () => void;
  nodeShape?: BoardNodeShape;
  onNodeShapeChange?: (shape: BoardNodeShape) => void;
  hiddenNodeRoles?: BoardNodeRole[];
  onHiddenNodeRolesChange?: (roles: BoardNodeRole[]) => void;
  onImport?: () => void;
  onImportShape?: () => void;
  className?: string;
}

const TAB_ICONS: Partial<Record<BoardEditorTab, React.ReactNode>> = {
  canvas: <PiCursor className="size-4 shrink-0" />,
  graph: <PiGitBranch className="size-4 shrink-0" />,
  report: <PiClipboardText className="size-4 shrink-0" />,
};

function MenuItemLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-flex size-4 shrink-0 items-center justify-center text-gray-600 dark:text-gray-400">
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}

export function BoardToolbar({
  mode,
  activeTab,
  canUndo,
  canRedo,
  legalHold,
  isPresenting,
  snapToGrid,
  gridPreferences,
  onGridPreferencesChange,
  onModeChange,
  onTabChange,
  onUndo,
  onRedo,
  onShare,
  onExport,
  onPresent,
  onToggleSnap,
  onCommentsOpen,
  onAttachmentsOpen,
  onOneSearch,
  onApplyTemplate,
  onBackToHub,
  selectionPanelVisible,
  settingsPanelVisible,
  toolsPanelVisible,
  onToggleSelectionPanel,
  onToggleSettingsPanel,
  onToggleToolsPanel,
  miniMapVisible,
  onToggleMiniMap,
  nodeShape = 'ellipse',
  onNodeShapeChange,
  hiddenNodeRoles = [],
  onHiddenNodeRolesChange,
  onImport,
  onImportShape,
  className,
}: BoardToolbarProps) {
  const { t } = useTranslation();
  const [shortcutsDrawerOpen, setShortcutsDrawerOpen] = useState(false);

  const toolBtn = (m: BoardMode, icon: React.ReactNode, label: string, shortcutId: string) => {
    const binding = getBindingsLabel(shortcutId);
    const tip = binding ? `${label} (${binding})` : label;
    return (
      <Tooltip content={tip} placement="bottom">
        <ActionIcon
          variant={mode === m ? 'solid' : 'outline'}
          size="sm"
          onClick={() => onModeChange(m)}
          aria-label={label}
        >
          {icon}
        </ActionIcon>
      </Tooltip>
    );
  };

  const viewTabs: { id: BoardEditorTab; label: string }[] = [
    { id: 'canvas', label: t('boards.tabs.canvas', 'Canvas') },
    { id: 'graph', label: t('boards.tabs.graph', 'Graph') },
    { id: 'report', label: t('boards.tabs.report', 'Report') },
  ];

  const isCanvasTab = activeTab === 'canvas';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 border-b border-muted bg-white px-2 py-1.5 dark:bg-gray-100 sm:gap-2 sm:px-3 sm:py-2',
        className
      )}
    >
      <div className="flex items-center gap-0.5 sm:gap-1">
        {toolBtn('select', <PiCursor className="size-4" />, t('boards.tools.select', 'Select'), 'tool.select')}
        {toolBtn('pan', <PiHand className="size-4" />, t('boards.tools.pan', 'Pan'), 'tool.pan')}
        {isCanvasTab ? (
          <>
            {toolBtn('addSticky', <PiNotePencil className="size-4" />, t('boards.tools.sticky', 'Sticky'), 'tool.sticky')}
            {toolBtn('addImage', <PiImage className="size-4" />, t('boards.tools.image', 'Image'), 'tool.sticky')}
            {toolBtn('addNode', <PiGitBranch className="size-4" />, t('boards.tools.node', 'Node'), 'tool.node')}
            {toolBtn('addEdge', <PiGitBranch className="size-4 rotate-90" />, t('boards.tools.edge', 'Connect'), 'tool.edge')}
            {toolBtn('addFrame', <PiFrameCorners className="size-4" />, t('boards.tools.frame', 'Frame'), 'tool.frame')}
            {toolBtn('addVector', <PiPenNib className="size-4" />, t('boards.tools.vector', 'Draw shape'), 'tool.addVector')}
            {onNodeShapeChange ? (
              <span className="hidden md:inline-flex">
                <BoardNodeShapePicker activeShape={nodeShape} onShapeChange={onNodeShapeChange} compact />
              </span>
            ) : null}
            <span className="hidden md:contents">
              {toolBtn('addComment', <PiChatCircle className="size-4" />, t('boards.tools.comment', 'Comment'), 'tool.comment')}
              {toolBtn('draw', <PiPencilLine className="size-4" />, t('boards.tools.draw', 'Draw'), 'tool.draw')}
            </span>
            <Dropdown className="md:hidden">
              <Dropdown.Trigger>
                <ActionIcon variant="outline" size="sm" aria-label={t('boards.tools.more', 'More tools')}>
                  <PiDotsThreeOutline className="size-4" />
                </ActionIcon>
              </Dropdown.Trigger>
              <Dropdown.Menu className="min-w-[140px]">
                <Dropdown.Item onClick={() => onModeChange('addComment')}>{t('boards.tools.comment', 'Comment')}</Dropdown.Item>
                <Dropdown.Item onClick={() => onModeChange('draw')}>{t('boards.tools.draw', 'Draw')}</Dropdown.Item>
                {onNodeShapeChange ? (
                  <>
                    <div className="my-1 border-t border-muted" />
                    <div className="px-2 py-1 text-[10px] font-medium uppercase text-gray-500">
                      {t('boards.shape.title', 'Node shape')}
                    </div>
                    {(['rectangle', 'rounded', 'ellipse', 'diamond'] as BoardNodeShape[]).map((shape) => (
                      <Dropdown.Item
                        key={shape}
                        onClick={() => onNodeShapeChange(shape)}
                        className={nodeShape === shape ? 'bg-muted/60' : ''}
                      >
                        {t(`boards.shape.${shape}`, shape)}
                      </Dropdown.Item>
                    ))}
                  </>
                ) : null}
              </Dropdown.Menu>
            </Dropdown>
          </>
        ) : activeTab === 'graph' ? (
          <span className="hidden px-1 text-xs text-gray-500 sm:inline">
            {t('boards.graph.toolbarHint', 'Topology tools are in the graph panel below')}
          </span>
        ) : null}
      </div>

      <div className="hidden h-5 w-px bg-muted sm:block" />

      <div className="flex items-center gap-0.5 sm:gap-1">
        <Tooltip content={t('boards.undo', 'Undo')} placement="bottom">
          <ActionIcon variant="outline" size="sm" disabled={!canUndo} onClick={onUndo} aria-label="Undo">
            <PiArrowCounterClockwise className="size-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('boards.redo', 'Redo')} placement="bottom">
          <ActionIcon variant="outline" size="sm" disabled={!canRedo} onClick={onRedo} aria-label="Redo">
            <PiArrowClockwise className="size-4" />
          </ActionIcon>
        </Tooltip>
        {isCanvasTab ? (
          <>
            <GridSettingsDropdown
              preferences={gridPreferences}
              snapToGrid={Boolean(snapToGrid)}
              onChange={onGridPreferencesChange}
              onToggleSnap={() => onToggleSnap?.()}
            />
            {onHiddenNodeRolesChange ? (
              <BoardDisplayFilter hiddenRoles={hiddenNodeRoles} onChange={onHiddenNodeRolesChange} />
            ) : null}
          </>
        ) : null}
        {onToggleMiniMap && activeTab === 'canvas' ? (
          <Tooltip
            content={
              miniMapVisible
                ? t('boards.minimap.hide', 'Hide mini-map')
                : t('boards.minimap.show', 'Show mini-map')
            }
            placement="bottom"
          >
            <ActionIcon
              variant={miniMapVisible ? 'solid' : 'outline'}
              size="sm"
              onClick={onToggleMiniMap}
              aria-label={
                miniMapVisible
                  ? t('boards.minimap.hide', 'Hide mini-map')
                  : t('boards.minimap.show', 'Show mini-map')
              }
            >
              <PiMapTrifold className="size-4" />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>

      <div className="hidden h-5 w-px bg-muted lg:block" />

      <div className="hidden items-center gap-0.5 lg:flex">
        {viewTabs.map((tab) => (
          <Tooltip key={tab.id} content={tab.label} placement="bottom">
            <ActionIcon
              variant={activeTab === tab.id ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
            >
              {TAB_ICONS[tab.id]}
            </ActionIcon>
          </Tooltip>
        ))}
      </div>
      <Dropdown className="lg:hidden">
        <Dropdown.Trigger>
          <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs">
            {TAB_ICONS[activeTab === 'present' ? 'canvas' : activeTab]}
            <PiCaretDown className="size-3" />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Menu>
          {viewTabs.map((tab) => (
            <Dropdown.Item key={tab.id} onClick={() => onTabChange(tab.id)}>
              <MenuItemLabel icon={TAB_ICONS[tab.id]}>{tab.label}</MenuItemLabel>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>

      <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
        {legalHold ? (
          <span className="hidden text-[10px] font-medium text-amber-600 sm:inline">{t('boards.legalHold', 'Legal hold')}</span>
        ) : null}

        <Dropdown>
          <Dropdown.Trigger>
            <Tooltip content={t('boards.menu.board', 'Board menu')} placement="bottom">
              <ActionIcon variant="outline" size="sm" aria-label={t('boards.menu.board', 'Board menu')}>
                <PiDotsThreeOutline className="size-4" />
              </ActionIcon>
            </Tooltip>
          </Dropdown.Trigger>
          <Dropdown.Menu className="min-w-[200px]">
            {onToggleToolsPanel ? (
              <Dropdown.Item onClick={onToggleToolsPanel}>
                <MenuItemLabel icon={<PiGitBranch className="size-4" />}>
                  {toolsPanelVisible
                    ? t('boards.panel.hideTools', 'Hide node tools')
                    : t('boards.panel.showTools', 'Show node tools')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onToggleSelectionPanel ? (
              <Dropdown.Item onClick={onToggleSelectionPanel}>
                <MenuItemLabel icon={<PiSidebar className="size-4" />}>
                  {selectionPanelVisible
                    ? t('boards.panel.hideSelection', 'Hide selection panel')
                    : t('boards.panel.showSelection', 'Show selection panel')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onToggleSettingsPanel ? (
              <Dropdown.Item onClick={onToggleSettingsPanel}>
                <MenuItemLabel icon={<PiSlidersHorizontal className="size-4" />}>
                  {settingsPanelVisible
                    ? t('boards.panel.hideSettings', 'Hide board settings')
                    : t('boards.panel.showSettings', 'Show board settings')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onToggleMiniMap && activeTab === 'canvas' ? (
              <Dropdown.Item onClick={onToggleMiniMap}>
                <MenuItemLabel icon={<PiMapTrifold className="size-4" />}>
                  {miniMapVisible
                    ? t('boards.minimap.hide', 'Hide mini-map')
                    : t('boards.minimap.show', 'Show mini-map')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onCommentsOpen ? (
              <Dropdown.Item onClick={onCommentsOpen}>
                <MenuItemLabel icon={<PiChatCircle className="size-4" />}>
                  {t('boards.comments.open', 'Comments')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onAttachmentsOpen ? (
              <Dropdown.Item onClick={onAttachmentsOpen}>
                <MenuItemLabel icon={<PiPaperclip className="size-4" />}>
                  {t('boards.attachments.open', 'Attachments')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onOneSearch ? (
              <Dropdown.Item onClick={onOneSearch}>
                <MenuItemLabel icon={<PiMagnifyingGlass className="size-4" />}>
                  {t('boards.openOneSearch', 'Visual search')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onApplyTemplate ? (
              <Dropdown.Item onClick={onApplyTemplate}>
                <MenuItemLabel icon={<PiWall className="size-4" />}>
                  {t('boards.applyEvidenceTemplate', 'Evidence wall template')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onBackToHub ? (
              <Dropdown.Item onClick={onBackToHub}>
                <MenuItemLabel icon={<PiArrowLeft className="size-4" />}>
                  {t('boards.backToHub', 'All boards')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            <Dropdown.Item className="lg:hidden" onClick={() => setShortcutsDrawerOpen(true)}>
              <MenuItemLabel icon={<PiKeyboard className="size-4" />}>
                {t('boards.shortcuts.title', 'Keyboard shortcuts')}
              </MenuItemLabel>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <span className="hidden items-center gap-0.5 lg:flex">
          {onToggleToolsPanel ? (
            <Tooltip content={t('boards.panel.tools', 'Node tools')} placement="bottom">
              <ActionIcon
                variant={toolsPanelVisible ? 'solid' : 'outline'}
                size="sm"
                onClick={onToggleToolsPanel}
                aria-label={t('boards.panel.tools', 'Node tools')}
              >
                <PiGitBranch className="size-4" />
              </ActionIcon>
            </Tooltip>
          ) : null}
          <Tooltip content={t('boards.panel.selection', 'Selection panel')} placement="bottom">
            <ActionIcon
              variant={selectionPanelVisible ? 'solid' : 'outline'}
              size="sm"
              onClick={onToggleSelectionPanel}
              aria-label={t('boards.panel.selection', 'Selection')}
            >
              <PiSidebar className="size-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('boards.panel.settings', 'Board settings')} placement="bottom">
            <ActionIcon
              variant={settingsPanelVisible ? 'solid' : 'outline'}
              size="sm"
              onClick={onToggleSettingsPanel}
              aria-label={t('boards.panel.settings', 'Settings')}
            >
              <PiSlidersHorizontal className="size-4" />
            </ActionIcon>
          </Tooltip>
        </span>

        <ShortcutsHelpPanel className="hidden lg:inline-flex" />

        <ShortcutsHelpDrawer open={shortcutsDrawerOpen} onClose={() => setShortcutsDrawerOpen(false)} />

        <Dropdown>
          <Dropdown.Trigger>
            <Tooltip content={t('boards.export', 'Export')} placement="bottom">
              <ActionIcon variant="outline" size="sm" aria-label={t('boards.export', 'Export')}>
                <PiDownloadSimple className="size-4" />
              </ActionIcon>
            </Tooltip>
          </Dropdown.Trigger>
          <Dropdown.Menu className="min-w-[120px]">
            <Dropdown.Item onClick={() => onExport('json')}>
              <MenuItemLabel icon={<PiBracketsCurly className="size-4" />}>JSON</MenuItemLabel>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => onExport('svg')}>
              <MenuItemLabel icon={<PiPenNib className="size-4" />}>SVG</MenuItemLabel>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => onExport('png')}>
              <MenuItemLabel icon={<PiFileImage className="size-4" />}>PNG</MenuItemLabel>
            </Dropdown.Item>
            {onImport ? (
              <Dropdown.Item onClick={onImport}>
                <MenuItemLabel icon={<PiUploadSimple className="size-4" />}>
                  {t('boards.import.label', 'Import JSON…')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
            {onImportShape ? (
              <Dropdown.Item onClick={onImportShape}>
                <MenuItemLabel icon={<PiPenNib className="size-4" />}>
                  {t('boards.vector.importLabel', 'Import SVG shape…')}
                </MenuItemLabel>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown>

        <Tooltip content={t('boards.share', 'Share')} placement="bottom">
          <ActionIcon variant="outline" size="sm" onClick={onShare} aria-label={t('boards.share', 'Share')}>
            <PiShareNetwork className="size-4" />
          </ActionIcon>
        </Tooltip>

        <Tooltip
          content={isPresenting ? t('boards.exitPresent', 'Exit presentation') : t('boards.present', 'Present')}
          placement="bottom"
        >
          <ActionIcon
            variant={isPresenting || activeTab === 'present' ? 'solid' : 'outline'}
            size="sm"
            onClick={onPresent}
            aria-label={t('boards.present', 'Present')}
          >
            <PiPresentation className="size-4" />
          </ActionIcon>
        </Tooltip>

        {onBackToHub ? (
          <Tooltip content={t('boards.backToHub', 'All boards')} placement="bottom">
            <ActionIcon variant="outline" size="sm" onClick={onBackToHub} aria-label={t('boards.backToHub', 'All boards')} className="sm:hidden">
              <PiArrowLeft className="size-4" />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
