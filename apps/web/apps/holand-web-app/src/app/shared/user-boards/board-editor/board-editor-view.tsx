'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Drawer } from 'rizzui';
import { routes } from '@/config/routes';
import { useFilePreview } from '@/hooks/use-file-preview';
import { storageService } from '@/services/storage.service';
import {
  extractDocument,
  fitViewBoxToBounds,
  getSnapshotBounds,
  nextZIndex,
  removeObjectFromSnapshot,
  updateObjectInSnapshot,
  withViewBox,
  type BoardDocumentState,
} from '../lib/board-snapshot';
import { readSnapPreference, writeSnapPreference } from '../lib/canvas/snap-preference';
import { readGridPreferences, writeGridPreferences } from '../lib/canvas/grid-preference';
import { BOARD_GRID_SIZE, snapCoord } from '../lib/canvas/snap';
import {
  DEFAULT_DRAW_SETTINGS,
  type BoardConnectorObject,
  type BoardDrawSettings,
  type BoardEditorTab,
  type BoardFrameObject,
  type BoardInkStroke,
  type BoardMediaObject,
  type BoardMode,
  type BoardNodeObject,
  type BoardNodeRole,
  type BoardNodeShape,
  type BoardObject,
  type BoardObjectBase,
  type BoardRecord,
  type BoardSnapshot,
  type BoardStickyObject,
  type BoardAttachmentRef,
  type BoardCommentPin,
  type BoardStyleDefaults,
  type BoardVectorObject,
  type CornerRadii,
} from '../lib/board-types';
import { getBoardStyleDefaults } from '../lib/board-style';
import { applyMagnetOnConnect, magnetSpawnBelowNode, resolveSingleSelectedNode, linkNodesBidirectional, unlinkNodesBidirectional, linkConnectedNodes, getAnchorLinksAmong, unlinkAllAmongNodes } from '../lib/canvas/node-magnet';
import { applyGraphLayoutToCanvas, prepareGraphForView } from '../lib/canvas/graph-sync';
import { groupSpatialObjects, ungroupSpatialObjects } from '../lib/canvas/object-groups';
import { useBoardPanels } from '../hooks/use-board-panels';
import { useCompactViewport } from '../hooks/use-compact-viewport';
import { BOARD_PANEL_REGISTRY } from '../lib/board-panel-registry';
import type { BoardPanelId } from '../lib/board-panel-prefs';
import { resolveCanvasContextHit, CanvasContextHit } from '../lib/canvas-hit-resolve';
import { exportBoardJson, exportBoardPng, exportBoardSvg } from '../lib/board-export';
import { parseBoardImportReplace } from '../lib/board-import';
import {
  copyBoardSelection,
  hasBoardClipboard,
  pasteBoardClipboard,
} from '../lib/board-clipboard';
import { BoardCheckpointsPanel } from './board-checkpoints-panel';
import { useBoardHistory } from '../hooks/use-board-history';
import { useBoardPersistence } from '../hooks/use-board-persistence';
import { useBoardShortcuts } from '../hooks/use-board-shortcuts';
import { BoardCanvas, type BoardCanvasHandle, type ObjectPositionUpdate, type ObjectResizeUpdate } from './board-canvas';
import { BoardToolbar, type BoardExportFormat } from './board-toolbar';
import { BoardInspector } from './board-inspector';
import { BoardEyedropperProvider } from '../components/board-eyedropper-provider';
import { BoardPanelShell } from './components/board-panel-shell';
import { alignSpatialObjects, BoardMultiSelectBar, countSelectedSpatial, type MultiSelectAlign } from './components/board-multi-select-bar';
import { BoardMiniMap } from './board-minimap';
import { BoardTypePalette } from './board-type-palette';
import { BoardNodeShapePicker } from './board-node-shape-picker';
import { resolveNodeColor, resolveNodeShape, ROLE_DEFAULT_SHAPES } from '../lib/node-role-colors';
import { normalizeNodeShape } from '../lib/canvas/node-shape';
import { reorderSpatialLayers, type LayerMove } from '../lib/canvas/layer-order';
import { combineShapes, type BooleanOp } from '../lib/canvas/boolean-combine';
import { aabbIntersects, objectToWorldAabb } from '../lib/canvas/shape-world-geometry';
import {
  resolveCanvasHiddenNodeRoles,
  resolveGraphViewFilter,
  resolveGraphViewSettings,
  settingsPanelTitleDefault,
  settingsPanelTitleKey,
} from '../lib/board-view-settings';
import { BoardSettingsSidebar } from './components/board-settings-sidebar';
import type { GraphFilter, GraphSettings } from '@/types/graph-explorer.types';
import { geometryFromPreset } from '../lib/canvas/shape-geometry';
import { isEpsFile, parseSvgShapeFile } from '../lib/shape-import/svg-shape-import';
import { BoardGraphExplorerView } from './board-graph-explorer-view';
import { BoardReportPanel } from './board-report-panel';
import { DrawToolOptions } from './draw-tool-options';
import { CanvasContextMenu, type CanvasContextAction } from './canvas-context-menu';
import { BoardCommentsPanel } from './board-comments-panel';
import { BoardAttachmentsPanel } from './board-attachments-panel';
import { BoardAttachmentsBar } from './board-attachments-bar';
import { useBoardAttachments, buildMediaFromAttachment } from '../hooks/use-board-attachments';
import { countAllPlacements } from '../lib/board-attachment-utils';
import {
  migrateBlobMediaToCloud,
  removeCanvasPlacementsForAttachments,
} from '../lib/board-attachment-lifecycle';
import { clearAttachQueue, readAttachQueue } from '../lib/board-attach-bridge';
import { boardService } from '../services/board.service';
import { ShareBoardDialog } from '../components/share-board-dialog';
import { BoardEditorProvider } from './board-editor-context';
import { useBoardCommentsSync } from '../hooks/use-board-comments-sync';
import { boardPerfMark } from '../lib/board-performance';
import { applyBlobMigrateRewires } from '../lib/board-attachment-lifecycle';
import { BoardApiFootprint } from '../components/board-api-footprint';
import { applyEvidenceWallTemplate } from '../templates/evidence-wall-template';

const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff'];
const GRID = BOARD_GRID_SIZE;

type SideDrawerKind = 'selection' | 'settings' | 'comments' | 'attachments';

const SIDE_DRAWER_KINDS: SideDrawerKind[] = ['selection', 'settings', 'comments', 'attachments'];

export interface BoardEditorViewProps {
  initialBoard: BoardRecord;
}

