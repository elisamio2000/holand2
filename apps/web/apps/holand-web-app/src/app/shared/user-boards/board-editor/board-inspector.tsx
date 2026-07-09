'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Switch, Text, Textarea, Title } from 'rizzui';
import type {
  BoardConnectorObject,
  BoardFrameObject,
  BoardInkStroke,
  BoardNodeObject,
  BoardObject,
  BoardObjectBase,
  BoardRecord,
  BoardSnapshot,
  BoardStickyObject,
  BoardStyleDefaults,
  BoardVectorObject,
  BoardNodeShape,
} from '../lib/board-types';
import { geometryFromPreset, resolveGeometryFromNode } from '../lib/canvas/shape-geometry';
import { BoardColorPicker } from '../components/board-color-picker';
import { getBoardStyleDefaults, resolveConnectorStyle } from '../lib/board-style';
import {
  addNodeAnchorLink,
  countMagnetAttachments,
  getNodeAnchorPeers,
  magnetDetachPatch,
} from '../lib/canvas/node-magnet';
import { InspectorAnchorLinksSection } from './components/inspector-anchor-links-section';
import { BoardDefaultsPanel } from './components/board-defaults-panel';
import { StickyInkPreview } from './components/sticky-ink-preview';
import { InspectorArrangeToolbar } from './components/inspector-arrange-toolbar';
import { InspectorBooleanToolbar } from './components/inspector-boolean-toolbar';
import { NODE_SHAPE_OPTIONS } from './board-node-shape-picker';
import { BoardCheckpointsPanel } from './board-checkpoints-panel';
import { CornerRadiusField } from '../components/corner-radius-field';
import { OpacityField } from '../components/opacity-field';
import {
  ArrowDirectionField,
  RouteStyleField,
  StrokeStyleField,
} from '../components/connector-style-fields';
import type { LayerMove } from '../lib/canvas/layer-order';
import type { BooleanOp } from '../lib/canvas/boolean-combine';
import { CompactNumField } from '../components/compact-num-field';
import { BoardBackgroundLayersSettings } from './board-background-layers-settings';
import type { BoardBackgroundLayer } from '../lib/board-types';
import type { BoardAttachmentRef, BoardMediaObject } from '../lib/board-types';

export interface BoardInspectorProps {
  board: BoardRecord;
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
  focusLabelObjectId?: string | null;
  onLabelFocusDone?: () => void;
  onLayerMove?: (move: LayerMove) => void;
  onBooleanCombine?: (op: BooleanOp) => void;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onLinkSelectedNodes?: () => void;
  onLinkConnectedNodes?: () => void;
  onAnchorLinkChange?: (nodeId: string, otherId: string, linked: boolean) => void;
  onUnlinkAllAmong?: () => void;
  onNodeLabelEditStart?: () => void;
  onNodeLabelEditEnd?: () => void;
  onBackgroundLayersChange?: (layers: BoardBackgroundLayer[]) => void;
  attachments?: BoardAttachmentRef[];
  onJumpToAttachment?: (libraryId: string) => void;
  onDetachMediaFromLibrary?: (mediaId: string) => void;
  onDeleteMedia?: () => void;
  onReplaceMediaArtifact?: (mediaId: string, artifactId: string) => void;
  /** board = global settings only; selection = selected item only; all = both (mobile drawer) */
  variant?: 'all' | 'board' | 'selection';
  /** When false, skips title/case/hold block (used inside BoardSettingsSidebar) */
  showBoardMeta?: boolean;
  className?: string;
}

function isSpatialObject(obj: BoardObject): obj is BoardObject & BoardObjectBase {
  return obj.type !== 'connector' && 'x' in obj;
}

