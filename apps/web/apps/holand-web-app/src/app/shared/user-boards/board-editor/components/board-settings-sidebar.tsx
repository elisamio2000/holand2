'use client';

import { useTranslation } from 'react-i18next';
import { Input, Text, Title } from 'rizzui';
import type { BoardEditorTab, BoardRecord, BoardSnapshot } from '../../lib/board-types';
import type { GraphSettings } from '@/types/graph-explorer.types';
import type { BoardStyleDefaults, BoardBackgroundLayer } from '../../lib/board-types';
import type { BooleanOp } from '../../lib/canvas/boolean-combine';
import type { LayerMove } from '../../lib/canvas/layer-order';
import type { BoardObject, BoardInkStroke } from '../../lib/board-types';
import { BoardInfoSection } from './board-info-section';
import { BoardGraphSettingsPanel } from './board-graph-settings-panel';
import { BoardInspector } from '../board-inspector';
import { BoardAiSelectionPanel } from '../board-ai-selection-panel';

export interface BoardSettingsSidebarProps {
  activeTab: BoardEditorTab;
  board: BoardRecord;
  graphSettings?: GraphSettings;
  onGraphSettingsChange?: (settings: GraphSettings) => void;
  onReportChange?: (patch: Partial<Pick<BoardSnapshot, 'reportTitle' | 'reportContent'>>) => void;
  selectedObjects: BoardObject[];
  selectedInk: BoardInkStroke | null;
  onTitleChange: (title: string) => void;
  onCaseIdChange: (caseId: string) => void;
  onObjectPatch: (id: string, patch: Partial<BoardObject>) => void;
  onBulkObjectPatch?: (ids: string[], patch: Partial<BoardObject>) => void;
  onInkPatch: (id: string, patch: Partial<BoardInkStroke>) => void;
  onStyleDefaultsChange: (patch: Partial<BoardStyleDefaults>) => void;
  onToggleLegalHold: () => void;
  readOnly?: boolean;
  onCheckpointRestore?: (snapshot: BoardSnapshot) => void;
  onPresentFrame?: (frameId: string) => void;
  onBackgroundLayersChange?: (layers: BoardBackgroundLayer[]) => void;
  onLayerMove?: (move: LayerMove) => void;
  onBooleanCombine?: (op: BooleanOp) => void;
  className?: string;
}

function BoardReportSettingsPanel({
  reportTitle,
  onReportTitleChange,
}: {
  reportTitle: string;
  onReportTitleChange: (title: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Title as="h6" className="mb-2 text-sm">
        {t('boards.settings.reportDisplay', 'Report')}
      </Title>
      <Input
        label={t('boards.report.heading', 'Heading')}
        value={reportTitle}
        onChange={(e) => onReportTitleChange(e.target.value)}
        size="sm"
      />
      <Text className="mt-3 text-xs text-gray-500">
        {t(
          'boards.settings.reportBodyHint',
          'Edit the report body in the main panel. Heading and content are saved with this board.'
        )}
      </Text>
    </div>
  );
}

export function BoardSettingsSidebar({
  activeTab,
  board,
  graphSettings,
  onGraphSettingsChange,
  onReportChange,
  selectedObjects,
  selectedInk,
  onTitleChange,
  onCaseIdChange,
  onObjectPatch,
  onBulkObjectPatch,
  onInkPatch,
  onStyleDefaultsChange,
  onToggleLegalHold,
  readOnly,
  onCheckpointRestore,
  onPresentFrame,
  onBackgroundLayersChange,
  onLayerMove,
  onBooleanCombine,
  className,
}: BoardSettingsSidebarProps) {
  const sharedInfo = (
    <BoardInfoSection
      board={board}
      onTitleChange={onTitleChange}
      onCaseIdChange={onCaseIdChange}
      onToggleLegalHold={onToggleLegalHold}
    />
  );

  return (
    <div className={`flex h-full flex-col gap-4 overflow-y-auto p-4 ${className ?? ''}`}>
      {sharedInfo}

      {activeTab === 'canvas' ? (
        <BoardInspector
          board={board}
          selectedObjects={selectedObjects}
          selectedInk={selectedInk}
          variant="board"
          showBoardMeta={false}
          onTitleChange={onTitleChange}
          onCaseIdChange={onCaseIdChange}
          onObjectPatch={onObjectPatch}
          onBulkObjectPatch={onBulkObjectPatch}
          onInkPatch={onInkPatch}
          onStyleDefaultsChange={onStyleDefaultsChange}
          onToggleLegalHold={onToggleLegalHold}
          readOnly={readOnly}
          onCheckpointRestore={onCheckpointRestore}
          onPresentFrame={onPresentFrame}
          onBackgroundLayersChange={onBackgroundLayersChange}
          onLayerMove={onLayerMove}
          onBooleanCombine={onBooleanCombine}
          className="border-0 p-0"
        />
      ) : null}

      {activeTab === 'graph' && graphSettings && onGraphSettingsChange ? (
        <BoardGraphSettingsPanel
          settings={graphSettings}
          onSettingsChange={onGraphSettingsChange}
        />
      ) : null}

      {activeTab === 'report' ? (
        <BoardReportSettingsPanel
          reportTitle={board.snapshot.reportTitle ?? ''}
          onReportTitleChange={(title) => onReportChange?.({ reportTitle: title })}
        />
      ) : null}

      {activeTab === 'canvas' ? (
        <BoardAiSelectionPanel boardId={board.id} selectedObjects={selectedObjects} />
      ) : null}
    </div>
  );
}