export function BoardEditorView({ initialBoard }: BoardEditorViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openFilePreview } = useFilePreview();
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const shapeImportRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<BoardCanvasHandle>(null);
  const [pendingCommentPin, setPendingCommentPin] = useState<{ x: number; y: number } | null>(null);

  const [board, setBoard] = useState<BoardRecord>(initialBoard);
  const {
    snapshot,
    commitDocument,
    replaceDocument,
    replaceDuringGesture,
    setSnapshot,
    setViewBox,
    beginGesture,
    endGesture,
    beginDrag,
    endDrag,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBoardHistory(initialBoard.snapshot);
  const { schedulePersist } = useBoardPersistence(board);

  const [mode, setMode] = useState<BoardMode>('select');
  const [activeTab, setActiveTab] = useState<BoardEditorTab>('canvas');
  const [graphAutoLayoutToken, setGraphAutoLayoutToken] = useState(0);
  const prevTabRef = useRef<BoardEditorTab>('canvas');
  const nudgeGestureActiveRef = useRef(false);
  const nudgeEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyEditActiveRef = useRef<string | null>(null);
  const nodeLabelEditActiveRef = useRef(false);
  const reportEditActiveRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedInkIds, setSelectedInkIds] = useState<string[]>([]);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [nodeRole, setNodeRole] = useState<BoardNodeRole>('topic');
  const [nodeShape, setNodeShape] = useState<BoardNodeShape>(ROLE_DEFAULT_SHAPES.topic);
  const [shareOpen, setShareOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; hit: CanvasContextHit } | null>(null);
  const [showFootprint, setShowFootprint] = useState(false);
  const [drawSettings, setDrawSettings] = useState<BoardDrawSettings>(DEFAULT_DRAW_SETTINGS);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridPreferences, setGridPreferences] = useState(readGridPreferences);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const viewBoxPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestViewBoxRef = useRef(initialBoard.snapshot.viewBox);
  const [attachmentsBarVisible, setAttachmentsBarVisible] = useState(true);
  const [graphSidePanel, setGraphSidePanel] = useState(false);
  const [reportSidePanel, setReportSidePanel] = useState(false);
  const [labelFocusId, setLabelFocusId] = useState<string | null>(null);
  const [panHoldActive, setPanHoldActive] = useState(false);
  const [ctxPasteAvailable, setCtxPasteAvailable] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentFrameIndex, setPresentFrameIndex] = useState(0);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorDrawerVariant, setInspectorDrawerVariant] = useState<SideDrawerKind>('selection');
  const { prefs: panelPrefs, showPanel, hidePanel, togglePanel, setPanelMode } = useBoardPanels(board.id);
  const isCompactLg = useCompactViewport('lg');
  const isCompactMd = useCompactViewport('md');

  const openSideDrawer = useCallback(
    (kind: SideDrawerKind) => {
      if (isCompactLg) {
        setInspectorDrawerVariant(kind);
        setInspectorOpen(true);
      }
      showPanel(kind);
    },
    [isCompactLg, showPanel]
  );

  const toggleSideDrawer = useCallback(
    (kind: SideDrawerKind) => {
      const willShow = !panelPrefs[kind].visible;

      if (isCompactLg) {
        setInspectorDrawerVariant(kind);
        setInspectorOpen(willShow);
        if (willShow) showPanel(kind);
        else hidePanel(kind);
        return;
      }

      togglePanel(kind);
    },
    [isCompactLg, panelPrefs, showPanel, hidePanel, togglePanel]
  );

  const toggleInspectorSidePanel = useCallback(
    (key: 'selection' | 'settings') => toggleSideDrawer(key),
    [toggleSideDrawer]
  );

  const openInspectorPanel = useCallback(
    (key: 'selection' | 'settings') => openSideDrawer(key),
    [openSideDrawer]
  );

  const openCommentsPanel = useCallback(() => {
    openSideDrawer('comments');
  }, [openSideDrawer]);

  const openAttachmentsPanel = useCallback(() => {
    openSideDrawer('attachments');
  }, [openSideDrawer]);

  const closeSideDrawer = useCallback(
    (kind: SideDrawerKind) => {
      setInspectorOpen(false);
      hidePanel(kind);
      if (kind === 'comments') {
        setPendingCommentPin(null);
        setMode('select');
      }
    },
    [hidePanel]
  );

  const toggleToolsSidePanel = useCallback(() => {
    if (panelPrefs.tools.visible) hidePanel('tools');
    else if (isCompactMd) showPanel('tools', 'floating');
    else showPanel('tools');
  }, [panelPrefs.tools.visible, isCompactMd, showPanel, hidePanel]);

  useEffect(() => {
    if (!isCompactLg) {
      setInspectorOpen(false);
      return;
    }
    const visibleKind = SIDE_DRAWER_KINDS.find((k) => panelPrefs[k].visible);
    if (visibleKind) {
      setInspectorDrawerVariant(visibleKind);
      setInspectorOpen(true);
    } else {
      setInspectorOpen(false);
    }
  }, [
    isCompactLg,
    panelPrefs.selection.visible,
    panelPrefs.settings.visible,
    panelPrefs.comments.visible,
    panelPrefs.attachments.visible,
  ]);

  useEffect(() => {
    if (isCompactMd && panelPrefs.tools.visible && panelPrefs.tools.mode === 'docked') {
      setPanelMode('tools', 'floating');
    }
  }, [isCompactMd, panelPrefs.tools.visible, panelPrefs.tools.mode, setPanelMode]);

  const readOnly = Boolean(snapshot.legalHold);

  const syncBoard = useCallback(
    (doc: BoardDocumentState) => {
      setBoard((b) => ({
        ...b,
        snapshot: withViewBox(doc, snapshot.viewBox),
        updatedAt: new Date().toISOString(),
      }));
    },
    [snapshot.viewBox]
  );

  const guardMutation = useCallback(() => {
    if (readOnly) {
      toast.error(t('boards.legalHoldBlock', 'Board is on legal hold — editing disabled'));
      return false;
    }
    return true;
  }, [readOnly, t]);

  const commitBoard = useCallback(
    (doc: BoardDocumentState) => {
      if (!guardMutation()) return;
      commitDocument(doc);
      syncBoard(doc);
    },
    [commitDocument, syncBoard, guardMutation]
  );

  const replaceBoard = useCallback(
    (doc: BoardDocumentState) => {
      if (readOnly) return;
      replaceDocument(doc);
      syncBoard(doc);
    },
    [replaceDocument, syncBoard, readOnly]
  );

  const patchDocument = useCallback(
    (patch: Partial<BoardDocumentState>) => {
      const doc = { ...extractDocument(snapshot), ...patch };
      commitBoard(doc);
    },
    [snapshot, commitBoard]
  );

  /** Legal hold toggle must bypass read-only guard so a held board can be released. */
  const handleToggleLegalHold = useCallback(() => {
    const doc = { ...extractDocument(snapshot), legalHold: !snapshot.legalHold };
    commitDocument(doc);
    syncBoard(doc);
  }, [snapshot, commitDocument, syncBoard]);

  const handleStyleDefaultsChange = useCallback(
    (patch: Partial<BoardStyleDefaults>) => {
      if (!guardMutation()) return;
      const doc = extractDocument(snapshot);
      commitBoard({
        ...doc,
        styleDefaults: { ...(doc.styleDefaults ?? {}), ...patch },
      });
    },
    [snapshot, commitBoard, guardMutation]
  );

  const newConnector = useCallback(
    (sourceId: string, targetId: string): BoardConnectorObject => {
      const d = getBoardStyleDefaults(snapshot);
      return {
        type: 'connector',
        id: createId(),
        sourceId,
        targetId,
        label: '',
        routeStyle: d.connectorRouteStyle,
        color: d.connectorColor,
        strokeWidth: d.connectorStrokeWidth,
        strokeStyle: d.connectorStrokeStyle,
        opacity: d.connectorOpacity,
        arrowDirection: d.connectorArrowDirection,
        kind: 'flow',
      };
    },
    [snapshot]
  );

  const exitPresentMode = useCallback(() => {
    setIsPresenting(false);
    setActiveTab('canvas');
    if (document.fullscreenElement) void document.exitFullscreen();
  }, []);

  useEffect(() => {
    setSnapToGrid(readSnapPreference());
    setGridPreferences(readGridPreferences());
  }, []);

  const toggleSnap = useCallback(() => {
    setSnapToGrid((prev) => {
      const next = !prev;
      writeSnapPreference(next);
      return next;
    });
  }, []);

  const patchGridPreferences = useCallback((patch: Parameters<typeof writeGridPreferences>[0]) => {
    const next = writeGridPreferences(patch);
    setGridPreferences(next);
  }, []);

  useEffect(() => {
    schedulePersist();
  }, [board, schedulePersist]);

  const canvasHiddenNodeRoles = useMemo(
    () => resolveCanvasHiddenNodeRoles(snapshot),
    [snapshot]
  );
  const graphSettings = useMemo(() => resolveGraphViewSettings(snapshot), [snapshot]);
  const graphFilter = useMemo(() => resolveGraphViewFilter(snapshot), [snapshot]);

  const frames = useMemo(
    () => snapshot.objects.filter((o): o is BoardFrameObject => o.type === 'frame'),
    [snapshot.objects]
  );

  const handleHiddenRolesChange = useCallback(
    (roles: BoardNodeRole[]) => {
      patchDocument({ canvasHiddenNodeRoles: roles, hiddenNodeRoles: roles });
    },
    [patchDocument]
  );

  const handleGraphViewSettingsChange = useCallback(
    (settings: GraphSettings) => {
      if (!guardMutation()) return;
      patchDocument({ graphViewSettings: settings });
    },
    [patchDocument, guardMutation]
  );

  const handleGraphViewFilterChange = useCallback(
    (filter: GraphFilter) => {
      if (!guardMutation()) return;
      patchDocument({ graphViewFilter: filter });
    },
    [patchDocument, guardMutation]
  );

  const handleReportSettingsChange = useCallback(
    (patch: Partial<Pick<BoardSnapshot, 'reportTitle' | 'reportContent'>>) => {
      if (!guardMutation()) return;
      patchDocument(patch);
    },
    [patchDocument, guardMutation]
  );

  const handleCheckpointRestore = useCallback(
    (snap: BoardSnapshot) => {
      if (!guardMutation()) return;
      commitDocument(snap);
      setViewBox(snap.viewBox);
    },
    [commitDocument, guardMutation, setViewBox]
  );

  const jumpToFrame = useCallback(
    (frameId: string) => {
      const idx = frames.findIndex((f) => f.id === frameId);
      if (idx < 0) return;
      setPresentFrameIndex(idx);
      const f = frames[idx];
      setViewBox({ x: f.x, y: f.y, width: f.width, height: f.height });
      if (!isPresenting) {
        setActiveTab('present');
        setIsPresenting(true);
        void canvasContainerRef.current?.requestFullscreen?.();
      }
    },
    [frames, isPresenting, setViewBox]
  );

  const handleFrameCreate = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (!guardMutation()) return;
      const frame: BoardFrameObject = {
        id: createId(),
        type: 'frame',
        x: snapCoord(rect.x, snapToGrid, GRID),
        y: snapCoord(rect.y, snapToGrid, GRID),
        width: Math.max(120, snapCoord(rect.width, snapToGrid, GRID)),
        height: Math.max(80, snapCoord(rect.height, snapToGrid, GRID)),
        title: t('boards.frame.untitled', `Slide ${frames.length + 1}`),
        background: 'rgba(148,163,184,0.12)',
        z: nextZIndex(snapshot),
      };
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, frame] });
      setSelectedIds([frame.id]);
      setMode('select');
    },
    [snapshot, commitBoard, guardMutation, snapToGrid, frames.length, t]
  );

  const handleObjectRotationEnd = useCallback(
    (id: string, rotation: number) => {
      if (!guardMutation()) return;
      replaceBoard(extractDocument(updateObjectInSnapshot(snapshot, id, { rotation })));
    },
    [snapshot, replaceBoard, guardMutation]
  );

  const handleCopy = useCallback(() => {
    if (!selectedIds.length) return;
    copyBoardSelection(snapshot.objects, selectedIds);
    toast.success(t('boards.clipboard.copied', 'Copied'));
  }, [selectedIds, snapshot.objects, t]);

  const handlePaste = useCallback(
    (at?: { x: number; y: number }) => {
      if (!guardMutation()) return;
      const pasted = pasteBoardClipboard(snapshot, at);
      if (!pasted.length) return;
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, ...pasted] });
      setSelectedIds(pasted.filter((o) => o.type !== 'connector').map((o) => o.id));
      toast.success(t('boards.clipboard.pasted', 'Pasted'));
    },
    [snapshot, commitBoard, guardMutation, t]
  );

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !guardMutation()) return;
    const text = await file.text();
    const imported = parseBoardImportReplace(text);
    if (!imported) {
      toast.error(t('boards.import.failed', 'Invalid board file'));
      return;
    }
    setSnapshot(imported);
    setViewBox(imported.viewBox);
    toast.success(t('boards.import.success', 'Board imported'));
  };

  const placeImportedShape = useCallback(
    (imported: NonNullable<ReturnType<typeof parseSvgShapeFile>>, at?: { x: number; y: number }) => {
      const cx = at?.x ?? snapshot.viewBox.x + snapshot.viewBox.width / 2;
      const cy = at?.y ?? snapshot.viewBox.y + snapshot.viewBox.height / 2;
      const vector: BoardVectorObject = {
        type: 'vector',
        id: createId(),
        x: cx - imported.width / 2,
        y: cy - imported.height / 2,
        width: imported.width,
        height: imported.height,
        geometry: imported.geometry,
        fill: imported.fill,
        stroke: imported.stroke,
        strokeWidth: imported.strokeWidth,
        z: nextZIndex(snapshot),
      };
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, vector] });
      setSelectedIds([vector.id]);
      setMode('select');
      toast.success(t('boards.vector.imported', 'Shape imported'));
    },
    [snapshot, commitBoard, setMode, t]
  );

  const handleShapeImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !guardMutation()) return;
    if (isEpsFile(file)) {
      toast.error(t('boards.vector.epsHint', 'Export EPS to SVG from Illustrator or XD, then import the SVG file.'));
      return;
    }
    const text = await file.text();
    const imported = parseSvgShapeFile(text);
    if (!imported) {
      toast.error(t('boards.vector.importFailed', 'Could not read shape from SVG'));
      return;
    }
    const place = (fileRef.current as HTMLInputElement & { _place?: { x: number; y: number } })._place;
    placeImportedShape(imported, place);
  };

  const handleVectorDrawComplete = useCallback(
    (result: { pathD: string; bbox: { x: number; y: number; width: number; height: number }; fill: string }) => {
      if (!guardMutation()) return;
      const vector: BoardVectorObject = {
        type: 'vector',
        id: createId(),
        x: result.bbox.x,
        y: result.bbox.y,
        width: Math.max(8, result.bbox.width),
        height: Math.max(8, result.bbox.height),
        geometry: { kind: 'path', pathD: result.pathD },
        fill: result.fill,
        z: nextZIndex(snapshot),
      };
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, vector] });
      setSelectedIds([vector.id]);
      setMode('select');
    },
    [snapshot, commitBoard, guardMutation, setMode]
  );

  const handleCornerRadiiChange = useCallback(
    (id: string, cornerRadii: CornerRadii) => {
      if (!guardMutation()) return;
      const obj = snapshot.objects.find((o) => 'id' in o && o.id === id);
      if (!obj || obj.type !== 'node') return;
      const node = obj as BoardNodeObject;
      const preset = normalizeNodeShape(node.nodeShape);
      const geometry = node.geometry ?? geometryFromPreset(preset);
      commitBoard(
        extractDocument(
          updateObjectInSnapshot(snapshot, id, {
            geometry: { ...geometry, kind: 'preset', preset: preset === 'ellipse' || preset === 'diamond' ? preset : 'rounded', cornerRadii },
          })
        )
      );
    },
    [snapshot, commitBoard, guardMutation]
  );

  const handlePathGeometryChange = useCallback(
    (id: string, patch: { pathD: string; x?: number; y?: number; width?: number; height?: number }) => {
      if (!guardMutation()) return;
      const obj = snapshot.objects.find((o) => 'id' in o && o.id === id);
      if (!obj || obj.type !== 'vector') return;
      const v = obj as BoardVectorObject;
      commitBoard(
        extractDocument(
          updateObjectInSnapshot(snapshot, id, {
            x: patch.x ?? v.x,
            y: patch.y ?? v.y,
            width: patch.width ?? v.width,
            height: patch.height ?? v.height,
            geometry: { kind: 'path', pathD: patch.pathD },
          })
        )
      );
    },
    [snapshot, commitBoard, guardMutation]
  );

  const handleBooleanCombine = useCallback(
    (op: BooleanOp) => {
      if (!guardMutation() || selectedIds.length < 2) return;
      const effectiveSnapshot = canvasRef.current?.getEffectiveSnapshot() ?? snapshot;
      const result = combineShapes(effectiveSnapshot, selectedIds, op);
      if (!result) {
        toast.error(t('boards.boolean.failed', 'Could not combine shapes'));
        return;
      }
      commitBoard(extractDocument(result.snapshot));
      setSelectedIds([result.newId]);
      toast.success(t('boards.boolean.done', 'Shapes combined'));
    },
    [snapshot, selectedIds, commitBoard, guardMutation, t]
  );

  const handleConvertVectorToNode = useCallback(
    (vectorId: string) => {
      if (!guardMutation()) return;
      const obj = snapshot.objects.find((o) => 'id' in o && o.id === vectorId);
      if (!obj || obj.type !== 'vector') return;
      const v = obj as BoardVectorObject;
      const node: BoardNodeObject = {
        type: 'node',
        id: createId(),
        x: v.x,
        y: v.y,
        width: v.width,
        height: v.height,
        z: v.z ?? nextZIndex(snapshot),
        rotation: v.rotation,
        label: v.label ?? t('boards.newNode', 'New'),
        nodeRole: 'custom',
        geometry: v.geometry,
        color: v.fill,
        nodeShape: v.geometry.kind === 'preset' ? v.geometry.preset : undefined,
      };
      const doc = extractDocument(snapshot);
      commitBoard({
        ...doc,
        objects: [...doc.objects.filter((o) => !('id' in o) || o.id !== vectorId), node],
      });
      setSelectedIds([node.id]);
      toast.success(t('boards.vector.converted', 'Converted to node'));
    },
    [snapshot, commitBoard, guardMutation, t]
  );

  const selectedObjects = useMemo(
    () => snapshot.objects.filter((o) => 'id' in o && selectedIds.includes(o.id)),
    [snapshot.objects, selectedIds]
  );

  const selectedInk = useMemo(() => {
    const id = selectedInkIds[0];
    if (!id) return null;
    return (snapshot.inkStrokes ?? []).find((s) => s.id === id) ?? null;
  }, [selectedInkIds, snapshot.inkStrokes]);

  const placeAt = useCallback(
    (x: number, y: number) => ({
      x: snapCoord(x, snapToGrid, GRID),
      y: snapCoord(y, snapToGrid, GRID),
    }),
    [snapToGrid]
  );

  const addStickyAt = useCallback(
    (x: number, y: number) => {
      const p = placeAt(x, y);
      const d = getBoardStyleDefaults(snapshot);
      const w = 200;
      const h = 120;
      const anchorNode = resolveSingleSelectedNode(snapshot.objects, selectedIds);
      let stickyX = p.x - w / 2;
      let stickyY = p.y - h / 2;
      let magnetPatch: Partial<BoardStickyObject> = {};
      if (anchorNode && anchorNode.magnetEnabled !== false) {
        const spawn = magnetSpawnBelowNode(anchorNode, w, h);
        stickyX = spawn.x;
        stickyY = spawn.y;
        magnetPatch = spawn.patch as Partial<BoardStickyObject>;
      }
      const sticky: BoardStickyObject = {
        id: createId(),
        type: 'sticky',
        x: stickyX,
        y: stickyY,
        width: w,
        height: h,
        text: '',
        color: d.stickyColor ?? STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
        opacity: d.objectOpacity,
        z: nextZIndex(snapshot),
        ...magnetPatch,
      };
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, sticky] });
      setSelectedIds([sticky.id]);
      setMode('select');
    },
    [snapshot, commitBoard, placeAt, selectedIds]
  );

  const addNodeAt = useCallback(
    (x: number, y: number) => {
      const p = placeAt(x, y);
      const d = getBoardStyleDefaults(snapshot);
      const shape = resolveNodeShape(nodeRole, nodeShape);
      const node: BoardNodeObject = {
        id: createId(),
        type: 'node',
        x: p.x - 50,
        y: p.y - 28,
        width: 100,
        height: 56,
        label: t('boards.newNode', 'New'),
        nodeRole,
        nodeShape: shape,
        color: resolveNodeColor(nodeRole, d.nodeColor),
        opacity: d.objectOpacity,
        z: nextZIndex(snapshot),
      };
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, node], graphTopologyFingerprint: undefined });
      setSelectedIds([node.id]);
      setMode('select');
    },
    [snapshot, commitBoard, nodeRole, nodeShape, placeAt, t]
  );

  const handleNodeRoleChange = useCallback((role: BoardNodeRole) => {
    setNodeRole(role);
    setNodeShape(ROLE_DEFAULT_SHAPES[role]);
  }, []);

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      if (readOnly) return;
      if (mode === 'addSticky') addStickyAt(x, y);
      else if (mode === 'addImage') {
        fileRef.current?.click();
        (fileRef.current as HTMLInputElement & { _place?: { x: number; y: number } })._place = placeAt(x, y);
      } else if (mode === 'addNode') addNodeAt(x, y);
      else if (mode === 'addComment') {
        if (selectedIds.length === 1) {
          const obj = snapshot.objects.find((o) => o.id === selectedIds[0]);
          if (obj && 'x' in obj) {
            const spatial = obj as BoardObjectBase;
            setPendingCommentPin({ x: spatial.x + spatial.width - 8, y: spatial.y - 8 });
            openCommentsPanel();
            return;
          }
        }
        const pin = placeAt(x, y);
        setPendingCommentPin(pin);
        openCommentsPanel();
      }
    },
    [mode, readOnly, addStickyAt, addNodeAt, placeAt, selectedIds, snapshot.objects, openCommentsPanel]
  );

  const handleSelect = useCallback(
    (ids: string[], append?: boolean) => {
      if (mode === 'addEdge' && ids.length === 1) {
        if (!edgeSourceId) {
          setEdgeSourceId(ids[0]);
          return;
        }
        if (edgeSourceId !== ids[0]) {
          const edge = newConnector(edgeSourceId, ids[0]);
          const doc = extractDocument(snapshot);
          let objects = applyMagnetOnConnect([...doc.objects, edge], edgeSourceId, ids[0]);
          commitBoard({ ...doc, objects });
          setEdgeSourceId(null);
          setMode('select');
          return;
        }
      }
      setSelectedIds(append ? [...new Set([...selectedIds, ...ids])] : ids);
    },
    [mode, edgeSourceId, snapshot, commitBoard, selectedIds, newConnector]
  );

  const handleObjectsDragEnd = useCallback(
    (updates: ObjectPositionUpdate[]) => {
      if (!updates.length || !guardMutation()) return;
      const movedIds = new Set(updates.map((u) => u.id));
      let snapDoc = withViewBox(extractDocument(snapshot), snapshot.viewBox);
      for (const u of updates) {
        snapDoc = updateObjectInSnapshot(snapDoc, u.id, { x: u.x, y: u.y });
      }
      snapDoc = {
        ...snapDoc,
        objects: snapDoc.objects.map((o) => {
          if (o.type !== 'connector') return o;
          if (!movedIds.has(o.sourceId) && !movedIds.has(o.targetId)) return o;
          return { ...o, bendPoints: undefined, bendOffset: undefined };
        }),
        comments: (snapDoc.comments ?? []).map((c) => {
          if (!c.objectId || !movedIds.has(c.objectId)) return c;
          const obj = snapDoc.objects.find((o) => o.id === c.objectId);
          if (!obj || !('x' in obj)) return c;
          const spatial = obj as BoardObjectBase;
          return { ...c, x: spatial.x + spatial.width - 8, y: spatial.y - 8 };
        }),
      };
      replaceBoard(extractDocument(snapDoc));
    },
    [snapshot, replaceBoard, guardMutation]
  );

  const syncDocWithGraphLinks = useCallback(
    (doc: BoardDocumentState): BoardDocumentState =>
      prepareGraphForView(doc, (sourceId, targetId) => ({
        ...newConnector(sourceId, targetId),
        kind: 'link',
      })).doc,
    [newConnector]
  );

  useEffect(() => {
    if (activeTab !== 'graph') {
      prevTabRef.current = activeTab;
      return;
    }
    const enteredGraph = prevTabRef.current !== 'graph';
    prevTabRef.current = activeTab;
    if (!enteredGraph) return;

    const result = prepareGraphForView(extractDocument(snapshot), (sourceId, targetId) => ({
      ...newConnector(sourceId, targetId),
      kind: 'link',
    }));

    if (result.dataChanged && !readOnly) {
      replaceBoard(result.doc);
    }

    if (result.topologyChanged || result.missingLayoutNodeIds.length > 0) {
      setGraphAutoLayoutToken((n) => n + 1);
    }
  }, [activeTab, snapshot, newConnector, replaceBoard, readOnly]);

  const handleGraphNodeMove = useCallback(
    (id: string, x: number, y: number) => {
      if (!guardMutation()) return;
      const doc = extractDocument(snapshot);
      const graphLayout = { ...(doc.graphLayout ?? {}), [id]: { x, y } };
      replaceDuringGesture({ ...doc, graphLayout });
      setBoard((b) => ({
        ...b,
        snapshot: withViewBox({ ...doc, graphLayout }, snapshot.viewBox),
        updatedAt: new Date().toISOString(),
      }));
    },
    [snapshot, replaceDuringGesture, guardMutation]
  );

  const handleGraphLayoutChange = useCallback(
    (layout: Record<string, { x: number; y: number }>) => {
      if (!guardMutation()) return;
      const doc = extractDocument(snapshot);
      replaceBoard({ ...doc, graphLayout: layout });
    },
    [snapshot, replaceBoard, guardMutation]
  );

  const handleApplyGraphLayoutToCanvas = useCallback(() => {
    if (!guardMutation()) return;
    const doc = extractDocument(snapshot);
    commitBoard(applyGraphLayoutToCanvas(doc));
  }, [snapshot, commitBoard, guardMutation]);

  const handleObjectResizeEnd = useCallback(
    (update: ObjectResizeUpdate) => {
      if (!guardMutation()) return;
      const snapDoc = updateObjectInSnapshot(withViewBox(extractDocument(snapshot), snapshot.viewBox), update.id, {
        x: update.x,
        y: update.y,
        width: update.width,
        height: update.height,
      });
      replaceBoard(extractDocument(snapDoc));
    },
    [snapshot, replaceBoard, guardMutation]
  );

  const handleBulkTransformEnd = useCallback(
    (patches: import('./board-canvas').ObjectTransformPatch[]) => {
      if (!guardMutation()) return;
      let snapDoc = withViewBox(extractDocument(snapshot), snapshot.viewBox);
      for (const patch of patches) {
        const { id, ...rest } = patch;
        snapDoc = updateObjectInSnapshot(snapDoc, id, rest);
      }
      replaceBoard(extractDocument(snapDoc));
    },
    [snapshot, replaceBoard, guardMutation]
  );

  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      if (!selectedIds.length || !guardMutation()) return;
      if (!nudgeGestureActiveRef.current) {
        beginGesture();
        nudgeGestureActiveRef.current = true;
      }
      let snapDoc = withViewBox(extractDocument(snapshot), snapshot.viewBox);
      for (const id of selectedIds) {
        const obj = snapDoc.objects.find((o) => 'id' in o && o.id === id);
        if (!obj || obj.type === 'connector' || !('x' in obj)) continue;
        snapDoc = updateObjectInSnapshot(snapDoc, id, {
          x: snapCoord(obj.x + dx, snapToGrid, GRID),
          y: snapCoord(obj.y + dy, snapToGrid, GRID),
        });
      }
      replaceDuringGesture(extractDocument(snapDoc));
      setBoard((b) => ({
        ...b,
        snapshot: snapDoc,
        updatedAt: new Date().toISOString(),
      }));
      if (nudgeEndTimerRef.current) clearTimeout(nudgeEndTimerRef.current);
      nudgeEndTimerRef.current = setTimeout(() => {
        nudgeGestureActiveRef.current = false;
        endGesture();
        nudgeEndTimerRef.current = null;
      }, 300);
    },
    [selectedIds, snapshot, beginGesture, endGesture, replaceDuringGesture, guardMutation, snapToGrid]
  );

  const handleMultiSelectAlign = useCallback(
    (action: MultiSelectAlign) => {
      if (!guardMutation() || selectedIds.length < 2) return;
      const patches = alignSpatialObjects(snapshot.objects, selectedIds, action);
      if (!patches.size) return;
      let snapDoc = withViewBox(extractDocument(snapshot), snapshot.viewBox);
      for (const [id, patch] of patches) {
        snapDoc = updateObjectInSnapshot(snapDoc, id, patch);
      }
      commitBoard(extractDocument(snapDoc));
    },
    [selectedIds, snapshot, commitBoard, guardMutation]
  );

  const inspectorObjectPatch = useCallback(
    (id: string, patch: Partial<BoardObject>) => {
      if (!guardMutation()) return;
      const next = extractDocument(updateObjectInSnapshot(snapshot, id, patch));
      if (nodeLabelEditActiveRef.current) {
        replaceDuringGesture(next);
      } else {
        commitBoard(next);
      }
    },
    [snapshot, commitBoard, replaceDuringGesture, guardMutation]
  );

  const inspectorBulkObjectPatch = useCallback(
    (ids: string[], patch: Partial<BoardObject>) => {
      if (!guardMutation()) return;
      let doc = withViewBox(extractDocument(snapshot), snapshot.viewBox);
      for (const id of ids) {
        doc = updateObjectInSnapshot(doc, id, patch);
      }
      commitBoard(extractDocument(doc));
    },
    [snapshot, commitBoard, guardMutation]
  );

  const inspectorInkPatch = useCallback(
    (id: string, patch: Partial<BoardInkStroke>) => {
      if (!guardMutation()) return;
      const doc = extractDocument(snapshot);
      commitBoard({
        ...doc,
        inkStrokes: (doc.inkStrokes ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      });
    },
    [snapshot, commitBoard, guardMutation]
  );

  const handleCommentsChange = useCallback(
    (comments: BoardCommentPin[]) => {
      patchDocument({ comments });
      const last = comments[comments.length - 1];
      if (last?.id) {
        void boardService.postComment(board.id, {
          x: last.x,
          y: last.y,
          text: last.text,
          objectId: last.objectId,
        });
      }
    },
    [patchDocument, board.id]
  );

  const handleRemoteComments = useCallback(
    (remote: BoardCommentPin[]) => {
      const doc = extractDocument(snapshot);
      if ((doc.comments ?? []).length >= remote.length) return;
      patchDocument({ comments: remote });
    },
    [snapshot, patchDocument]
  );

  useBoardCommentsSync(board.id, snapshot.comments ?? [], handleRemoteComments);

  const persistViewBox = useCallback((vb: typeof snapshot.viewBox) => {
    latestViewBoxRef.current = vb;
    if (viewBoxPersistTimerRef.current) clearTimeout(viewBoxPersistTimerRef.current);
    viewBoxPersistTimerRef.current = setTimeout(() => {
      viewBoxPersistTimerRef.current = null;
      const next = latestViewBoxRef.current;
      setBoard((b) => ({ ...b, snapshot: { ...b.snapshot, viewBox: next } }));
    }, 400);
  }, []);

  const handleCanvasViewBoxChange = useCallback(
    (vb: typeof snapshot.viewBox) => {
      setViewBox(vb);
      persistViewBox(vb);
    },
    [setViewBox, persistViewBox]
  );

  useEffect(() => {
    boardPerfMark('board-canvas-mount');
    return () => {
      if (viewBoxPersistTimerRef.current) clearTimeout(viewBoxPersistTimerRef.current);
    };
  }, []);

  const handleAttachmentsChange = useCallback(
    (attachments: BoardAttachmentRef[]) => {
      patchDocument({ attachments });
    },
    [patchDocument]
  );

  const handleRemoveCanvasPlacements = useCallback(
    (attachmentRefIds: string[]) => {
      const doc = extractDocument(snapshot);
      const objects = removeCanvasPlacementsForAttachments(doc.objects, attachmentRefIds);
      commitBoard({ ...doc, objects });
      setSelectedIds((ids) =>
        ids.filter((id) => {
          const o = objects.find((obj) => obj.id === id);
          return o != null;
        })
      );
    },
    [snapshot, commitBoard]
  );

  const boardAttachments = useBoardAttachments({
    snapshot,
    onAttachmentsChange: handleAttachmentsChange,
    onRemoveCanvasPlacements: handleRemoveCanvasPlacements,
    guardMutation,
    t,
  });

  const attachmentPlacementCounts = useMemo(
    () => countAllPlacements(snapshot),
    [snapshot]
  );

  const handlePasteFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      const ok = await boardAttachments.addFromPaste(file);
      if (ok) {
        openAttachmentsPanel();
        setAttachmentsBarVisible(true);
      }
    },
    [boardAttachments, openAttachmentsPanel]
  );

  useEffect(() => {
    const queued = readAttachQueue(board.id);
    if (!queued.length) return;
    clearAttachQueue(board.id);
    for (const item of queued) {
      boardAttachments.addFromArtifact(item, 'system');
    }
    openAttachmentsPanel();
    setAttachmentsBarVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);

  const handleMigrateBlobs = useCallback(async () => {
    if (!guardMutation()) return;
    const doc = extractDocument(snapshot);
    const result = await migrateBlobMediaToCloud(doc.objects, doc.attachments ?? []);
    if (!result.attachments.length && !result.objectRewires.length) {
      toast(t('boards.attachments.migrateNone', 'No local media to migrate'));
      return;
    }
    const objects = applyBlobMigrateRewires(doc.objects, result.objectRewires);
    patchDocument({
      attachments: [...(doc.attachments ?? []), ...result.attachments],
      objects,
    });
    toast.success(
      t('boards.attachments.migrateDone', 'Migrated {{n}} file(s) to cloud', { n: result.migrated })
    );
  }, [snapshot, guardMutation, patchDocument, t]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files?.length || readOnly) return;
      e.preventDefault();
      void handlePasteFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handlePasteFiles, readOnly]);

  const handlePlaceAttachment = useCallback(
    (att: BoardAttachmentRef, world?: { x: number; y: number }) => {
      if (!guardMutation()) return;
      const w = 160;
      const h = 120;
      const anchorNode = resolveSingleSelectedNode(snapshot.objects, selectedIds);
      let x: number;
      let y: number;
      let magnetPatch: Partial<BoardMediaObject> = {};
      if (world && (world.x !== 0 || world.y !== 0)) {
        x = snapCoord(world.x - w / 2, snapToGrid, GRID);
        y = snapCoord(world.y - h / 2, snapToGrid, GRID);
      } else if (anchorNode && anchorNode.magnetEnabled !== false) {
        const spawn = magnetSpawnBelowNode(anchorNode, w, h);
        x = spawn.x;
        y = spawn.y;
        magnetPatch = spawn.patch as Partial<BoardMediaObject>;
      } else {
        const cx = snapshot.viewBox.x + snapshot.viewBox.width / 2;
        const cy = snapshot.viewBox.y + snapshot.viewBox.height / 2;
        x = snapCoord(cx - w / 2, snapToGrid, GRID);
        y = snapCoord(cy - h / 2, snapToGrid, GRID);
      }
      const media = buildMediaFromAttachment(att, {
        x,
        y,
        width: w,
        height: h,
        z: nextZIndex(snapshot),
        ...magnetPatch,
      });
      const doc = extractDocument(snapshot);
      let nextAttachments = doc.attachments ?? [];
      if (anchorNode) {
        nextAttachments = nextAttachments.map((a) =>
          a.id === att.id ? { ...a, anchorNodeId: anchorNode.id } : a
        );
      }
      commitBoard({ ...doc, objects: [...doc.objects, media], attachments: nextAttachments });
      setSelectedIds([media.id]);
      setMode('select');
    },
    [snapshot, commitBoard, guardMutation, snapToGrid, selectedIds]
  );

  const handleAttachmentDrop = useCallback(
    (attachmentRefId: string, world: { x: number; y: number }) => {
      const att = boardAttachments.findByLibraryId(attachmentRefId);
      if (!att) return;
      handlePlaceAttachment(att, world);
    },
    [boardAttachments, handlePlaceAttachment]
  );

  const handleConnectEnd = useCallback(
    (sourceId: string, targetId: string) => {
      if (!guardMutation() || sourceId === targetId) return;
      const doc = extractDocument(snapshot);
      const edge = newConnector(sourceId, targetId);
      let objects = [...doc.objects, edge];
      objects = applyMagnetOnConnect(objects, sourceId, targetId);
      commitBoard({ ...doc, objects, graphTopologyFingerprint: undefined });
      setEdgeSourceId(null);
      setMode('select');
    },
    [snapshot, commitBoard, guardMutation, newConnector]
  );

  const handleConnectorBendChange = useCallback(
    (connectorId: string, bend: { x: number; y: number }) => {
      if (!guardMutation()) return;
      commitBoard(
        extractDocument(
          updateObjectInSnapshot(snapshot, connectorId, { bendPoints: [bend] })
        )
      );
    },
    [snapshot, commitBoard, guardMutation]
  );

  const handleInkStrokeComplete = useCallback(
    (stroke: BoardInkStroke) => {
      if (!guardMutation()) return;
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, inkStrokes: [...(doc.inkStrokes ?? []), stroke] });
    },
    [snapshot, commitBoard, guardMutation]
  );

  const handleMarqueeSelect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }, append: boolean) => {
      const ids = snapshot.objects
        .filter((o) => {
          if (o.type === 'connector') return false;
          if (!('x' in o)) return false;
          if (o.type === 'vector' || o.type === 'node') {
            return aabbIntersects(objectToWorldAabb(o), rect);
          }
          const ox2 = o.x + o.width;
          const oy2 = o.y + o.height;
          const rx2 = rect.x + rect.width;
          const ry2 = rect.y + rect.height;
          return o.x < rx2 && ox2 > rect.x && o.y < ry2 && oy2 > rect.y;
        })
        .map((o) => o.id);
      setSelectedIds(append ? [...new Set([...selectedIds, ...ids])] : ids);
      setSelectedInkIds([]);
    },
    [snapshot.objects, selectedIds]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!guardMutation()) return;
    const file = e.target.files?.[0];
    const place = (fileRef.current as HTMLInputElement & { _place?: { x: number; y: number } })._place;
    if (!file) return;
    e.target.value = '';

    const w = 160;
    const h = 120;
    const anchorNode = resolveSingleSelectedNode(snapshot.objects, selectedIds);
    let x: number;
    let y: number;
    let magnetPatch: Partial<BoardMediaObject> = {};
    if (anchorNode && anchorNode.magnetEnabled !== false) {
      const spawn = magnetSpawnBelowNode(anchorNode, w, h);
      x = spawn.x;
      y = spawn.y;
      magnetPatch = spawn.patch as Partial<BoardMediaObject>;
    } else {
      x = (place?.x ?? snapshot.viewBox.x + snapshot.viewBox.width / 2) - w / 2;
      y = (place?.y ?? snapshot.viewBox.y + snapshot.viewBox.height / 2) - h / 2;
    }

    try {
      let thumbnail: string | undefined;
      if (file.type.startsWith('image/')) {
        thumbnail = await new Promise<string | undefined>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      }

      const att = await boardAttachments.addFromUpload(file);
      if (!att) return;

      const media = buildMediaFromAttachment(att, {
        x,
        y,
        width: w,
        height: h,
        z: nextZIndex(snapshot),
        thumbnail,
        ...magnetPatch,
      });
      const doc = extractDocument(snapshot);
      commitBoard({ ...doc, objects: [...doc.objects, media] });
      setSelectedIds([media.id]);
      setMode('select');
      setAttachmentsBarVisible(true);
    } catch {
      toast.error(t('boards.attachments.uploadFail', 'Upload failed'));
    }
  };

  const handleOpenMedia = (obj: BoardMediaObject) => {
    const src = obj.artifactId
      ? storageService.getDownloadUrl(obj.artifactId, 'inline')
      : obj.thumbnail;
    if (src) openFilePreview({ src, name: obj.name, mimeType: obj.mime, artifactId: obj.artifactId });
  };

  const handleDelete = useCallback(() => {
    if (!selectedIds.length && !selectedInkIds.length) return;
    if (!guardMutation()) return;
    let doc = extractDocument(snapshot);
    if (selectedInkIds.length) {
      doc = {
        ...doc,
        inkStrokes: (doc.inkStrokes ?? []).filter((s) => !selectedInkIds.includes(s.id)),
      };
      setSelectedInkIds([]);
    }
    for (const id of selectedIds) {
      doc = extractDocument(removeObjectFromSnapshot(withViewBox(doc, snapshot.viewBox), id));
    }
    commitBoard(doc);
    setSelectedIds([]);
  }, [selectedIds, selectedInkIds, snapshot, commitBoard, guardMutation]);

  const handleDuplicate = useCallback(() => {
    if (!selectedIds.length || !guardMutation()) return;
    const doc = extractDocument(snapshot);
    const clones: BoardObject[] = [];
    for (const id of selectedIds) {
      const obj = doc.objects.find((o) => 'id' in o && o.id === id);
      if (!obj || obj.type === 'connector' || !('x' in obj)) continue;
      const clone = JSON.parse(JSON.stringify(obj)) as BoardObject;
      if ('x' in clone && 'y' in clone) {
        clone.id = createId();
        clone.x += 24;
        clone.y += 24;
        if ('z' in clone) clone.z = nextZIndex(withViewBox(doc, snapshot.viewBox));
        clones.push(clone);
      }
    }
    commitBoard({ ...doc, objects: [...doc.objects, ...clones] });
  }, [selectedIds, snapshot, commitBoard, guardMutation]);

  const handleExport = (format: BoardExportFormat) => {
    const fullBoard = { ...board, snapshot };
    if (format === 'json') exportBoardJson(fullBoard, snapshot);
    else if (format === 'svg') void exportBoardSvg(fullBoard, snapshot);
    else void exportBoardPng(fullBoard, snapshot);
    toast.success(t('boards.exported', 'Board exported'));
  };

  const applyTemplate = () => {
    if (!guardMutation()) return;
    commitBoard(extractDocument(applyEvidenceWallTemplate()));
    toast.success(t('boards.templateApplied', 'Evidence wall template applied'));
  };

  const fitAll = useCallback(() => {
    const bounds = getSnapshotBounds(snapshot);
    const aspect = snapshot.viewBox.width / snapshot.viewBox.height;
    const vb = fitViewBoxToBounds(bounds, aspect);
    setViewBox(vb);
    setBoard((b) => ({ ...b, snapshot: { ...b.snapshot, viewBox: vb } }));
  }, [snapshot, setViewBox]);

  const handlePresent = useCallback(async () => {
    if (!isPresenting) {
      setActiveTab('present');
      setIsPresenting(true);
      try {
        await canvasContainerRef.current?.requestFullscreen?.();
      } catch {
        /* fullscreen optional */
      }
      if (frames.length) {
        const f = frames[presentFrameIndex] ?? frames[0];
        setViewBox({
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
        });
      } else {
        fitAll();
      }
    } else {
      exitPresentMode();
    }
  }, [isPresenting, frames, presentFrameIndex, fitAll, setViewBox, exitPresentMode]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isPresenting) {
        setIsPresenting(false);
        setActiveTab('canvas');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isPresenting]);

  useEffect(() => {
    if (!isPresenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && frames.length) {
        setPresentFrameIndex((i) => {
          const next = Math.min(i + 1, frames.length - 1);
          const f = frames[next];
          setViewBox({ x: f.x, y: f.y, width: f.width, height: f.height });
          return next;
        });
      }
      if (e.key === 'ArrowLeft' && frames.length) {
        setPresentFrameIndex((i) => {
          const next = Math.max(i - 1, 0);
          const f = frames[next];
          setViewBox({ x: f.x, y: f.y, width: f.width, height: f.height });
          return next;
        });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        exitPresentMode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresenting, frames, setViewBox, exitPresentMode]);

  const handleLayerMove = useCallback(
    (move: LayerMove) => {
      if (!selectedIds.length || !guardMutation()) return;
      const spatialIds = selectedIds.filter((id) => {
        const o = snapshot.objects.find((obj) => 'id' in obj && obj.id === id);
        return o && o.type !== 'connector';
      });
      if (!spatialIds.length) return;
      commitBoard(extractDocument(reorderSpatialLayers(snapshot, spatialIds, move)));
    },
    [selectedIds, snapshot, guardMutation, commitBoard]
  );

  const handleGroupSelection = useCallback(() => {
    if (!selectedIds.length || !guardMutation()) return;
    if (countSelectedSpatial(selectedIds, snapshot.objects) < 2) return;
    commitBoard(
      extractDocument({
        ...snapshot,
        objects: groupSpatialObjects(snapshot.objects, selectedIds),
      })
    );
  }, [selectedIds, snapshot, guardMutation, commitBoard]);

  const handleUngroupSelection = useCallback(() => {
    if (!selectedIds.length || !guardMutation()) return;
    commitBoard(
      extractDocument({
        ...snapshot,
        objects: ungroupSpatialObjects(snapshot.objects, selectedIds),
      })
    );
  }, [selectedIds, snapshot, guardMutation, commitBoard]);

  const handleLinkSelectedNodes = useCallback(() => {
    if (!guardMutation()) return;
    const nodeIds = selectedIds.filter(
      (id) => snapshot.objects.find((o) => o.id === id)?.type === 'node'
    );
    if (nodeIds.length < 2) return;
    let objects = snapshot.objects;
    for (let i = 1; i < nodeIds.length; i++) {
      objects = linkNodesBidirectional(objects, nodeIds[0], nodeIds[i]);
    }
    commitBoard(syncDocWithGraphLinks(extractDocument({ ...snapshot, objects })));
  }, [selectedIds, snapshot, guardMutation, commitBoard, syncDocWithGraphLinks]);

  const handleLinkConnectedNodes = useCallback(() => {
    if (!guardMutation()) return;
    commitBoard(
      syncDocWithGraphLinks(
        extractDocument({
          ...snapshot,
          objects: linkConnectedNodes(snapshot.objects),
          graphTopologyFingerprint: undefined,
        })
      )
    );
  }, [snapshot, guardMutation, commitBoard, syncDocWithGraphLinks]);

  const handleUnlinkSelectedNodes = useCallback(() => {
    if (!guardMutation()) return;
    const nodeIds = selectedIds.filter(
      (id) => snapshot.objects.find((o) => o.id === id)?.type === 'node'
    );
    if (nodeIds.length < 2) return;
    const objects = unlinkAllAmongNodes(snapshot.objects, nodeIds);
    commitBoard(syncDocWithGraphLinks(extractDocument({ ...snapshot, objects })));
  }, [selectedIds, snapshot, guardMutation, commitBoard, syncDocWithGraphLinks]);

  const handleAnchorLinkChange = useCallback(
    (nodeId: string, otherId: string, linked: boolean) => {
      if (!guardMutation()) return;
      const objects = linked
        ? linkNodesBidirectional(snapshot.objects, nodeId, otherId)
        : unlinkNodesBidirectional(snapshot.objects, nodeId, otherId);
      commitBoard(syncDocWithGraphLinks(extractDocument({ ...snapshot, objects })));
    },
    [snapshot, guardMutation, commitBoard, syncDocWithGraphLinks]
  );

  const handleContextAction = useCallback(
    (action: CanvasContextAction) => {
      if (action.type !== 'fit-all' && action.type !== 'center-view' && action.type !== 'toggle-snap' && action.type !== 'clear-selection') {
        if (!guardMutation()) return;
      }
      const doc = extractDocument(snapshot);
      switch (action.type) {
        case 'add-sticky':
          addStickyAt(action.worldX, action.worldY);
          break;
        case 'add-node':
          addNodeAt(action.worldX, action.worldY);
          break;
        case 'add-image':
          fileRef.current?.click();
          (fileRef.current as HTMLInputElement & { _place?: { x: number; y: number } })._place = placeAt(
            action.worldX,
            action.worldY
          );
          break;
        case 'add-frame':
          setMode('addFrame');
          break;
        case 'fit-all':
          fitAll();
          break;
        case 'center-view':
          setViewBox({
            ...snapshot.viewBox,
            x: (ctxMenu?.hit.kind === 'canvas' ? ctxMenu.hit.worldX : 0) - snapshot.viewBox.width / 2,
            y: (ctxMenu?.hit.kind === 'canvas' ? ctxMenu.hit.worldY : 0) - snapshot.viewBox.height / 2,
          });
          break;
        case 'toggle-snap':
          toggleSnap();
          break;
        case 'clear-selection':
          setSelectedIds([]);
          setSelectedInkIds([]);
          break;
        case 'duplicate':
          handleDuplicate();
          break;
        case 'delete':
          handleDelete();
          break;
        case 'layer-move':
          handleLayerMove(action.move);
          break;
        case 'lock-toggle':
          if (selectedIds[0]) {
            const obj = doc.objects.find((o) => 'id' in o && o.id === selectedIds[0]);
            if (obj && 'locked' in obj) {
              commitBoard(
                extractDocument(
                  updateObjectInSnapshot(snapshot, selectedIds[0], { locked: !obj.locked })
                )
              );
            }
          }
          break;
        case 'copy-id':
          void navigator.clipboard?.writeText(action.id);
          toast.success(t('boards.copiedId', 'ID copied'));
          break;
        case 'start-connection':
          setMode('addEdge');
          setEdgeSourceId(action.nodeId);
          break;
        case 'reverse-connector': {
          const conn = doc.objects.find((o) => o.type === 'connector' && o.id === action.id) as
            | BoardConnectorObject
            | undefined;
          if (conn) {
            commitBoard({
              ...doc,
              objects: doc.objects.map((o) =>
                o.id === action.id && o.type === 'connector'
                  ? { ...o, sourceId: conn.targetId, targetId: conn.sourceId }
                  : o
              ),
            });
          }
          break;
        }
        case 'delete-ink':
          commitBoard({
            ...doc,
            inkStrokes: (doc.inkStrokes ?? []).filter((s) => s.id !== action.id),
          });
          break;
        case 'set-node-shape':
          setSelectedIds([action.id]);
          commitBoard(
            extractDocument(
              updateObjectInSnapshot(snapshot, action.id, {
                nodeShape: action.shape,
                geometry: geometryFromPreset(action.shape),
              })
            )
          );
          break;
        case 'edit-node-label':
          setSelectedIds([action.id]);
          showPanel('selection');
          setLabelFocusId(action.id);
          break;
        case 'edit-connector-label':
          setSelectedIds([action.id]);
          showPanel('selection');
          setLabelFocusId(action.id);
          break;
        case 'paste':
          if (ctxMenu?.hit.kind === 'canvas') {
            handlePaste({ x: ctxMenu.hit.worldX, y: ctxMenu.hit.worldY });
          } else {
            handlePaste();
          }
          break;
        case 'import-shape':
          shapeImportRef.current?.click();
          break;
        case 'edit-path':
          setSelectedIds([action.id]);
          setMode('editPath');
          break;
        case 'convert-to-node':
          handleConvertVectorToNode(action.id);
          break;
        case 'boolean-combine':
          handleBooleanCombine(action.op);
          break;
        case 'group-selection':
          handleGroupSelection();
          break;
        case 'ungroup-selection':
          handleUngroupSelection();
          break;
        case 'link-nodes-move':
          handleLinkSelectedNodes();
          break;
        case 'link-connected-nodes':
          handleLinkConnectedNodes();
          break;
        case 'unlink-nodes-move':
          handleUnlinkSelectedNodes();
          break;
        default:
          break;
      }
    },
    [
      snapshot,
      guardMutation,
      addStickyAt,
      addNodeAt,
      placeAt,
      fitAll,
      ctxMenu,
      setViewBox,
      toggleSnap,
      t,
      handleDuplicate,
      handleDelete,
      handlePaste,
      selectedIds,
      commitBoard,
      handleLayerMove,
      handleBooleanCombine,
      handleConvertVectorToNode,
      handleGroupSelection,
      handleUngroupSelection,
      handleLinkSelectedNodes,
      handleLinkConnectedNodes,
      handleUnlinkSelectedNodes,
    ]
  );

  useBoardShortcuts({
    'tool.select': () => setMode('select'),
    'tool.pan': () => setMode('pan'),
    'tool.draw': () => setMode('draw'),
    'tool.sticky': () => setMode('addSticky'),
    'tool.node': () => setMode('addNode'),
    'tool.edge': () => setMode('addEdge'),
    'tool.frame': () => setMode('addFrame'),
    'tool.comment': () => setMode('addComment'),
    'tool.addVector': () => setMode('addVector'),
    'edit.copy': handleCopy,
    'edit.paste': () => handlePaste(),
    'edit.delete': handleDelete,
    'edit.duplicate': handleDuplicate,
    'edit.deselect': () => {
      if (mode === 'addComment') {
        setMode('select');
        setPendingCommentPin(null);
        return;
      }
      if (isPresenting) {
        exitPresentMode();
        return;
      }
      setSelectedIds([]);
      setSelectedInkIds([]);
    },
    'arrange.front': () => handleLayerMove('front'),
    'arrange.forward': () => handleLayerMove('forward'),
    'arrange.backward': () => handleLayerMove('backward'),
    'arrange.back': () => handleLayerMove('back'),
    'history.undo': undo,
    'history.redo': redo,
    'view.zoomIn': () =>
      setViewBox({
        ...snapshot.viewBox,
        width: snapshot.viewBox.width * 0.85,
        height: snapshot.viewBox.height * 0.85,
        x: snapshot.viewBox.x + snapshot.viewBox.width * 0.075,
        y: snapshot.viewBox.y + snapshot.viewBox.height * 0.075,
      }),
    'view.zoomOut': () =>
      setViewBox({
        ...snapshot.viewBox,
        width: snapshot.viewBox.width * 1.15,
        height: snapshot.viewBox.height * 1.15,
        x: snapshot.viewBox.x - snapshot.viewBox.width * 0.075,
        y: snapshot.viewBox.y - snapshot.viewBox.height * 0.075,
      }),
    'view.fit': fitAll,
    'view.toggleSnap': toggleSnap,
    'system.shortcuts': () => {},
  });

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      setPanHoldActive(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanHoldActive(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useEffect(() => {
    if (mode === 'addNode') {
      if (isCompactMd) showPanel('tools', 'floating');
      else showPanel('tools');
    }
  }, [mode, isCompactMd, showPanel]);

  useEffect(() => {
    setCtxPasteAvailable(hasBoardClipboard());
  }, [selectedIds, snapshot.objects]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (!selectedIds.length || activeTab !== 'canvas') return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeSelection(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeSelection(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeSelection(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeSelection(0, step);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, activeTab, nudgeSelection]);

  const selectedSpatialCount = useMemo(
    () => countSelectedSpatial(selectedIds, snapshot.objects),
    [selectedIds, snapshot.objects]
  );

  const selectedNodeCount = useMemo(
    () =>
      selectedIds.filter((id) => snapshot.objects.find((o) => o.id === id)?.type === 'node').length,
    [selectedIds, snapshot.objects]
  );

  const selectionCanUngroup = useMemo(
    () =>
      selectedIds.some((id) => {
        const o = snapshot.objects.find((obj) => obj.id === id);
        return o && o.type !== 'connector' && (o as BoardObjectBase).objectGroupId;
      }),
    [selectedIds, snapshot.objects]
  );

  const canUnlinkNodesInSelection = useMemo(() => {
    const nodeIds = selectedIds.filter(
      (id) => snapshot.objects.find((o) => o.id === id)?.type === 'node'
    );
    return nodeIds.length >= 2 && getAnchorLinksAmong(snapshot.objects, nodeIds).length > 0;
  }, [selectedIds, snapshot.objects]);

  const inspectorLinkProps = {
    onGroupSelection: handleGroupSelection,
    onUngroupSelection: handleUngroupSelection,
    onLinkSelectedNodes: handleLinkSelectedNodes,
    onLinkConnectedNodes: handleLinkConnectedNodes,
    onAnchorLinkChange: handleAnchorLinkChange,
    onUnlinkAllAmong: handleUnlinkSelectedNodes,
    onNodeLabelEditStart: () => {
      if (!guardMutation()) return;
      if (!nodeLabelEditActiveRef.current) {
        nodeLabelEditActiveRef.current = true;
        beginGesture();
      }
    },
    onNodeLabelEditEnd: () => {
      if (nodeLabelEditActiveRef.current) {
        nodeLabelEditActiveRef.current = false;
        endGesture();
      }
    },
    onBackgroundLayersChange: (layers: import('../lib/board-types').BoardBackgroundLayer[]) =>
      patchDocument({ backgroundLayers: layers }),
  };

  const inspectorMediaProps = {
    attachments: snapshot.attachments ?? [],
    onJumpToAttachment: (libraryId: string) => {
      openAttachmentsPanel();
      setAttachmentsBarVisible(true);
      void libraryId;
    },
    onDetachMediaFromLibrary: (mediaId: string) => {
      inspectorObjectPatch(mediaId, { attachmentRefId: undefined } as Partial<BoardMediaObject>);
    },
    onDeleteMedia: handleDelete,
    onReplaceMediaArtifact: (mediaId: string, artifactId: string) => {
      const att = boardAttachments.findByArtifactId(artifactId);
      inspectorObjectPatch(mediaId, {
        artifactId,
        attachmentRefId: att?.id,
        name: att?.name,
        mime: att?.mimeType ?? att?.mime,
      } as Partial<BoardMediaObject>);
    },
  };

  const settingsPanelTitle = t(
    settingsPanelTitleKey(activeTab),
    settingsPanelTitleDefault(activeTab)
  );

  const settingsSidebar = (
    <BoardSettingsSidebar
      activeTab={activeTab}
      board={board}
      graphSettings={graphSettings}
      onGraphSettingsChange={handleGraphViewSettingsChange}
      onReportChange={handleReportSettingsChange}
      selectedObjects={selectedObjects}
      selectedInk={selectedInk}
      onTitleChange={(title) => setBoard((b) => ({ ...b, title }))}
      onCaseIdChange={(caseId) => setBoard((b) => ({ ...b, caseId: caseId || undefined }))}
      onObjectPatch={inspectorObjectPatch}
      onBulkObjectPatch={inspectorBulkObjectPatch}
      onInkPatch={inspectorInkPatch}
      onStyleDefaultsChange={handleStyleDefaultsChange}
      onToggleLegalHold={handleToggleLegalHold}
      readOnly={readOnly}
      onCheckpointRestore={handleCheckpointRestore}
      onPresentFrame={jumpToFrame}
      onLayerMove={handleLayerMove}
      onBooleanCombine={handleBooleanCombine}
      onBackgroundLayersChange={inspectorLinkProps.onBackgroundLayersChange}
      className="border-0"
    />
  );

  const showCanvas = activeTab === 'canvas' || activeTab === 'present';

  const attachmentsPanelProps = {
    attachments: snapshot.attachments ?? [],
    boardId: board.id,
    caseId: board.caseId,
    readOnly,
    onChange: handleAttachmentsChange,
    onPlaceOnBoard: (att: BoardAttachmentRef) => handlePlaceAttachment(att),
    onAddFromArtifact: (
      meta: Parameters<typeof boardAttachments.addFromArtifact>[0],
      source: Parameters<typeof boardAttachments.addFromArtifact>[1]
    ) => boardAttachments.addFromArtifact(meta, source) !== false,
    onUpload: async (file: File) => !!(await boardAttachments.addFromUpload(file)),
    onRemove: boardAttachments.removeAttachments,
    onRefreshMetadata: boardAttachments.refreshMetadata,
    onMigrateBlobs: () => void handleMigrateBlobs(),
    placementCounts: attachmentPlacementCounts,
  };

  return (
    <BoardEditorProvider
      value={{ board, snapshot, selectedIds, readOnly: Boolean(readOnly) }}
    >
    <BoardEyedropperProvider>
    <div className="flex h-[calc(100vh-10rem)] min-h-[480px] flex-col">
      {!isPresenting ? (
        <BoardToolbar
          mode={mode}
          activeTab={activeTab}
          canUndo={canUndo}
          canRedo={canRedo}
          legalHold={snapshot.legalHold}
          isPresenting={isPresenting}
          snapToGrid={snapToGrid}
          gridPreferences={gridPreferences}
          onGridPreferencesChange={patchGridPreferences}
          onModeChange={setMode}
          onTabChange={setActiveTab}
          onUndo={undo}
          onRedo={redo}
          onShare={() => setShareOpen(true)}
          onExport={handleExport}
          onPresent={handlePresent}
          onToggleSnap={toggleSnap}
          onCommentsOpen={() => {
            setMode('addComment');
            openCommentsPanel();
            toast(t('boards.comments.placeHint', 'Click on the canvas to place a comment pin.'), { icon: '💬' });
          }}
          onAttachmentsOpen={() => {
            openAttachmentsPanel();
            setAttachmentsBarVisible(true);
          }}
          onOneSearch={() => router.push(`${routes.oneSearch.root}?mode=image`)}
          onApplyTemplate={applyTemplate}
          onBackToHub={() => router.push(routes.userBoards.hub)}
          selectionPanelVisible={panelPrefs.selection.visible}
          settingsPanelVisible={panelPrefs.settings.visible}
          toolsPanelVisible={panelPrefs.tools.visible}
          onToggleSelectionPanel={() => toggleInspectorSidePanel('selection')}
          onToggleSettingsPanel={() => toggleInspectorSidePanel('settings')}
          onToggleToolsPanel={toggleToolsSidePanel}
          miniMapVisible={panelPrefs.minimap.visible}
          onToggleMiniMap={() => togglePanel('minimap')}
          nodeShape={nodeShape}
          onNodeShapeChange={setNodeShape}
          hiddenNodeRoles={canvasHiddenNodeRoles}
          onHiddenNodeRolesChange={handleHiddenRolesChange}
          onImport={() => importRef.current?.click()}
          onImportShape={() => shapeImportRef.current?.click()}
        />
      ) : null}

      {mode === 'draw' && showCanvas && !isPresenting ? (
        <DrawToolOptions settings={drawSettings} onChange={(p) => setDrawSettings((s) => ({ ...s, ...p }))} />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {showCanvas && activeTab === 'canvas' && !isPresenting && panelPrefs.tools.visible && panelPrefs.tools.mode === 'docked' ? (
          <div className="hidden shrink-0 md:flex">
            <BoardPanelShell
              id="board-tools"
              title={t('boards.panel.tools', 'Node tools')}
              visible
              side="left"
              mode={panelPrefs.tools.mode}
              defaultWidth={168}
              minWidth={140}
              maxWidth={260}
              onModeChange={(mode) => setPanelMode('tools', mode)}
              onClose={() => hidePanel('tools')}
            >
              <BoardTypePalette activeRole={nodeRole} onRoleChange={handleNodeRoleChange} />
              <BoardNodeShapePicker activeShape={nodeShape} onShapeChange={setNodeShape} />
            </BoardPanelShell>
          </div>
        ) : null}

        <div ref={canvasContainerRef} className="relative min-w-0 flex-1">
          {showCanvas ? (
            <>
              <BoardCanvas
                ref={canvasRef}
                snapshot={snapshot}
                mode={isPresenting ? 'pan' : mode}
                selectedIds={selectedIds}
                selectedInkIds={selectedInkIds}
                edgeSourceId={edgeSourceId}
                drawSettings={drawSettings}
                snapToGrid={snapToGrid}
                gridPreferences={gridPreferences}
                readOnly={readOnly}
                panHoldActive={panHoldActive}
                hiddenNodeRoles={canvasHiddenNodeRoles}
                onViewBoxChange={handleCanvasViewBoxChange}
                onSelect={handleSelect}
                onSelectInk={setSelectedInkIds}
                onObjectsDragEnd={handleObjectsDragEnd}
                onObjectResizeEnd={handleObjectResizeEnd}
                onObjectRotationEnd={handleObjectRotationEnd}
                onBulkTransformEnd={handleBulkTransformEnd}
                onFrameCreate={handleFrameCreate}
                onDragStart={beginDrag}
                onDragEnd={endDrag}
                onStickyTextFocus={(id) => {
                  if (!guardMutation()) return;
                  if (stickyEditActiveRef.current !== id) {
                    stickyEditActiveRef.current = id;
                    beginGesture();
                  }
                }}
                onStickyTextBlur={() => {
                  if (stickyEditActiveRef.current) {
                    stickyEditActiveRef.current = null;
                    endGesture();
                  }
                }}
                onStickyTextChange={(id, text) => {
                  if (!guardMutation()) return;
                  replaceDuringGesture(
                    extractDocument(updateObjectInSnapshot(snapshot, id, { text }))
                  );
                  setBoard((b) => ({
                    ...b,
                    snapshot: updateObjectInSnapshot(snapshot, id, { text }),
                    updatedAt: new Date().toISOString(),
                  }));
                }}
                onStickyStrokesChange={(id, inkStrokes) => {
                  if (!guardMutation()) return;
                  beginGesture();
                  replaceDuringGesture(
                    extractDocument(updateObjectInSnapshot(snapshot, id, { inkStrokes: inkStrokes ?? [] }))
                  );
                  endGesture();
                }}
                onStickyInkRegionChange={(id, inkRegion) => {
                  if (!guardMutation()) return;
                  commitBoard(extractDocument(updateObjectInSnapshot(snapshot, id, { inkRegion })));
                }}
                onConnectEnd={handleConnectEnd}
                onConnectorBendChange={handleConnectorBendChange}
                onCanvasClick={handleCanvasClick}
                onCommentPinClick={(commentId) => {
                  setHighlightedCommentId(commentId);
                  openCommentsPanel();
                }}
                onOpenMediaPreview={handleOpenMedia}
                onInkStrokeComplete={handleInkStrokeComplete}
                onInkStrokesReplace={(strokes) => {
                  const doc = extractDocument(snapshot);
                  commitBoard({ ...doc, inkStrokes: strokes });
                }}
                onContextMenu={(e, world) => {
                  const hit = resolveCanvasContextHit(e.target, world);
                  if (hit.kind === 'object') {
                    setSelectedIds([hit.id]);
                    setSelectedInkIds([]);
                  } else if (hit.kind === 'ink') {
                    setSelectedInkIds([hit.id]);
                    setSelectedIds([]);
                  }
                  setCtxMenu({ x: e.clientX, y: e.clientY, hit });
                }}
                onMarqueeSelect={handleMarqueeSelect}
                onCornerRadiiChange={handleCornerRadiiChange}
                onVectorDrawComplete={handleVectorDrawComplete}
                onPathGeometryChange={handlePathGeometryChange}
                onAttachmentDrop={handleAttachmentDrop}
              />
              {!isPresenting && panelPrefs.minimap.visible && activeTab === 'canvas' ? (
                <BoardMiniMap
                  id={`board-${board.id}`}
                  snapshot={snapshot}
                  viewBox={snapshot.viewBox}
                  selectedIds={selectedIds}
                  onViewBoxChange={handleCanvasViewBoxChange}
                  onCenter={fitAll}
                  onClose={() => hidePanel('minimap')}
                />
              ) : null}
              <BoardAttachmentsBar
                attachments={snapshot.attachments ?? []}
                visible={attachmentsBarVisible && !isPresenting && activeTab === 'canvas'}
                onPlaceOnBoard={(att, world) => handlePlaceAttachment(att, world)}
              />
              {activeTab === 'canvas' && selectedIds.length > 1 ? (
                <BoardMultiSelectBar
                  totalCount={selectedIds.length}
                  spatialCount={selectedSpatialCount}
                  onAlign={handleMultiSelectAlign}
                />
              ) : null}
              {isPresenting && frames.length ? (
                <div className="absolute bottom-4 start-1/2 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2">
                  <div className="rounded bg-black/60 px-3 py-1 text-xs text-white">
                    {presentFrameIndex + 1} / {frames.length}
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {frames.map((f, i) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          i === presentFrameIndex ? 'bg-white text-gray-900' : 'bg-black/50 text-white'
                        }`}
                        onClick={() => jumpToFrame(f.id)}
                      >
                        {f.title || `Slide ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {activeTab === 'graph' ? (
            <BoardGraphExplorerView
              snapshot={snapshot}
              readOnly={readOnly}
              graphSettings={graphSettings}
              onGraphSettingsChange={handleGraphViewSettingsChange}
              graphFilter={graphFilter}
              onGraphFilterChange={handleGraphViewFilterChange}
              onNodeMove={handleGraphNodeMove}
              autoLayoutToken={graphAutoLayoutToken}
              onLayoutChange={handleGraphLayoutChange}
              onApplyToCanvas={handleApplyGraphLayoutToCanvas}
              onSelectBoardObject={(objectId) => {
                setSelectedIds([objectId]);
                setActiveTab('canvas');
                openInspectorPanel('selection');
              }}
              onDragGestureStart={beginGesture}
              onDragGestureEnd={endGesture}
              className="h-full"
              selectionSidePanel={{
                id: 'board-selection',
                title: t('boards.panel.selection', 'Selection'),
                visible: panelPrefs.selection.visible,
                mode: panelPrefs.selection.mode,
                onModeChange: (mode) => setPanelMode('selection', mode),
                onClose: () => hidePanel('selection'),
                defaultWidth: BOARD_PANEL_REGISTRY.selection.defaultWidth,
                minWidth: BOARD_PANEL_REGISTRY.selection.minWidth,
                maxWidth: BOARD_PANEL_REGISTRY.selection.maxWidth,
                children: (
                  <BoardInspector
                    board={board}
                    selectedObjects={selectedObjects}
                    selectedInk={selectedInk}
                    variant="selection"
                    onTitleChange={(title) => setBoard((b) => ({ ...b, title }))}
                    onCaseIdChange={(caseId) => setBoard((b) => ({ ...b, caseId: caseId || undefined }))}
                    onObjectPatch={inspectorObjectPatch}
                    onBulkObjectPatch={inspectorBulkObjectPatch}
                    onInkPatch={inspectorInkPatch}
                    onStyleDefaultsChange={handleStyleDefaultsChange}
                    onToggleLegalHold={handleToggleLegalHold}
                    readOnly={readOnly}
                    onCheckpointRestore={handleCheckpointRestore}
                    onPresentFrame={jumpToFrame}
                    focusLabelObjectId={labelFocusId}
                    onLabelFocusDone={() => setLabelFocusId(null)}
                    onLayerMove={handleLayerMove}
                    onBooleanCombine={handleBooleanCombine}
                    {...inspectorLinkProps}
                    {...inspectorMediaProps}
                    className="border-0"
                  />
                ),
              }}
              settingsSidePanel={{
                id: 'board-settings',
                title: settingsPanelTitle,
                visible: panelPrefs.settings.visible,
                mode: panelPrefs.settings.mode,
                onModeChange: (mode) => setPanelMode('settings', mode),
                onClose: () => hidePanel('settings'),
                defaultWidth: BOARD_PANEL_REGISTRY.settings.defaultWidth,
                minWidth: BOARD_PANEL_REGISTRY.settings.minWidth,
                maxWidth: BOARD_PANEL_REGISTRY.settings.maxWidth,
                children: settingsSidebar,
              }}
            />
          ) : null}
          {activeTab === 'report' ? (
            <BoardReportPanel
              snapshot={snapshot}
              onChange={(patch) => {
                if (!guardMutation()) return;
                const doc = { ...extractDocument(snapshot), ...patch };
                replaceDuringGesture(doc);
                setBoard((b) => ({
                  ...b,
                  snapshot: withViewBox(doc, snapshot.viewBox),
                  updatedAt: new Date().toISOString(),
                }));
              }}
              onEditSessionStart={() => {
                if (!guardMutation()) return;
                if (!reportEditActiveRef.current) {
                  reportEditActiveRef.current = true;
                  beginGesture();
                }
              }}
              onEditSessionEnd={() => {
                if (reportEditActiveRef.current) {
                  reportEditActiveRef.current = false;
                  endGesture();
                }
              }}
            />
          ) : null}
        </div>

        <div className="hidden shrink-0 lg:flex">
          {activeTab === 'canvas' && !isPresenting && panelPrefs.selection.visible && panelPrefs.selection.mode === 'docked' ? (
            <BoardPanelShell
              id="board-selection"
              title={t('boards.panel.selection', 'Selection')}
              visible
              mode={panelPrefs.selection.mode}
              onModeChange={(mode) => setPanelMode('selection', mode)}
              onClose={() => hidePanel('selection')}
            >
              <BoardInspector
                board={board}
                selectedObjects={selectedObjects}
                selectedInk={selectedInk}
                variant="selection"
                onTitleChange={(title) => setBoard((b) => ({ ...b, title }))}
                onCaseIdChange={(caseId) => setBoard((b) => ({ ...b, caseId: caseId || undefined }))}
                onObjectPatch={inspectorObjectPatch}
                onBulkObjectPatch={inspectorBulkObjectPatch}
                onInkPatch={inspectorInkPatch}
                onStyleDefaultsChange={handleStyleDefaultsChange}
                onToggleLegalHold={handleToggleLegalHold}
                readOnly={readOnly}
                onCheckpointRestore={handleCheckpointRestore}
                onPresentFrame={jumpToFrame}
                focusLabelObjectId={labelFocusId}
                onLabelFocusDone={() => setLabelFocusId(null)}
                onLayerMove={handleLayerMove}
                onBooleanCombine={handleBooleanCombine}
                {...inspectorLinkProps}
                {...inspectorMediaProps}
                className="border-0"
              />
            </BoardPanelShell>
          ) : null}
          {(activeTab === 'canvas' || activeTab === 'report') && !isPresenting && panelPrefs.settings.visible && panelPrefs.settings.mode === 'docked' ? (
            <BoardPanelShell
              id="board-settings"
              title={settingsPanelTitle}
              visible
              mode={panelPrefs.settings.mode}
              onModeChange={(mode) => setPanelMode('settings', mode)}
              onClose={() => hidePanel('settings')}
            >
              {settingsSidebar}
            </BoardPanelShell>
          ) : null}
          {activeTab === 'canvas' && !isPresenting && panelPrefs.comments.visible && panelPrefs.comments.mode === 'docked' ? (
            <BoardPanelShell
              id="board-comments"
              boardId={board.id}
              title={t('boards.comments.title', 'Comments')}
              visible
              mode={panelPrefs.comments.mode}
              side="right"
              defaultWidth={BOARD_PANEL_REGISTRY.comments.defaultWidth}
              onModeChange={(mode) => setPanelMode('comments', mode)}
              onClose={() => {
                hidePanel('comments');
                setPendingCommentPin(null);
                setMode('select');
              }}
            >
              <BoardCommentsPanel
                comments={snapshot.comments ?? []}
                pendingPin={pendingCommentPin}
                selectedObjectId={selectedIds.length === 1 ? selectedIds[0] : undefined}
                addCommentMode={mode === 'addComment'}
                highlightedCommentId={highlightedCommentId}
                onChange={handleCommentsChange}
              />
            </BoardPanelShell>
          ) : null}
          {activeTab === 'canvas' && !isPresenting && panelPrefs.attachments.visible && panelPrefs.attachments.mode === 'docked' ? (
            <BoardPanelShell
              id="board-attachments"
              boardId={board.id}
              title={t('boards.attachments.title', 'Attachments')}
              visible
              mode={panelPrefs.attachments.mode}
              side="right"
              defaultWidth={BOARD_PANEL_REGISTRY.attachments.defaultWidth}
              onModeChange={(mode) => setPanelMode('attachments', mode)}
              onClose={() => hidePanel('attachments')}
            >
              <BoardAttachmentsPanel {...attachmentsPanelProps} />
            </BoardPanelShell>
          ) : null}
        </div>
      </div>

      {panelPrefs.selection.visible && panelPrefs.selection.mode === 'floating' && activeTab !== 'graph' ? (
        <BoardPanelShell
          id="board-selection-float"
          title={t('boards.panel.selection', 'Selection')}
          visible
          mode="floating"
          side="right"
          onModeChange={(mode) => setPanelMode('selection', mode)}
          onClose={() => hidePanel('selection')}
        >
          <BoardInspector
            board={board}
            selectedObjects={selectedObjects}
            selectedInk={selectedInk}
            variant="selection"
            onTitleChange={(title) => setBoard((b) => ({ ...b, title }))}
            onCaseIdChange={(caseId) => setBoard((b) => ({ ...b, caseId: caseId || undefined }))}
            onObjectPatch={inspectorObjectPatch}
            onBulkObjectPatch={inspectorBulkObjectPatch}
            onInkPatch={inspectorInkPatch}
            onStyleDefaultsChange={handleStyleDefaultsChange}
            onToggleLegalHold={handleToggleLegalHold}
            readOnly={readOnly}
            onCheckpointRestore={handleCheckpointRestore}
            onPresentFrame={jumpToFrame}
            focusLabelObjectId={labelFocusId}
            onLabelFocusDone={() => setLabelFocusId(null)}
            onLayerMove={handleLayerMove}
            onBooleanCombine={handleBooleanCombine}
            {...inspectorLinkProps}
            {...inspectorMediaProps}
            className="border-0"
          />
        </BoardPanelShell>
      ) : null}
      {panelPrefs.settings.visible && panelPrefs.settings.mode === 'floating' && activeTab !== 'graph' ? (
        <BoardPanelShell
          id="board-settings-float"
          title={settingsPanelTitle}
          visible
          mode="floating"
          side="right"
          onModeChange={(mode) => setPanelMode('settings', mode)}
          onClose={() => hidePanel('settings')}
        >
          {settingsSidebar}
        </BoardPanelShell>
      ) : null}
      {showCanvas && activeTab === 'canvas' && !isPresenting && panelPrefs.tools.visible && panelPrefs.tools.mode === 'floating' ? (
        <BoardPanelShell
          id="board-tools-float"
          title={t('boards.panel.tools', 'Node tools')}
          visible
          side="left"
          mode="floating"
          defaultWidth={168}
          minWidth={140}
          maxWidth={260}
          onModeChange={(mode) => setPanelMode('tools', mode)}
          onClose={() => hidePanel('tools')}
        >
          <BoardTypePalette activeRole={nodeRole} onRoleChange={handleNodeRoleChange} />
          <BoardNodeShapePicker activeShape={nodeShape} onShapeChange={setNodeShape} />
        </BoardPanelShell>
      ) : null}

      {!isPresenting ? (
        <div className="border-t border-muted px-3 py-1.5">
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => setShowFootprint((v) => !v)}>
            {t('boards.apiFootprint', 'API footprint')}
          </button>
          {showFootprint ? <BoardApiFootprint className="mt-2" /> : null}
        </div>
      ) : null}

      <input ref={fileRef} type="file" accept="image/*,application/pdf,video/*,audio/*" className="hidden" onChange={handleFileChange} />
      <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
      <input ref={shapeImportRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleShapeImportFile} />

      <ShareBoardDialog
        boardId={board.id}
        boardTitle={board.title}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      <CanvasContextMenu
        open={Boolean(ctxMenu)}
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        hit={ctxMenu?.hit ?? null}
        snapEnabled={snapToGrid}
        canPaste={ctxPasteAvailable}
        selectionCount={selectedIds.filter((id) => {
          const o = snapshot.objects.find((obj) => 'id' in obj && obj.id === id);
          return o && (o.type === 'vector' || o.type === 'node');
        }).length}
        spatialSelectionCount={selectedSpatialCount}
        nodeSelectionCount={selectedNodeCount}
        canUngroup={selectionCanUngroup}
        canUnlinkNodes={canUnlinkNodesInSelection}
        activeNodeShape={
          ctxMenu?.hit.kind === 'object' && ctxMenu.hit.objectType === 'node'
            ? normalizeNodeShape(
                (
                  snapshot.objects.find(
                    (o) => 'id' in ctxMenu.hit && o.id === ctxMenu.hit.id
                  ) as BoardNodeObject | undefined
                )?.nodeShape
              )
            : undefined
        }
        onClose={() => setCtxMenu(null)}
        onAction={handleContextAction}
      />

      <Drawer
        isOpen={inspectorOpen && isCompactLg}
        onClose={() => closeSideDrawer(inspectorDrawerVariant)}
        placement="right"
        size="sm"
      >
        {inspectorDrawerVariant === 'settings' ? (
          settingsSidebar
        ) : inspectorDrawerVariant === 'comments' ? (
          <BoardCommentsPanel
            comments={snapshot.comments ?? []}
            pendingPin={pendingCommentPin}
            selectedObjectId={selectedIds.length === 1 ? selectedIds[0] : undefined}
            addCommentMode={mode === 'addComment'}
            highlightedCommentId={highlightedCommentId}
            onChange={handleCommentsChange}
          />
        ) : inspectorDrawerVariant === 'attachments' ? (
          <BoardAttachmentsPanel {...attachmentsPanelProps} />
        ) : (
          <BoardInspector
            board={board}
            selectedObjects={selectedObjects}
            selectedInk={selectedInk}
            variant="selection"
            onTitleChange={(title) => setBoard((b) => ({ ...b, title }))}
            onCaseIdChange={(caseId) => setBoard((b) => ({ ...b, caseId: caseId || undefined }))}
            onObjectPatch={inspectorObjectPatch}
            onBulkObjectPatch={inspectorBulkObjectPatch}
            onInkPatch={inspectorInkPatch}
            onStyleDefaultsChange={handleStyleDefaultsChange}
            onToggleLegalHold={handleToggleLegalHold}
            readOnly={readOnly}
            onCheckpointRestore={handleCheckpointRestore}
            onPresentFrame={jumpToFrame}
            focusLabelObjectId={labelFocusId}
            onLabelFocusDone={() => setLabelFocusId(null)}
            onLayerMove={handleLayerMove}
            onBooleanCombine={handleBooleanCombine}
            {...inspectorLinkProps}
            {...inspectorMediaProps}
            className="border-0"
          />
        )}
      </Drawer>

      {(['comments', 'attachments'] as const).map((panelId) => {
        const def = BOARD_PANEL_REGISTRY[panelId];
        const pref = panelPrefs[panelId];
        if (!pref.visible) return null;
        if (pref.mode === 'docked') return null;
        if (isCompactLg) return null;
        return (
          <BoardPanelShell
            key={panelId}
            id={`board-${panelId}`}
            boardId={board.id}
            title={t(
              panelId === 'comments' ? 'boards.comments.title' : 'boards.attachments.title',
              panelId === 'comments' ? 'Comments' : 'Attachments'
            )}
            visible
            mode={pref.mode}
            side={def.side}
            defaultWidth={def.defaultWidth}
            minWidth={def.minWidth}
            maxWidth={def.maxWidth}
            supportsPopout={def.supportsPopout}
            supportsMinimize={def.supportsMinimize}
            onModeChange={(mode) => setPanelMode(panelId, mode)}
            onClose={() => {
              hidePanel(panelId);
              if (panelId === 'comments') {
                setPendingCommentPin(null);
                setMode('select');
              }
            }}
          >
            {panelId === 'comments' ? (
              <BoardCommentsPanel
                comments={snapshot.comments ?? []}
                pendingPin={pendingCommentPin}
                selectedObjectId={selectedIds.length === 1 ? selectedIds[0] : undefined}
                addCommentMode={mode === 'addComment'}
                highlightedCommentId={highlightedCommentId}
                onChange={handleCommentsChange}
              />
            ) : (
              <BoardAttachmentsPanel {...attachmentsPanelProps} />
            )}
          </BoardPanelShell>
        );
      })}

      {panelPrefs.drawOptions.visible &&
      panelPrefs.drawOptions.mode !== 'docked' &&
      (mode === 'draw' || mode === 'addVector') ? (
        <BoardPanelShell
          id="board-draw-options"
          boardId={board.id}
          title={t('boards.draw.options', 'Draw options')}
          visible
          mode={panelPrefs.drawOptions.mode}
          side="left"
          defaultWidth={BOARD_PANEL_REGISTRY.drawOptions.defaultWidth}
          supportsPopout={false}
          onModeChange={(mode) => setPanelMode('drawOptions', mode)}
          onClose={() => hidePanel('drawOptions')}
        >
          <DrawToolOptions
            settings={drawSettings}
            onChange={(p) => setDrawSettings((s) => ({ ...s, ...p }))}
            className="border-0"
          />
        </BoardPanelShell>
      ) : null}
    </div>
    </BoardEyedropperProvider>
    </BoardEditorProvider>
  );
}
