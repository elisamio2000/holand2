'use client';

import { memo, useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import cn from '@core/utils/class-names';
import type {
  BoardDrawSettings,
  BoardMode,
  BoardObject,
  BoardObjectBase,
  BoardSnapshot,
  BoardViewBox,
  BoardNodeObject,
  BoardConnectorObject,
  BoardMediaObject,
  BoardStickyObject,
  BoardFrameObject,
  BoardInkStroke,
  BoardNodeRole,
  BoardVectorObject,
  CornerRadii,
} from '../lib/board-types';
import { BOARD_GRID_SIZE, snapCoord } from '../lib/canvas/snap';
import { expandDragIds, getNodeAnchorPeers } from '../lib/canvas/node-magnet';
import { GridBackground } from '../lib/canvas/grid-background';
import { BackgroundLayers } from './components/background-layers';
import { filterInkStrokesInView, filterSpatialObjectsInView } from '../lib/canvas/viewport-cull';
import { boardPerfMark } from '../lib/board-performance';
import type { GridPreferences } from '../lib/canvas/grid-preference';
import {
  anchorOnSide,
  anchorTowardPoint,
  boundsOfObject,
  isConnectorSpatial,
} from '../lib/canvas/connector-routing';
import {
  createConnectSession,
  resolveConnectTargetId,
  updateConnectCursor,
  type ConnectSession,
} from '../lib/canvas/connect-session';
import {
  computeDragPreview,
  createDragSession,
  dragPreviewToUpdates,
  type DragSession,
} from '../lib/canvas/drag-session';
import {
  computeResizePreview,
  createResizeSession,
  getObjectMinSize,
  MIN_OBJECT_HEIGHT,
  MIN_OBJECT_WIDTH,
  type ResizeCorner,
  type ResizeSession,
} from '../lib/canvas/resize-session';
import {
  angleFromCenter,
  computeRotationPreview,
  createRotationSession,
  type RotationSession,
} from '../lib/canvas/rotation-session';
import {
  rotateGroupMembers,
  scaleGroupMembers,
  unionSpatialBounds,
  type SpatialMember,
} from '../lib/canvas/group-transform';
import { appendInkPoint, createInkStroke, inkStrokeStyle, strokeToPathD } from '../lib/ink/ink-model';
import { eraseStrokesAtPoint } from '../lib/ink/ink-hit-test';
import { StickyObjectView } from './objects/sticky-object';
import { MediaObjectView } from './objects/media-object';
import { NodeObjectView } from './objects/node-object';
import { VectorObjectView } from './objects/vector-object';
import { ConnectorObjectView } from './objects/connector-object';
import { ObjectTransformHandles } from './object-transform-handles';
import { CornerRadiusHandles } from './corner-radius-handles';
import { PathEditHandles } from './path-edit-handles';
import { buildNormalizedPathFromWorldPoints, simplifyPath, type PathPoint } from '../lib/canvas/path-editor';

function screenToWorld(clientX: number, clientY: number, svg: SVGSVGElement, vb: BoardViewBox) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: vb.x, y: vb.y };
  const t = pt.matrixTransform(ctm.inverse());
  return { x: t.x, y: t.y };
}

function isSpatialObject(obj: BoardObject): obj is BoardObject & BoardObjectBase {
  return obj.type !== 'connector' && 'x' in obj && 'width' in obj;
}

const PLACEMENT_MODES = new Set<BoardMode>(['addSticky', 'addNode', 'addImage', 'addComment']);

function isCanvasPlacementTarget(target: EventTarget | null, svg: SVGSVGElement | null): boolean {
  if (!svg) return false;
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest('[data-board-object],[data-board-ink],[data-board-connect-port]')) return false;
  if (el.closest('[data-board-transform-handles]')) return false;
  return el === svg || el.classList.contains('board-canvas-bg') || (el as SVGElement).ownerSVGElement === svg;
}

export interface ObjectPositionUpdate {
  id: string;
  x: number;
  y: number;
}