function MediaArtifactReplaceField({
  mediaId,
  currentArtifactId,
  onReplace,
}: {
  mediaId: string;
  currentArtifactId?: string;
  onReplace: (mediaId: string, artifactId: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentArtifactId ?? '');
  return (
    <div className="flex gap-2">
      <Input
        size="sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('boards.inspector.replaceArtifactId', 'New artifact ID')}
        className="flex-1"
      />
      <button
        type="button"
        className="shrink-0 self-end text-[10px] text-primary underline"
        disabled={!value.trim()}
        onClick={() => onReplace(mediaId, value.trim())}
      >
        {t('boards.inspector.replaceFile', 'Replace')}
      </button>
    </div>
  );
}

export function BoardInspector({
  board,
  selectedObjects,
  selectedInk,
  onTitleChange,
  onCaseIdChange,
  onObjectPatch,
  onBulkObjectPatch,
  onInkPatch,
  onStyleDefaultsChange,
  onToggleLegalHold,
  readOnly = false,
  onCheckpointRestore,
  onPresentFrame,
  focusLabelObjectId,
  onLabelFocusDone,
  onLayerMove,
  onBooleanCombine,
  onGroupSelection,
  onUngroupSelection,
  onLinkSelectedNodes,
  onLinkConnectedNodes,
  onAnchorLinkChange,
  onUnlinkAllAmong,
  onNodeLabelEditStart,
  onNodeLabelEditEnd,
  onBackgroundLayersChange,
  attachments = [],
  onJumpToAttachment,
  onDetachMediaFromLibrary,
  onDeleteMedia,
  onReplaceMediaArtifact,
  variant = 'all',
  showBoardMeta = true,
  className,
}: BoardInspectorProps) {
  const { t } = useTranslation();
  const nodeLabelRef = useRef<HTMLInputElement>(null);
  const connectorLabelRef = useRef<HTMLInputElement>(null);
  const sel = selectedObjects[0];
  const multi = selectedObjects.length > 1;
  const bulkIds = selectedObjects.map((o) => o.id);
  const uniformType =
    multi && selectedObjects.every((o) => o.type === selectedObjects[0].type)
      ? selectedObjects[0].type
      : null;
  const bulkPatch = (patch: Partial<BoardObject>) => {
    if (onBulkObjectPatch) onBulkObjectPatch(bulkIds, patch);
    else for (const id of bulkIds) onObjectPatch(id, patch);
  };
  const boardDefaults = getBoardStyleDefaults(board.snapshot);
  const showBoard = variant === 'all' || variant === 'board';
  const showSelection = variant === 'all' || variant === 'selection';
  const spatialSelection = selectedObjects.filter(isSpatialObject);
  const canArrange = spatialSelection.length > 0 && Boolean(onLayerMove);
  const canCombine = spatialSelection.length >= 2 && Boolean(onBooleanCombine);
  const canGroup = spatialSelection.length >= 2 && Boolean(onGroupSelection);
  const canUngroup =
    spatialSelection.some((o) => o.objectGroupId) && Boolean(onUngroupSelection);
  const selectedNodeIds = selectedObjects.filter((o) => o.type === 'node').map((o) => o.id);
  const canLinkNodes = selectedNodeIds.length >= 2 && Boolean(onLinkSelectedNodes);

  useEffect(() => {
    if (!focusLabelObjectId || !sel || sel.id !== focusLabelObjectId) return;
    const id = window.requestAnimationFrame(() => {
      if (sel.type === 'node') {
        nodeLabelRef.current?.focus();
        nodeLabelRef.current?.select();
      } else if (sel.type === 'connector') {
        connectorLabelRef.current?.focus();
        connectorLabelRef.current?.select();
      }
      onLabelFocusDone?.();
    });
    return () => window.cancelAnimationFrame(id);
  }, [focusLabelObjectId, sel, onLabelFocusDone]);

  return (
    <div className={`flex h-full flex-col gap-4 overflow-y-auto p-4 ${variant === 'all' ? 'border-s border-muted' : ''} ${className ?? ''}`}>
      {showBoard && showBoardMeta ? (
      <div>
        <Title as="h6" className="mb-2 text-sm">
          {t('boards.inspector.board', 'Board')}
        </Title>
        <Input
          label={t('boards.inspector.title', 'Title')}
          value={board.title}
          onChange={(e) => onTitleChange(e.target.value)}
          size="sm"
        />
        <Input
          className="mt-2"
          label={t('boards.inspector.caseId', 'Case ID (optional)')}
          value={board.caseId ?? ''}
          onChange={(e) => onCaseIdChange(e.target.value)}
          size="sm"
          placeholder="case-uuid"
        />
        <button
          type="button"
          className="mt-2 text-xs text-amber-600 underline"
          onClick={onToggleLegalHold}
        >
          {board.snapshot.legalHold
            ? t('boards.inspector.releaseHold', 'Release legal hold')
            : t('boards.inspector.applyHold', 'Apply legal hold')}
        </button>
      </div>
      ) : null}

      {showBoard ? (
      <div>
        <BoardDefaultsPanel
          styleDefaults={board.snapshot.styleDefaults ?? {}}
          onChange={onStyleDefaultsChange}
        />
        {onCheckpointRestore ? (
          <BoardCheckpointsPanel
            boardId={board.id}
            snapshot={board.snapshot}
            readOnly={readOnly || board.snapshot.legalHold}
            onRestore={onCheckpointRestore}
          />
        ) : null}
        {onBackgroundLayersChange ? (
          <BoardBackgroundLayersSettings
            layers={board.snapshot.backgroundLayers ?? []}
            onChange={onBackgroundLayersChange}
          />
        ) : null}
      </div>
      ) : null}

      {showSelection ? (
      <div>
        <Title as="h6" className="mb-2 text-sm">
          {t('boards.inspector.selection', 'Selection')}
        </Title>
        {canArrange ? (
          <InspectorArrangeToolbar onLayerMove={onLayerMove!} disabled={readOnly} />
        ) : null}
        {canCombine ? (
          <InspectorBooleanToolbar onCombine={onBooleanCombine!} disabled={readOnly} />
        ) : null}
        {canGroup || canUngroup || canLinkNodes ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {canGroup ? (
              <button
                type="button"
                disabled={readOnly}
                className="rounded border border-muted px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
                onClick={onGroupSelection}
              >
                {t('boards.group.title', 'Group')}
              </button>
            ) : null}
            {canUngroup ? (
              <button
                type="button"
                disabled={readOnly}
                className="rounded border border-muted px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
                onClick={onUngroupSelection}
              >
                {t('boards.group.ungroup', 'Ungroup')}
              </button>
            ) : null}
            {canLinkNodes ? (
              <button
                type="button"
                disabled={readOnly}
                className="rounded border border-muted px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
                onClick={onLinkSelectedNodes}
              >
                {t('boards.link.syncMove', 'Link for move')}
              </button>
            ) : null}
            {onLinkConnectedNodes && selectedNodeIds.length >= 2 ? (
              <button
                type="button"
                disabled={readOnly}
                className="rounded border border-muted px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
                onClick={onLinkConnectedNodes}
              >
                {t('boards.link.connected', 'Link connected')}
              </button>
            ) : null}
          </div>
        ) : null}
        {canArrange || canCombine || canGroup || canUngroup || canLinkNodes ? (
          <div className="my-2 h-px bg-muted" />
        ) : null}
        {selectedInk ? (
          <div className="space-y-1.5">
            <Text className="text-xs text-gray-500">{t('boards.inspector.inkStroke', 'Ink stroke')}</Text>
            <BoardColorPicker
              label={t('boards.inspector.color', 'Color')}
              value={selectedInk.color}
              onChange={(color) => onInkPatch(selectedInk.id, { color })}
            />
            <CompactNumField
              label={t('boards.inspector.strokeWidth', 'Stroke width')}
              value={selectedInk.width}
              min={0.5}
              max={24}
              step={0.5}
              onChange={(v) => onInkPatch(selectedInk.id, { width: v })}
            />
            <OpacityField
              label={t('boards.inspector.opacity', 'Opacity')}
              value={selectedInk.opacity ?? boardDefaults.inkOpacity ?? 1}
              onChange={(v) => onInkPatch(selectedInk.id, { opacity: v })}
            />
          </div>
        ) : multi && !uniformType ? (
          <Text className="text-xs text-gray-500">
            {t('boards.inspector.mixedSelection', '{{count}} mixed items — select same type for bulk edit', {
              count: selectedObjects.length,
            })}
          </Text>
        ) : multi && uniformType === 'connector' ? (
          (() => {
            const first = selectedObjects[0] as BoardConnectorObject;
            const visual = resolveConnectorStyle(first, board.snapshot.styleDefaults);
            const routeStyle = first.routeStyle ?? boardDefaults.connectorRouteStyle ?? 'curved';
            return (
              <div className="space-y-1.5 text-xs">
                <Text className="text-gray-500">
                  {t('boards.inspector.bulkConnectors', '{{count}} connectors', { count: selectedObjects.length })}
                </Text>
                <BoardColorPicker
                  label={t('boards.inspector.color', 'Color')}
                  value={first.color ?? ''}
                  placeholder={visual.color}
                  onChange={(color) => bulkPatch({ color })}
                />
                <CompactNumField
                  label={t('boards.inspector.strokeWidth', 'Stroke width')}
                  value={first.strokeWidth ?? visual.strokeWidth}
                  min={1}
                  max={12}
                  onChange={(v) => bulkPatch({ strokeWidth: v })}
                />
                <StrokeStyleField
                  value={first.strokeStyle ?? visual.strokeStyle}
                  onChange={(strokeStyle) => bulkPatch({ strokeStyle })}
                />
                <ArrowDirectionField
                  value={first.arrowDirection ?? visual.arrowDirection}
                  onChange={(arrowDirection) => bulkPatch({ arrowDirection })}
                />
                <RouteStyleField
                  value={routeStyle}
                  onChange={(routeStyle) => bulkPatch({ routeStyle })}
                />
                <OpacityField
                  label={t('boards.inspector.opacity', 'Opacity')}
                  value={first.opacity ?? visual.opacity ?? 1}
                  onChange={(v) => bulkPatch({ opacity: v })}
                />
              </div>
            );
          })()
        ) : multi && uniformType === 'node' ? (
          <div className="space-y-1.5 text-xs">
            <Text className="text-gray-500">
              {t('boards.inspector.bulkNodes', '{{count}} nodes', { count: selectedObjects.length })}
            </Text>
            <BoardColorPicker
              label={t('boards.inspector.color', 'Color')}
              value={(selectedObjects[0] as BoardNodeObject).color}
              onChange={(color) => bulkPatch({ color })}
            />
            <OpacityField
              label={t('boards.inspector.opacity', 'Opacity')}
              value={(selectedObjects[0] as BoardNodeObject).opacity ?? boardDefaults.objectOpacity ?? 1}
              onChange={(v) => bulkPatch({ opacity: v })}
            />
            <div className="mt-2 rounded border border-muted p-2">
              <InspectorAnchorLinksSection
                objects={board.snapshot.objects}
                nodeIds={selectedNodeIds}
                readOnly={readOnly}
                onAnchorLinkChange={onAnchorLinkChange}
                onUnlinkAllAmong={onUnlinkAllAmong}
              />
            </div>
          </div>
        ) : multi && uniformType === 'sticky' ? (
          <div className="space-y-1.5 text-xs">
            <Text className="text-gray-500">
              {t('boards.inspector.bulkStickies', '{{count}} stickies', { count: selectedObjects.length })}
            </Text>
            <BoardColorPicker
              label={t('boards.inspector.color', 'Color')}
              value={(selectedObjects[0] as BoardStickyObject).color}
              onChange={(color) => bulkPatch({ color })}
            />
            <OpacityField
              label={t('boards.inspector.opacity', 'Opacity')}
              value={(selectedObjects[0] as BoardStickyObject).opacity ?? boardDefaults.objectOpacity ?? 1}
              onChange={(v) => bulkPatch({ opacity: v })}
            />
          </div>
        ) : !sel ? (
          <Text className="text-xs text-gray-500">{t('boards.inspector.none', 'Nothing selected')}</Text>
        ) : sel.type === 'connector' ? (
          (() => {
            const conn = sel;
            const visual = resolveConnectorStyle(conn, board.snapshot.styleDefaults);
            const routeStyle = conn.routeStyle ?? boardDefaults.connectorRouteStyle ?? 'curved';
            return (
              <div className="space-y-1.5 text-xs">
                <Text className="font-mono text-gray-500">{sel.type}</Text>
                <Input
                  size="sm"
                  label={t('boards.inspector.edgeLabel', 'Label')}
                  value={conn.label ?? ''}
                  ref={connectorLabelRef}
                  onChange={(e) => onObjectPatch(sel.id, { label: e.target.value })}
                />
                <Textarea
                  label={t('boards.inspector.note', 'Note')}
                  value={conn.note ?? ''}
                  onChange={(e) => onObjectPatch(sel.id, { note: e.target.value })}
                  rows={3}
                  className="text-xs"
                />
                <BoardColorPicker
                  label={t('boards.inspector.color', 'Color')}
                  value={conn.color ?? ''}
                  placeholder={visual.color}
                  allowClear
                  onClear={() => onObjectPatch(sel.id, { color: undefined })}
                  onChange={(color) => onObjectPatch(sel.id, { color })}
                />
                <CompactNumField
                  label={t('boards.inspector.strokeWidth', 'Stroke width')}
                  value={conn.strokeWidth ?? visual.strokeWidth}
                  min={0.5}
                  max={24}
                  step={0.5}
                  onChange={(v) => onObjectPatch(sel.id, { strokeWidth: v })}
                />
                <StrokeStyleField
                  value={conn.strokeStyle ?? visual.strokeStyle}
                  onChange={(strokeStyle) => onObjectPatch(sel.id, { strokeStyle })}
                />
                <OpacityField
                  label={t('boards.inspector.opacity', 'Opacity')}
                  value={conn.opacity ?? visual.opacity}
                  onChange={(v) => onObjectPatch(sel.id, { opacity: v })}
                />
                <ArrowDirectionField
                  value={visual.arrowDirection}
                  onChange={(arrowDirection) => onObjectPatch(sel.id, { arrowDirection })}
                />
                <RouteStyleField
                  value={routeStyle}
                  onChange={(routeStyle) => onObjectPatch(sel.id, { routeStyle })}
                />
                {routeStyle === 'curved' ? (
                  <CompactNumField
                    label={t('boards.inspector.curveStrength', 'Curve strength')}
                    value={Math.round((conn.curveStrength ?? 0.45) * 100)}
                    onChange={(v) =>
                      onObjectPatch(sel.id, { curveStrength: Math.min(1, Math.max(0, v / 100)) })
                    }
                  />
                ) : null}
                {routeStyle === 'orthogonal' ? (
                  <CompactNumField
                    label={t('boards.inspector.bendOffset', 'Bend offset')}
                    value={conn.bendOffset ?? 0}
                    onChange={(v) => onObjectPatch(sel.id, { bendOffset: v })}
                  />
                ) : null}
                <Text className="text-[10px] text-gray-500">
                  {t('boards.inspector.bendHint', 'Drag the handle on canvas to fine-tune the route.')}
                </Text>
              </div>
            );
          })()
        ) : (
          <div className="space-y-1.5 text-xs">
            <Text className="font-mono text-gray-500">{sel.type}</Text>

            {isSpatialObject(sel) ? (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <CompactNumField layout="stacked" decimals={1} label="X" value={sel.x} onChange={(x) => onObjectPatch(sel.id, { x })} />
                  <CompactNumField layout="stacked" decimals={1} label="Y" value={sel.y} onChange={(y) => onObjectPatch(sel.id, { y })} />
                  <CompactNumField
                    layout="stacked"
                    decimals={0}
                    label={t('boards.inspector.width', 'W')}
                    value={sel.width}
                    onChange={(width) => onObjectPatch(sel.id, { width })}
                  />
                  <CompactNumField
                    layout="stacked"
                    decimals={0}
                    label={t('boards.inspector.height', 'H')}
                    value={sel.height}
                    onChange={(height) => onObjectPatch(sel.id, { height })}
                  />
                </div>
                <CompactNumField
                  label="Z"
                  decimals={0}
                  value={sel.z ?? 0}
                  onChange={(z) => onObjectPatch(sel.id, { z })}
                />
                <OpacityField
                  label={t('boards.inspector.opacity', 'Opacity')}
                  value={sel.opacity ?? boardDefaults.objectOpacity ?? 1}
                  onChange={(opacity) => onObjectPatch(sel.id, { opacity })}
                />
                <Switch
                  label={t('boards.inspector.locked', 'Locked')}
                  checked={Boolean(sel.locked)}
                  onChange={() => onObjectPatch(sel.id, { locked: !sel.locked })}
                />
                {sel.attachedNodeId ? (
                  <div className="rounded border border-muted p-2">
                    <Text className="text-[10px] text-gray-600">
                      {t('boards.inspector.magnetParent', 'Magnet parent')}:{' '}
                      <span className="font-mono">{sel.attachedNodeId.slice(0, 8)}…</span>
                    </Text>
                    <button
                      type="button"
                      className="mt-1 text-[10px] text-primary underline"
                      onClick={() => onObjectPatch(sel.id, magnetDetachPatch())}
                    >
                      {t('boards.inspector.detachMagnet', 'Detach from node')}
                    </button>
                  </div>
                ) : null}
                <Textarea
                  label={t('boards.inspector.note', 'Note')}
                  value={sel.note ?? ''}
                  onChange={(e) => onObjectPatch(sel.id, { note: e.target.value })}
                  rows={3}
                  className="text-xs"
                />
              </>
            ) : null}

            {sel.type === 'node' ? (
              <>
                <Input
                  size="sm"
                  label={t('boards.inspector.label', 'Label')}
                  value={sel.label}
                  ref={nodeLabelRef}
                  onFocus={() => onNodeLabelEditStart?.()}
                  onBlur={() => onNodeLabelEditEnd?.()}
                  onChange={(e) => onObjectPatch(sel.id, { label: e.target.value })}
                />
                <div>
                  <Text className="mb-1 text-xs text-gray-500">{t('boards.shape.title', 'Shape')}</Text>
                  <select
                    className="w-full rounded border border-muted px-2 py-1.5 text-xs"
                    value={sel.nodeShape ?? 'ellipse'}
                    onChange={(e) => {
                      const shape = e.target.value as BoardNodeShape;
                      onObjectPatch(sel.id, {
                        nodeShape: shape,
                        geometry: geometryFromPreset(shape),
                      });
                    }}
                  >
                    {NODE_SHAPE_OPTIONS.map(({ shape, labelKey }) => (
                      <option key={shape} value={shape}>
                        {t(labelKey, shape)}
                      </option>
                    ))}
                  </select>
                </div>
                {(sel.nodeShape === 'rectangle' || sel.nodeShape === 'rounded' || !sel.nodeShape) ? (
                  <CornerRadiusField
                    geometry={resolveGeometryFromNode(sel)}
                    width={sel.width}
                    height={sel.height}
                    onChange={(cornerRadii) => {
                      const g = resolveGeometryFromNode(sel);
                      onObjectPatch(sel.id, {
                        geometry: {
                          ...g,
                          kind: 'preset',
                          preset: sel.nodeShape === 'rectangle' ? 'rounded' : (g.preset ?? 'rounded'),
                          cornerRadii,
                        },
                      });
                    }}
                  />
                ) : null}
                <CompactNumField
                  label={t('boards.inspector.rotation', 'Rotation')}
                  suffix="°"
                  value={sel.rotation ?? 0}
                  step={1}
                  onChange={(rotation) => onObjectPatch(sel.id, { rotation })}
                />
                <BoardColorPicker
                  label={t('boards.inspector.color', 'Color')}
                  value={sel.color}
                  onChange={(color) => onObjectPatch(sel.id, { color })}
                />
                <Switch
                  label={t('boards.inspector.magnet', 'Magnet')}
                  checked={sel.magnetEnabled !== false}
                  onChange={() =>
                    onObjectPatch(sel.id, { magnetEnabled: sel.magnetEnabled === false ? true : false })
                  }
                />
                <Text className="text-[10px] text-gray-500">
                  {countMagnetAttachments(board.snapshot.objects, sel.id)}{' '}
                  {t('boards.inspector.magnetAttached', 'magnet-attached items')}
                </Text>
                {sel.objectGroupId ? (
                  <Text className="text-[10px] text-gray-500">
                    {t('boards.group.member', 'Group member')}
                  </Text>
                ) : null}
                <div className="rounded border border-muted p-2">
                  <InspectorAnchorLinksSection
                    objects={board.snapshot.objects}
                    nodeIds={[sel.id]}
                    readOnly={readOnly}
                    onAnchorLinkChange={onAnchorLinkChange}
                    onDetachMagnetChild={(childId) => onObjectPatch(childId, magnetDetachPatch())}
                    showMagnetChildren
                  />
                </div>
                {board.snapshot.objects
                  .filter((o) => o.type === 'node' && o.id !== sel.id)
                  .filter((o) => !getNodeAnchorPeers(board.snapshot.objects, sel.id).includes(o.id))
                  .slice(0, 4)
                  .map((other) => (
                    <button
                      key={other.id}
                      type="button"
                      className="text-[10px] text-primary underline"
                      onClick={() =>
                        onAnchorLinkChange
                          ? onAnchorLinkChange(sel.id, other.id, true)
                          : onObjectPatch(sel.id, {
                              linkedNodeIds: addNodeAnchorLink(sel, other.id),
                            })
                      }
                    >
                      {t('boards.inspector.anchorLinkTo', 'Link move with')}{' '}
                      {(other as BoardNodeObject).label}
                    </button>
                  ))}
              </>
            ) : null}

            {sel.type === 'vector' ? (
              <>
                <Input
                  size="sm"
                  label={t('boards.inspector.label', 'Label')}
                  value={(sel as BoardVectorObject).label ?? ''}
                  onChange={(e) => onObjectPatch(sel.id, { label: e.target.value })}
                />
                <BoardColorPicker
                  label={t('boards.inspector.fill', 'Fill')}
                  value={(sel as BoardVectorObject).fill}
                  onChange={(fill) => onObjectPatch(sel.id, { fill })}
                />
                <BoardColorPicker
                  label={t('boards.inspector.strokeColor', 'Stroke')}
                  value={(sel as BoardVectorObject).stroke ?? ''}
                  onChange={(stroke) => onObjectPatch(sel.id, { stroke })}
                />
                <CompactNumField
                  label={t('boards.inspector.strokeWidth', 'Stroke width')}
                  value={(sel as BoardVectorObject).strokeWidth ?? 1}
                  onChange={(v) => onObjectPatch(sel.id, { strokeWidth: v })}
                />
              </>
            ) : null}

            {sel.type === 'sticky' ? (
              <>
                <Input
                  size="sm"
                  label={t('boards.inspector.text', 'Text')}
                  value={sel.text}
                  onChange={(e) => onObjectPatch(sel.id, { text: e.target.value })}
                />
                <BoardColorPicker
                  label={t('boards.inspector.color', 'Color')}
                  value={sel.color}
                  onChange={(color) => onObjectPatch(sel.id, { color })}
                />
                {(sel as BoardStickyObject).inkStrokes?.length ? (
                  <div className="space-y-1">
                    <Text className="text-[10px] font-medium text-gray-600">
                      {t('boards.inspector.stickyInk', 'Handwriting & drawings')}
                    </Text>
                    <StickyInkPreview
                      strokes={(sel as BoardStickyObject).inkStrokes ?? []}
                      width={sel.width}
                      height={sel.height}
                      backgroundColor={sel.color}
                      inkRegion={(sel as BoardStickyObject).inkRegion}
                    />
                    <Text className="text-[10px] text-gray-500">
                      {(sel as BoardStickyObject).inkStrokes?.length}{' '}
                      {t('boards.inspector.inkStrokeCount', 'strokes')}
                    </Text>
                  </div>
                ) : (
                  <Text className="text-[10px] text-gray-500">
                    {t('boards.inspector.noStickyInk', 'No handwriting on this note')}
                  </Text>
                )}
              </>
            ) : null}

            {sel.type === 'media' ? (
              <>
                <Text>{sel.name}</Text>
                {sel.artifactId ? (
                  <Text className="break-all font-mono text-[10px]">{sel.artifactId}</Text>
                ) : null}
                {sel.attachmentRefId ? (
                  (() => {
                    const lib = attachments.find((a) => a.id === sel.attachmentRefId);
                    return lib ? (
                      <Text className="text-[10px] text-gray-500">
                        {t('boards.inspector.mediaLibraryLink', 'Library')}: {lib.name}
                      </Text>
                    ) : (
                      <Text className="text-[10px] text-amber-600">
                        {t('boards.inspector.mediaBrokenLink', 'Broken library link')}
                      </Text>
                    );
                  })()
                ) : (
                  <Text className="text-[10px] text-gray-500">
                    {t('boards.inspector.mediaDetached', 'Not linked to library')}
                  </Text>
                )}
                <Input
                  size="sm"
                  label={t('boards.inspector.caption', 'Caption')}
                  value={sel.caption ?? ''}
                  onChange={(e) => onObjectPatch(sel.id, { caption: e.target.value })}
                />
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sel.attachmentRefId && onJumpToAttachment ? (
                      <button
                        type="button"
                        className="text-[10px] text-primary underline"
                        onClick={() => onJumpToAttachment(sel.attachmentRefId!)}
                      >
                        {t('boards.inspector.jumpToLibrary', 'Jump to library')}
                      </button>
                    ) : null}
                    {sel.attachmentRefId && onDetachMediaFromLibrary ? (
                      <button
                        type="button"
                        className="text-[10px] text-gray-600 underline"
                        onClick={() => onDetachMediaFromLibrary(sel.id)}
                      >
                        {t('boards.inspector.detachFromLibrary', 'Detach from library')}
                      </button>
                    ) : null}
                    {onDeleteMedia ? (
                      <button
                        type="button"
                        className="text-[10px] text-red-600 underline"
                        onClick={onDeleteMedia}
                      >
                        {t('boards.inspector.deleteMedia', 'Delete from canvas')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {!readOnly && onReplaceMediaArtifact ? (
                  <MediaArtifactReplaceField
                    mediaId={sel.id}
                    currentArtifactId={sel.artifactId}
                    onReplace={onReplaceMediaArtifact}
                  />
                ) : null}
              </>
            ) : null}

            {sel.type === 'frame' ? (
              <>
                <Input
                  size="sm"
                  label={t('boards.frame.title', 'Frame title')}
                  value={(sel as BoardFrameObject).title}
                  onChange={(e) => onObjectPatch(sel.id, { title: e.target.value })}
                />
                <Input
                  size="sm"
                  label={t('boards.frame.background', 'Background')}
                  value={(sel as BoardFrameObject).background ?? ''}
                  placeholder="#f8fafc"
                  onChange={(e) => onObjectPatch(sel.id, { background: e.target.value || undefined })}
                />
                {onPresentFrame ? (
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => onPresentFrame(sel.id)}
                  >
                    {t('boards.frame.present', 'Present this frame')}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
      ) : null}

      {showBoard ? (
      <div>
        <Title as="h6" className="mb-1 text-sm">
          {t('boards.inspector.stats', 'Stats')}
        </Title>
        <Text className="text-xs text-gray-500">
          {board.snapshot.objects.length} {t('boards.inspector.objects', 'objects')}
        </Text>
        <Text className="text-xs text-gray-500">
          {(board.snapshot.inkStrokes ?? []).length} {t('boards.inspector.strokes', 'ink strokes')}
        </Text>
      </div>
      ) : null}
    </div>
  );
}