export interface ObjectResizeUpdate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectTransformPatch {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

const GROUP_TRANSFORM_TYPES = new Set(['sticky', 'media', 'frame', 'node', 'vector']);

export interface FrameCreateRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardCanvasHandle {
  getEffectiveSnapshot: () => BoardSnapshot;
}

export interface BoardCanvasProps {
  snapshot: BoardSnapshot;
  mode: BoardMode;
  selectedIds: string[];
  selectedInkIds: string[];
  edgeSourceId: string | null;
  drawSettings: BoardDrawSettings;
  snapToGrid: boolean;
  gridPreferences: GridPreferences;
  readOnly?: boolean;
  panHoldActive?: boolean;
  hiddenNodeRoles?: BoardNodeRole[];
  onViewBoxChange: (vb: BoardViewBox) => void;
  onSelect: (ids: string[], append?: boolean) => void;
  onSelectInk: (ids: string[]) => void;
  onObjectsDragEnd: (updates: ObjectPositionUpdate[]) => void;
  onObjectResizeEnd: (update: ObjectResizeUpdate) => void;
  onObjectRotationEnd?: (id: string, rotation: number) => void;
  onBulkTransformEnd?: (patches: ObjectTransformPatch[]) => void;
  onFrameCreate?: (rect: FrameCreateRect) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStickyTextChange: (id: string, text: string) => void;
  onStickyTextFocus?: (id: string) => void;
  onStickyTextBlur?: () => void;
  onStickyStrokesChange: (id: string, strokes: BoardStickyObject['inkStrokes']) => void;
  onStickyInkRegionChange?: (id: string, region: BoardStickyObject['inkRegion']) => void;
  onConnectEnd?: (sourceId: string, targetId: string) => void;
  onConnectorBendChange?: (connectorId: string, bend: { x: number; y: number }) => void;
  onCanvasClick: (x: number, y: number) => void;
  onCommentPinClick?: (commentId: string) => void;
  onOpenMediaPreview?: (obj: BoardMediaObject) => void;
  onInkStrokeComplete: (stroke: BoardInkStroke) => void;
  onInkStrokesReplace: (strokes: BoardInkStroke[]) => void;
  onContextMenu?: (e: React.MouseEvent, world: { worldX: number; worldY: number }) => void;
  onMarqueeSelect?: (rect: { x: number; y: number; width: number; height: number }, append: boolean) => void;
  onCornerRadiiChange?: (id: string, cornerRadii: CornerRadii) => void;
  onVectorDrawComplete?: (result: {
    pathD: string;
    bbox: { x: number; y: number; width: number; height: number };
    fill: string;
  }) => void;
  onPathGeometryChange?: (
    id: string,
    patch: { pathD: string; x?: number; y?: number; width?: number; height?: number }
  ) => void;
  /** Drop from attachment library / bar (data: application/x-board-attachment = library ref id) */
  onAttachmentDrop?: (attachmentRefId: string, world: { x: number; y: number }) => void;
  className?: string;
}

export const BoardCanvas = forwardRef<BoardCanvasHandle, BoardCanvasProps>(function BoardCanvas(
  {
  snapshot,
  mode,
  selectedIds,
  selectedInkIds,
  edgeSourceId,
  drawSettings,
  snapToGrid,
  gridPreferences,
  readOnly = false,
  panHoldActive = false,
  hiddenNodeRoles = [],
  onViewBoxChange,
  onSelect,
  onSelectInk,
  onObjectsDragEnd,
  onObjectResizeEnd,
  onObjectRotationEnd,
  onBulkTransformEnd,
  onFrameCreate,
  onDragStart,
  onDragEnd,
  onStickyTextChange,
  onStickyTextFocus,
  onStickyTextBlur,
  onStickyStrokesChange,
  onStickyInkRegionChange,
  onConnectEnd,
  onConnectorBendChange,
  onCanvasClick,
  onCommentPinClick,
  onOpenMediaPreview,
  onInkStrokeComplete,
  onInkStrokesReplace,
  onContextMenu,
  onMarqueeSelect,
  onCornerRadiiChange,
  onVectorDrawComplete,
  onPathGeometryChange,
  onAttachmentDrop,
  className,
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; vb: BoardViewBox } | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const rotationSessionRef = useRef<RotationSession | null>(null);
  const [rotationPreview, setRotationPreview] = useState<{ id: string; rotation: number } | null>(null);
  const frameDragRef = useRef<{ x: number; y: number } | null>(null);
  const [framePreview, setFramePreview] = useState<FrameCreateRect | null>(null);
  const [dragPreview, setDragPreview] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [resizePreview, setResizePreview] = useState<ObjectResizeUpdate | null>(null);
  const [groupTransformPreview, setGroupTransformPreview] = useState<Map<string, SpatialMember> | null>(
    null
  );
  const groupResizeSessionRef = useRef<{
    corner: ResizeCorner;
    pointerStartX: number;
    pointerStartY: number;
    initialBounds: { x: number; y: number; width: number; height: number };
    members: SpatialMember[];
  } | null>(null);
  const groupRotationSessionRef = useRef<{
    cx: number;
    cy: number;
    members: SpatialMember[];
    startAngle: number;
  } | null>(null);
  const inkRef = useRef<BoardInkStroke | null>(null);
  const vectorDrawRef = useRef<PathPoint[] | null>(null);
  const [liveVectorPath, setLiveVectorPath] = useState<string | null>(null);
  const [liveInk, setLiveInk] = useState<BoardInkStroke | null>(null);
  const rafRef = useRef<number | null>(null);
  const marqueeRef = useRef<{ x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const connectSessionRef = useRef<ConnectSession | null>(null);
  const [connectPreview, setConnectPreview] = useState<ConnectSession | null>(null);

  const vb = snapshot.viewBox;
  const showConnectPorts = mode === 'addEdge' && !readOnly;
  const snap = useCallback((v: number) => snapCoord(v, snapToGrid, BOARD_GRID_SIZE), [snapToGrid]);

  const spatialPositions = useMemo(
    () =>
      snapshot.objects
        .filter(isSpatialObject)
        .map((o) => ({ id: o.id, x: o.x, y: o.y })),
    [snapshot.objects]
  );

  const spatialById = useMemo(() => {
    const m = new Map<string, BoardObject & BoardObjectBase>();
    for (const o of snapshot.objects) {
      if (isSpatialObject(o)) m.set(o.id, o);
    }
    return m;
  }, [snapshot.objects]);

  const sortedSpatial = useMemo(() => {
    return filterSpatialObjectsInView(snapshot.objects, vb)
      .filter((o) => o.type !== 'connector')
      .sort((a, b) => {
        const za = 'z' in a ? (a.z ?? 0) : 0;
        const zb = 'z' in b ? (b.z ?? 0) : 0;
        return za - zb;
      });
  }, [snapshot.objects, vb]);

  const visibleInkStrokes = useMemo(
    () => filterInkStrokesInView(snapshot.inkStrokes ?? [], vb),
    [snapshot.inkStrokes, vb]
  );

  const connectors = useMemo(
    () => snapshot.objects.filter((o) => o.type === 'connector'),
    [snapshot.objects]
  );

  const groupMemberIds = useMemo(() => {
    if (selectedIds.length < 2) return [] as string[];
    return selectedIds.filter((id) => {
      const o = snapshot.objects.find((x) => x.id === id);
      return o && isSpatialObject(o) && !o.locked && GROUP_TRANSFORM_TYPES.has(o.type);
    });
  }, [selectedIds, snapshot.objects]);

  const isGroupTransform = groupMemberIds.length >= 2;

  const getObjectRect = useCallback(
    (obj: BoardObject & BoardObjectBase) => {
      const groupPatch = groupTransformPreview?.get(obj.id);
      const dragPos = dragPreview?.get(obj.id);
      const resized =
        resizePreview?.id === obj.id
          ? resizePreview
          : null;
      return {
        x: groupPatch?.x ?? dragPos?.x ?? resized?.x ?? obj.x,
        y: groupPatch?.y ?? dragPos?.y ?? resized?.y ?? obj.y,
        width: groupPatch?.width ?? resized?.width ?? obj.width,
        height: groupPatch?.height ?? resized?.height ?? obj.height,
        rotation:
          groupPatch?.rotation ??
          (rotationPreview?.id === obj.id ? rotationPreview.rotation : (obj.rotation ?? 0)),
      };
    },
    [dragPreview, resizePreview, rotationPreview, groupTransformPreview]
  );

  useImperativeHandle(
    ref,
    () => ({
      getEffectiveSnapshot: (): BoardSnapshot => ({
        ...snapshot,
        objects: snapshot.objects.map((obj) => {
          if (!isSpatialObject(obj)) return obj;
          const rect = getObjectRect(obj);
          return {
            ...obj,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            rotation: rect.rotation,
          };
        }),
      }),
    }),
    [snapshot, getObjectRect]
  );

  const groupBounds = useMemo(() => {
    if (!isGroupTransform) return null;
    const members: SpatialMember[] = [];
    for (const id of groupMemberIds) {
      const o = snapshot.objects.find((x) => x.id === id);
      if (!o || !isSpatialObject(o)) continue;
      const rect = getObjectRect(o);
      members.push({
        id: o.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        rotation: rect.rotation,
      });
    }
    return unionSpatialBounds(members);
  }, [isGroupTransform, groupMemberIds, snapshot.objects, getObjectRect]);

  const isNodeDimmed = useCallback(
    (obj: BoardNodeObject) => hiddenNodeRoles.includes(obj.nodeRole),
    [hiddenNodeRoles]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      const nw = Math.min(Math.max(vb.width * factor, 200), 8000);
      const nh = nw * (vb.height / vb.width);
      const cx = vb.x + vb.width / 2;
      const cy = vb.y + vb.height / 2;
      onViewBoxChange({
        x: cx - nw / 2,
        y: cy - nh / 2,
        width: nw,
        height: nh,
      });
    },
    [vb, onViewBoxChange]
  );

  const finishInk = useCallback(() => {
    if (inkRef.current && inkRef.current.points.length >= 2) {
      onInkStrokeComplete(inkRef.current);
    }
    inkRef.current = null;
    setLiveInk(null);
  }, [onInkStrokeComplete]);

  const capturePointer = (e: React.PointerEvent) => {
    window.getSelection()?.removeAllRanges();
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const clearTextSelection = () => {
    window.getSelection()?.removeAllRanges();
  };

  const getSpatialById = useCallback(
    (id: string) => {
      const obj = snapshot.objects.find((o) => 'id' in o && o.id === id);
      if (!obj || !isSpatialObject(obj)) return null;
      const rect = getObjectRect(obj);
      return { ...obj, ...rect };
    },
    [snapshot.objects, getObjectRect]
  );

  const liveSpatialById = useMemo(() => {
    const m = new Map<string, BoardObject & BoardObjectBase>();
    for (const o of snapshot.objects) {
      if (!isSpatialObject(o)) continue;
      const live = getSpatialById(o.id);
      if (live) m.set(o.id, live);
    }
    return m;
  }, [snapshot.objects, getSpatialById]);

  const startConnect = (sourceId: string, e: React.PointerEvent, port?: 'top' | 'bottom') => {
    if (readOnly || mode !== 'addEdge') return;
    const svg = svgRef.current;
    if (!svg) return;
    e.stopPropagation();
    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
    connectSessionRef.current = createConnectSession(sourceId, pt.x, pt.y, port);
    setConnectPreview(connectSessionRef.current);
    svg.setPointerCapture(e.pointerId);
  };

  const finishConnectSession = (e: React.PointerEvent) => {
    const session = connectSessionRef.current;
    if (!session) return;
    const svg = svgRef.current;
    connectSessionRef.current = null;
    setConnectPreview(null);

    if (!svg) return;
    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    const targetId = resolveConnectTargetId(targetEl);

    if (session.moved && targetId && targetId !== session.sourceId) {
      onConnectEnd?.(session.sourceId, targetId);
      return;
    }
    if (!session.moved) {
      onSelect([session.sourceId], e.shiftKey);
      onSelectInk([]);
    }
  };

  const startDrag = (id: string, e: React.PointerEvent) => {
    if (readOnly || mode !== 'select') return;
    const svg = svgRef.current;
    if (!svg) return;
    const obj = snapshot.objects.find((o) => 'id' in o && o.id === id);
    if (!obj || !isSpatialObject(obj) || obj.locked) return;

    marqueeRef.current = null;
    setMarquee(null);

    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
    const dragIds = expandDragIds(id, selectedIds, snapshot.objects);
    dragSessionRef.current = createDragSession(
      id,
      pt.x,
      pt.y,
      obj.x,
      obj.y,
      dragIds,
      spatialPositions
    );
    setDragPreview(computeDragPreview(dragSessionRef.current, pt.x, pt.y, snap));
    capturePointer(e);
    onDragStart();
  };

  const startResize = (id: string, e: React.PointerEvent, corner: ResizeCorner = 'se') => {
    if (readOnly || mode !== 'select') return;
    const svg = svgRef.current;
    if (!svg) return;
    const obj = snapshot.objects.find((o) => o.id === id);
    if (!obj || !isSpatialObject(obj) || obj.locked) return;
    if (!['sticky', 'media', 'frame', 'node'].includes(obj.type)) return;

    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
    resizeSessionRef.current = createResizeSession(
      id,
      obj.x,
      obj.y,
      obj.width,
      obj.height,
      pt.x,
      pt.y,
      corner
    );
    setResizePreview({ id, x: obj.x, y: obj.y, width: obj.width, height: obj.height });
    capturePointer(e);
    onDragStart();
  };

  const startRotate = (id: string, e: React.PointerEvent) => {
    if (readOnly || mode !== 'select' || !onObjectRotationEnd) return;
    const svg = svgRef.current;
    if (!svg) return;
    const obj = snapshot.objects.find((o) => o.id === id);
    if (!obj || !isSpatialObject(obj) || obj.locked) return;
    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    rotationSessionRef.current = createRotationSession(
      id,
      cx,
      cy,
      obj.rotation ?? 0,
      pt.x,
      pt.y
    );
    capturePointer(e);
    onDragStart();
  };

  const collectGroupMembers = (): SpatialMember[] => {
    const members: SpatialMember[] = [];
    for (const id of groupMemberIds) {
      const o = snapshot.objects.find((x) => x.id === id);
      if (!o || !isSpatialObject(o)) continue;
      members.push({
        id: o.id,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation ?? 0,
      });
    }
    return members;
  };

  const startGroupResize = (e: React.PointerEvent, corner: ResizeCorner) => {
    if (readOnly || mode !== 'select' || !isGroupTransform || !groupBounds) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
    groupResizeSessionRef.current = {
      corner,
      pointerStartX: pt.x,
      pointerStartY: pt.y,
      initialBounds: { ...groupBounds },
      members: collectGroupMembers(),
    };
    capturePointer(e);
    onDragStart();
  };

  const startGroupRotate = (e: React.PointerEvent) => {
    if (readOnly || mode !== 'select' || !isGroupTransform || !groupBounds || !onBulkTransformEnd) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
    const cx = groupBounds.x + groupBounds.width / 2;
    const cy = groupBounds.y + groupBounds.height / 2;
    groupRotationSessionRef.current = {
      cx,
      cy,
      members: collectGroupMembers(),
      startAngle: angleFromCenter(cx, cy, pt.x, pt.y),
    };
    capturePointer(e);
    onDragStart();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    clearTextSelection();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);

    if (mode === 'pan' || panHoldActive || e.button === 1 || (e.button === 0 && e.shiftKey && mode === 'select')) {
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, vb: { ...vb } };
      capturePointer(e);
      return;
    }

    if (mode === 'addVector' && e.button === 0 && isCanvasPlacementTarget(e.target, svg)) {
      vectorDrawRef.current = [pt];
      setLiveVectorPath(`M ${pt.x} ${pt.y}`);
      capturePointer(e);
      return;
    }

    if (mode === 'draw' && e.button === 0) {
      if (drawSettings.tool === 'eraser') {
        const next = eraseStrokesAtPoint(snapshot.inkStrokes ?? [], pt.x, pt.y, drawSettings.width);
        if (next.length !== (snapshot.inkStrokes ?? []).length) onInkStrokesReplace(next);
        inkRef.current = { id: 'eraser-live', color: '', width: drawSettings.width, tool: 'pen', points: [pt] };
      } else {
        const stroke = createInkStroke(drawSettings, pt);
        inkRef.current = stroke;
        setLiveInk(stroke);
      }
      capturePointer(e);
      return;
    }

    if (mode === 'addFrame' && e.button === 0 && (e.target === svg || (e.target as Element).classList.contains('board-canvas-bg'))) {
      frameDragRef.current = pt;
      setFramePreview({ x: pt.x, y: pt.y, width: 0, height: 0 });
      capturePointer(e);
      return;
    }

    if (
      e.button === 0 &&
      isCanvasPlacementTarget(e.target, svg) &&
      (PLACEMENT_MODES.has(mode) || mode === 'select')
    ) {
      if (mode === 'select') {
        marqueeRef.current = pt;
        setMarquee({ x: pt.x, y: pt.y, width: 0, height: 0 });
        onSelect([], false);
        onSelectInk([]);
        capturePointer(e);
        return;
      }
      onSelect([], false);
      onSelectInk([]);
      onCanvasClick(pt.x, pt.y);
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;

    if (panning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const scale = panStart.current.vb.width / (svg.clientWidth || 1);
      onViewBoxChange({
        ...panStart.current.vb,
        x: panStart.current.vb.x - dx * scale,
        y: panStart.current.vb.y - dy * scale,
      });
      return;
    }

    const pt = screenToWorld(e.clientX, e.clientY, svg, vb);

    if (vectorDrawRef.current && mode === 'addVector') {
      const last = vectorDrawRef.current[vectorDrawRef.current.length - 1];
      if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 2) {
        vectorDrawRef.current = [...vectorDrawRef.current, pt];
        const d = vectorDrawRef.current.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        setLiveVectorPath(d);
      }
      return;
    }

    if (inkRef.current && mode === 'draw') {
      if (drawSettings.tool === 'eraser') {
        const next = eraseStrokesAtPoint(snapshot.inkStrokes ?? [], pt.x, pt.y, drawSettings.width);
        if (next.length !== (snapshot.inkStrokes ?? []).length) onInkStrokesReplace(next);
      } else if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (!inkRef.current) return;
          inkRef.current = appendInkPoint(inkRef.current, pt);
          setLiveInk({ ...inkRef.current });
        });
      }
      return;
    }

    if (groupRotationSessionRef.current) {
      const session = groupRotationSessionRef.current;
      const current = angleFromCenter(session.cx, session.cy, pt.x, pt.y);
      const delta = current - session.startAngle;
      const preview = rotateGroupMembers(session.members, session.cx, session.cy, delta);
      setGroupTransformPreview(preview);
      return;
    }

    if (groupResizeSessionRef.current) {
      const session = groupResizeSessionRef.current;
      const resizeSession = createResizeSession(
        '__group__',
        session.initialBounds.x,
        session.initialBounds.y,
        session.initialBounds.width,
        session.initialBounds.height,
        session.pointerStartX,
        session.pointerStartY,
        session.corner
      );
      const newBounds = computeResizePreview(
        resizeSession,
        pt.x,
        pt.y,
        snap,
        MIN_OBJECT_WIDTH,
        MIN_OBJECT_HEIGHT
      );
      const preview = scaleGroupMembers(session.members, session.initialBounds, newBounds);
      setGroupTransformPreview(preview);
      return;
    }

    if (rotationSessionRef.current) {
      const rot = computeRotationPreview(rotationSessionRef.current, pt.x, pt.y);
      setRotationPreview({ id: rotationSessionRef.current.id, rotation: rot });
      return;
    }

    if (resizeSessionRef.current) {
      const obj = snapshot.objects.find((o) => o.id === resizeSessionRef.current!.id);
      const mins = getObjectMinSize(obj?.type ?? 'sticky');
      const preview = computeResizePreview(
        resizeSessionRef.current,
        pt.x,
        pt.y,
        snap,
        mins.minWidth,
        mins.minHeight
      );
      setResizePreview({ id: resizeSessionRef.current.id, ...preview });
      return;
    }

    if (dragSessionRef.current) {
      setDragPreview(computeDragPreview(dragSessionRef.current, pt.x, pt.y, snap));
      return;
    }

    if (connectSessionRef.current) {
      const next = updateConnectCursor(connectSessionRef.current, pt.x, pt.y);
      connectSessionRef.current = next;
      setConnectPreview(next);
      return;
    }

    if (frameDragRef.current && mode === 'addFrame') {
      const sx = frameDragRef.current.x;
      const sy = frameDragRef.current.y;
      setFramePreview({
        x: Math.min(sx, pt.x),
        y: Math.min(sy, pt.y),
        width: Math.abs(pt.x - sx),
        height: Math.abs(pt.y - sy),
      });
      return;
    }

    if (marqueeRef.current && mode === 'select') {
      const sx = marqueeRef.current.x;
      const sy = marqueeRef.current.y;
      setMarquee({
        x: Math.min(sx, pt.x),
        y: Math.min(sy, pt.y),
        width: Math.abs(pt.x - sx),
        height: Math.abs(pt.y - sy),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (vectorDrawRef.current && mode === 'addVector') {
      const simplified = simplifyPath(vectorDrawRef.current, 3);
      if (simplified.length >= 3 && onVectorDrawComplete) {
        const { pathD, bbox } = buildNormalizedPathFromWorldPoints(simplified);
        if (pathD) {
          onVectorDrawComplete({ pathD, bbox, fill: drawSettings.color });
        }
      }
      vectorDrawRef.current = null;
      setLiveVectorPath(null);
    }

    if (inkRef.current && mode === 'draw') {
      if (drawSettings.tool !== 'eraser') finishInk();
      else inkRef.current = null;
    }

    if (marqueeRef.current && marquee) {
      if (marquee.width > 4 || marquee.height > 4) {
        onMarqueeSelect?.(marquee, e.shiftKey);
      } else if (mode !== 'select') {
        const svg = svgRef.current;
        if (svg) {
          const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
          onCanvasClick(pt.x, pt.y);
        }
      }
      marqueeRef.current = null;
      setMarquee(null);
    }

    if (frameDragRef.current && framePreview) {
      if (framePreview.width > 20 && framePreview.height > 20) {
        onFrameCreate?.(framePreview);
      }
      frameDragRef.current = null;
      setFramePreview(null);
    }

    if (groupRotationSessionRef.current && groupTransformPreview) {
      const patches: ObjectTransformPatch[] = [...groupTransformPreview.values()].map((m) => ({
        id: m.id,
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
        rotation: m.rotation,
      }));
      onBulkTransformEnd?.(patches);
      groupRotationSessionRef.current = null;
      setGroupTransformPreview(null);
      onDragEnd();
    }

    if (groupResizeSessionRef.current && groupTransformPreview) {
      const patches: ObjectTransformPatch[] = [...groupTransformPreview.values()].map((m) => ({
        id: m.id,
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
        rotation: m.rotation,
      }));
      onBulkTransformEnd?.(patches);
      groupResizeSessionRef.current = null;
      setGroupTransformPreview(null);
      onDragEnd();
    }

    if (rotationSessionRef.current && rotationPreview) {
      onObjectRotationEnd?.(rotationPreview.id, rotationPreview.rotation);
      rotationSessionRef.current = null;
      setRotationPreview(null);
      onDragEnd();
    }

    if (resizeSessionRef.current && resizePreview) {
      onObjectResizeEnd(resizePreview);
      resizeSessionRef.current = null;
      setResizePreview(null);
      onDragEnd();
    }

    if (dragSessionRef.current && dragPreview) {
      onObjectsDragEnd(dragPreviewToUpdates(dragPreview));
      dragSessionRef.current = null;
      setDragPreview(null);
      onDragEnd();
    }

    if (connectSessionRef.current) {
      finishConnectSession(e);
    }

    setPanning(false);
    panStart.current = null;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const allStrokes = useMemo(() => {
    const strokes = [...visibleInkStrokes];
    if (liveInk) strokes.push(liveInk);
    return strokes;
  }, [visibleInkStrokes, liveInk]);

  const renderTransformHandles = (obj: BoardObject & BoardObjectBase) => {
    if (isGroupTransform) return null;
    if (mode !== 'select' || !selectedIds.includes(obj.id) || obj.locked) return null;
    if (!GROUP_TRANSFORM_TYPES.has(obj.type)) return null;
    const rect = getObjectRect(obj);
    return (
      <ObjectTransformHandles
        object={{ ...obj, ...rect }}
        onResizeStart={(ev, corner) => startResize(obj.id, ev, corner)}
        onRotateStart={onObjectRotationEnd ? (ev) => startRotate(obj.id, ev) : undefined}
      />
    );
  };

  const renderGroupTransformHandles = () => {
    if (!isGroupTransform || !groupBounds || mode !== 'select') return null;
    const pseudo = {
      id: '__group__',
      x: groupBounds.x,
      y: groupBounds.y,
      width: groupBounds.width,
      height: groupBounds.height,
    };
    return (
      <ObjectTransformHandles
        object={pseudo}
        onResizeStart={(ev, corner) => startGroupResize(ev, corner)}
        onRotateStart={onBulkTransformEnd ? (ev) => startGroupRotate(ev) : undefined}
      />
    );
  };

  const connectHandlers = {
    showConnectPorts,
    onConnectPortPointerDown: (ev: React.PointerEvent, port: 'top' | 'bottom', id: string) =>
      startConnect(id, ev, port),
    onConnectBodyPointerDown: (ev: React.PointerEvent, id: string) => startConnect(id, ev),
  };

  const ghostConnectLine = useMemo(() => {
    if (!connectPreview) return null;
    const source = getSpatialById(connectPreview.sourceId);
    if (!source || !isConnectorSpatial(source)) return null;
    const bounds = boundsOfObject(source);
    const from =
      connectPreview.sourcePort === 'top'
        ? anchorOnSide(bounds, 'top')
        : connectPreview.sourcePort === 'bottom'
          ? anchorOnSide(bounds, 'bottom')
          : anchorTowardPoint(bounds, connectPreview.cursorX, connectPreview.cursorY);
    return { x1: from.x, y1: from.y, x2: connectPreview.cursorX, y2: connectPreview.cursorY };
  }, [connectPreview, getSpatialById]);

  const onAttachmentDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onAttachmentDrop || readOnly) return;
      if (e.dataTransfer.types.includes('application/x-board-attachment')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [onAttachmentDrop, readOnly]
  );

  const onAttachmentDropHandler = useCallback(
    (e: React.DragEvent) => {
      if (!onAttachmentDrop || readOnly) return;
      const refId = e.dataTransfer.getData('application/x-board-attachment');
      if (!refId) return;
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
      onAttachmentDrop(refId, { x: pt.x, y: pt.y });
    },
    [onAttachmentDrop, readOnly, vb]
  );

  return (
    <div
      data-board-grid-host
      className={cn(
        'relative h-full w-full overflow-hidden select-none',
        (mode === 'pan' || panHoldActive) && 'cursor-grab',
        (mode === 'draw' || mode === 'addVector' || PLACEMENT_MODES.has(mode)) && 'cursor-crosshair',
        className
      )}
      onDragOver={onAttachmentDragOver}
      onDrop={onAttachmentDropHandler}
    >
      <GridBackground
        viewBox={vb}
        preferences={gridPreferences}
        snapToGrid={snapToGrid}
      />
      <svg
        ref={svgRef}
        className="relative z-[1] h-full w-full touch-none select-none bg-transparent"
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => {
          const svg = svgRef.current;
          if (!svg || !onContextMenu) return;
          e.preventDefault();
          const pt = screenToWorld(e.clientX, e.clientY, svg, vb);
          onContextMenu(e, { worldX: pt.x, worldY: pt.y });
        }}
      >
        {(snapshot.backgroundLayers ?? []).length > 0 ? (
          <BackgroundLayers layers={snapshot.backgroundLayers ?? []} viewBox={vb} />
        ) : null}
        <defs>
          <marker id="board-arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
          </marker>
          <marker id="board-arrow-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
          </marker>
        </defs>
        <rect className="board-canvas-bg fill-transparent" x={vb.x} y={vb.y} width={vb.width} height={vb.height} />
        {ghostConnectLine ? (
          <line
            x1={ghostConnectLine.x1}
            y1={ghostConnectLine.y1}
            x2={ghostConnectLine.x2}
            y2={ghostConnectLine.y2}
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            opacity={0.75}
            pointerEvents="none"
          />
        ) : null}
        {(allStrokes).map((stroke) => {
          const d = strokeToPathD(stroke);
          if (!d) return null;
          const style = inkStrokeStyle(stroke);
          const selected = selectedInkIds.includes(stroke.id);
          return (
            <path
              key={stroke.id}
              data-board-ink={stroke.id}
              d={d}
              fill="none"
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={style.opacity}
              style={selected ? { filter: 'drop-shadow(0 0 2px #3b82f6)' } : undefined}
              onPointerDown={(ev) => {
                if (mode === 'select') {
                  ev.stopPropagation();
                  onSelectInk([stroke.id]);
                  onSelect([], false);
                }
              }}
            />
          );
        })}
        {sortedSpatial.map((obj) => {
          if (!isSpatialObject(obj)) return null;
          const rect = getObjectRect(obj);
          const displayObj = { ...obj, ...rect };

          if (obj.type === 'node') {
            return (
              <g key={obj.id} data-board-object={obj.id} data-board-type="node">
                <NodeObjectView
                  object={displayObj as BoardNodeObject}
                  selected={selectedIds.includes(obj.id) || edgeSourceId === obj.id}
                  dimmed={isNodeDimmed(obj as BoardNodeObject)}
                  anchorPeerCount={
                    selectedIds.includes(obj.id)
                      ? getNodeAnchorPeers(snapshot.objects, obj.id).length
                      : 0
                  }
                  onSelect={(ev) => {
                    ev.stopPropagation();
                    onSelect([obj.id], ev.shiftKey);
                    onSelectInk([]);
                  }}
                  onDragStart={(ev) => startDrag(obj.id, ev)}
                  showConnectPorts={connectHandlers.showConnectPorts}
                  onConnectPortPointerDown={(ev, port) =>
                    connectHandlers.onConnectPortPointerDown(ev, port, obj.id)
                  }
                  onConnectBodyPointerDown={(ev) => connectHandlers.onConnectBodyPointerDown(ev, obj.id)}
                />
                {renderTransformHandles(obj)}
                {selectedIds.length === 1 &&
                selectedIds[0] === obj.id &&
                mode === 'select' &&
                onCornerRadiiChange ? (
                  <CornerRadiusHandles
                    object={displayObj as BoardNodeObject}
                    readOnly={readOnly}
                    onCornerRadiiChange={(cornerRadii) => onCornerRadiiChange(obj.id, cornerRadii)}
                  />
                ) : null}
              </g>
            );
          }
          if (obj.type === 'vector') {
            return (
              <g key={obj.id} data-board-object={obj.id} data-board-type="vector">
                <VectorObjectView
                  object={displayObj as BoardVectorObject}
                  selected={selectedIds.includes(obj.id)}
                  onSelect={(ev) => {
                    ev.stopPropagation();
                    onSelect([obj.id], ev.shiftKey);
                    onSelectInk([]);
                  }}
                  onDragStart={(ev) => startDrag(obj.id, ev)}
                />
                {renderTransformHandles(obj)}
                {mode === 'editPath' &&
                selectedIds.includes(obj.id) &&
                onPathGeometryChange ? (
                  <PathEditHandles
                    object={displayObj as BoardVectorObject}
                    readOnly={readOnly}
                    onPathChange={(pathD, bbox) =>
                      onPathGeometryChange(obj.id, {
                        pathD,
                        ...(bbox ?? {}),
                      })
                    }
                  />
                ) : null}
              </g>
            );
          }
          if (obj.type === 'sticky') {
            return (
              <g key={obj.id} data-board-object={obj.id} data-board-type="sticky">
                <StickyObjectView
                  object={displayObj as BoardStickyObject}
                  selected={selectedIds.includes(obj.id)}
                  onSelect={(ev) => {
                    ev.stopPropagation();
                    onSelect([obj.id], ev.shiftKey);
                    onSelectInk([]);
                  }}
                  onDragStart={(ev) => startDrag(obj.id, ev)}
                  onTextChange={(text) => onStickyTextChange(obj.id, text)}
                  onTextFocus={() => onStickyTextFocus?.(obj.id)}
                  onTextBlur={() => onStickyTextBlur?.()}
                  onStrokesChange={(strokes) => onStickyStrokesChange(obj.id, strokes)}
                  onInkRegionChange={
                    onStickyInkRegionChange
                      ? (region) => onStickyInkRegionChange(obj.id, region)
                      : undefined
                  }
                  showConnectPorts={connectHandlers.showConnectPorts}
                  onConnectPortPointerDown={(ev, port) =>
                    connectHandlers.onConnectPortPointerDown(ev, port, obj.id)
                  }
                  onConnectBodyPointerDown={(ev) => connectHandlers.onConnectBodyPointerDown(ev, obj.id)}
                />
                {renderTransformHandles(obj)}
              </g>
            );
          }
          if (obj.type === 'media') {
            return (
              <g key={obj.id} data-board-object={obj.id} data-board-type="media">
                <MediaObjectView
                  object={displayObj as BoardMediaObject}
                  selected={selectedIds.includes(obj.id)}
                  onSelect={(ev) => {
                    ev.stopPropagation();
                    onSelect([obj.id], ev.shiftKey);
                    onSelectInk([]);
                  }}
                  onDragStart={(ev) => startDrag(obj.id, ev)}
                  onOpenPreview={() => onOpenMediaPreview?.(obj as BoardMediaObject)}
                  showConnectPorts={connectHandlers.showConnectPorts}
                  onConnectPortPointerDown={(ev, port) =>
                    connectHandlers.onConnectPortPointerDown(ev, port, obj.id)
                  }
                  onConnectBodyPointerDown={(ev) => connectHandlers.onConnectBodyPointerDown(ev, obj.id)}
                />
                {renderTransformHandles(obj)}
              </g>
            );
          }
          if (obj.type === 'frame') {
            return (
              <g key={obj.id} data-board-object={obj.id} data-board-type="frame">
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill={(obj as BoardFrameObject).background ?? 'rgba(148,163,184,0.15)'}
                  stroke={selectedIds.includes(obj.id) ? 'var(--primary-default)' : '#94a3b8'}
                  strokeWidth={selectedIds.includes(obj.id) ? 2 : 1}
                  rx={8}
                  onPointerDown={(ev) => {
                    if (obj.locked) {
                      onSelect([obj.id], ev.shiftKey);
                      return;
                    }
                    startDrag(obj.id, ev);
                    onSelect([obj.id], ev.shiftKey);
                    onSelectInk([]);
                  }}
                />
                <text
                  x={rect.x + 8}
                  y={rect.y + 16}
                  className="pointer-events-none fill-gray-600 text-[11px] font-medium"
                >
                  {(obj as BoardFrameObject).title}
                </text>
                {renderTransformHandles(obj)}
              </g>
            );
          }
          return null;
        })}
        {liveVectorPath ? (
          <path
            d={liveVectorPath}
            fill="rgba(99,102,241,0.15)"
            stroke="#6366f1"
            strokeWidth={2}
            pointerEvents="none"
          />
        ) : null}
        {connectors.map((obj) => {
          const src = liveSpatialById.get((obj as BoardConnectorObject).sourceId);
          const tgt = liveSpatialById.get((obj as BoardConnectorObject).targetId);
          const dimmed =
            (src?.type === 'node' && isNodeDimmed(src as BoardNodeObject)) ||
            (tgt?.type === 'node' && isNodeDimmed(tgt as BoardNodeObject));
          return (
          <ConnectorObjectView
            key={obj.id}
            connector={obj as BoardConnectorObject}
            spatialById={liveSpatialById}
            styleDefaults={snapshot.styleDefaults}
            dragPreview={dragPreview}
            selected={selectedIds.includes(obj.id)}
            readOnly={readOnly}
            dimmed={dimmed}
            onBendChange={onConnectorBendChange}
            onSelect={(ev) => {
              ev.stopPropagation();
              onSelect([obj.id], ev.shiftKey);
              onSelectInk([]);
            }}
          />
        );})}
        {renderGroupTransformHandles()}
        {framePreview ? (
          <rect
            x={framePreview.x}
            y={framePreview.y}
            width={framePreview.width}
            height={framePreview.height}
            fill="rgba(148,163,184,0.2)"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="6 3"
            pointerEvents="none"
          />
        ) : null}
        {marquee ? (
          <rect
            x={marquee.x}
            y={marquee.y}
            width={marquee.width}
            height={marquee.height}
            fill="rgba(59,130,246,0.1)"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        ) : null}
        {(snapshot.comments ?? []).map((c) => (
          <g
            key={c.id}
            transform={`translate(${c.x}, ${c.y})`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCommentPinClick?.(c.id);
            }}
          >
            <circle r={8} className="fill-amber-400 stroke-amber-600" strokeWidth={1} />
            <title>{c.text}</title>
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute bottom-2 end-2 rounded bg-white/80 px-2 py-1 text-[10px] text-gray-500 dark:bg-gray-900/80">
        {Math.round((1400 / vb.width) * 100)}%
        {snapToGrid ? ' · snap' : ''}
      </div>
    </div>
  );
});

export default memo(BoardCanvas);
