// ============================================
// User Boards — core types
// ============================================

import type { GraphFilter, GraphSettings } from '@/types/graph-explorer.types';

export type BoardPurpose = 'analysis' | 'mindmap' | 'collab' | 'free' | 'evidence';

export type BoardMode =
  | 'select'
  | 'pan'
  | 'addSticky'
  | 'addImage'
  | 'addNode'
  | 'addEdge'
  | 'addComment'
  | 'addFrame'
  | 'addVector'
  | 'editPath'
  | 'draw';

export type BoardEditorTab = 'canvas' | 'graph' | 'report' | 'present';

export interface BoardViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardObjectBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  opacity?: number;
  /** Longer annotation shown in inspector (separate from short label/text) */
  note?: string;
  attachedNodeId?: string;
  /** Offset from parent node origin when magnet-attached */
  attachOffsetX?: number;
  attachOffsetY?: number;
  /** Persistent group — members move together when any member is dragged */
  objectGroupId?: string;
  locked?: boolean;
  /** Rotation in degrees (spatial objects) */
  rotation?: number;
}

export type BoardStrokeStyle = 'solid' | 'dashed' | 'dotted';

export type BoardArrowDirection = 'none' | 'forward' | 'backward' | 'both';

export interface BoardStickyInkStroke {
  id: string;
  color: string;
  width: number;
  tool: 'pen' | 'highlighter' | 'eraser';
  opacity?: number;
  normalized?: boolean;
  points: { x: number; y: number }[];
}

/** Drawing region inside a sticky note body (below header). Coords are 0–1 fractions. */
export type StickyInkLayout = 'overlay' | 'wrap-start' | 'wrap-end' | 'block-below' | 'block-above';

export interface StickyInkRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  layout: StickyInkLayout;
}

export interface BoardStickyObject extends BoardObjectBase {
  type: 'sticky';
  text: string;
  color: string;
  inkStrokes?: BoardStickyInkStroke[];
  /** Ink drawing box placement; defaults to full note body. */
  inkRegion?: StickyInkRegion;
}

export interface BoardMediaObject extends BoardObjectBase {
  type: 'media';
  name: string;
  mime: string;
  blobKey?: string;
  artifactId?: string;
  /** Links canvas media to board attachment library entry */
  attachmentRefId?: string;
  thumbnail?: string;
  caption?: string;
}

export type BoardNodeRole =
  | 'person'
  | 'organization'
  | 'evidence'
  | 'topic'
  | 'question'
  | 'custom';

export type BoardNodeShape = 'rectangle' | 'rounded' | 'ellipse' | 'diamond';

/** Uniform radius or [topLeft, topRight, bottomRight, bottomLeft] in px (local space). */
export type CornerRadii = number | [number, number, number, number];

export interface BoardShapeGeometry {
  kind: 'preset' | 'path';
  preset?: BoardNodeShape;
  /** SVG path `d` in normalized 0–1 coords relative to object bbox */
  pathD?: string;
  cornerRadii?: CornerRadii;
}

export interface BoardNodeObject extends BoardObjectBase {
  type: 'node';
  label: string;
  description?: string;
  nodeRole: BoardNodeRole;
  nodeShape?: BoardNodeShape;
  /** Rich geometry (preferred over nodeShape when set) */
  geometry?: BoardShapeGeometry;
  color: string;
  /** When true (default), magnet-attached elements move with this node */
  magnetEnabled?: boolean;
  /** Other node IDs dragged together when this node moves (anchor link, not magnet) */
  linkedNodeIds?: string[];
}

export interface BoardConnectorObject {
  type: 'connector';
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  note?: string;
  color?: string;
  strokeWidth?: number;
  strokeStyle?: BoardStrokeStyle;
  opacity?: number;
  arrowDirection?: BoardArrowDirection;
  /** @deprecated prefer arrowDirection */
  arrowStart?: boolean;
  /** @deprecated prefer arrowDirection */
  arrowEnd?: boolean;
  /** straight | curved (default) | orthogonal (stepped) */
  routeStyle?: BoardConnectorRouteStyle;
  /** 0–1 curvature intensity for curved routes */
  curveStrength?: number;
  /** Pixel offset for orthogonal elbow tuning */
  bendOffset?: number;
  /** Pro: custom bend / control point in world coordinates */
  bendPoints?: { x: number; y: number }[];
  /** Semantic edge type — link connectors are auto-synced from anchor links */
  kind?: BoardConnectorKind;
}

export type BoardConnectorRouteStyle = 'straight' | 'curved' | 'orthogonal';

export type BoardConnectorKind = 'link' | 'flow' | 'reference';

export interface BoardFrameObject extends BoardObjectBase {
  type: 'frame';
  title: string;
  background?: string;
}

export interface BoardVectorObject extends BoardObjectBase {
  type: 'vector';
  geometry: BoardShapeGeometry;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
}

export interface BoardInkStroke {
  id: string;
  color: string;
  width: number;
  tool: 'pen' | 'highlighter' | 'eraser';
  opacity?: number;
  points: { x: number; y: number }[];
}

export type BoardInkTool = 'pen' | 'highlighter' | 'eraser';

export interface BoardDrawSettings {
  color: string;
  width: number;
  tool: BoardInkTool;
}

export const DEFAULT_DRAW_SETTINGS: BoardDrawSettings = {
  color: '#1e293b',
  width: 3,
  tool: 'pen',
};

export interface BoardCommentPin {
  id: string;
  x: number;
  y: number;
  objectId?: string;
  text: string;
  authorName?: string;
  createdAt: string;
  resolved?: boolean;
  replies?: BoardCommentReply[];
}

export interface BoardCommentReply {
  id: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

export type BoardAttachmentSource = 'upload' | 'system' | 'case' | 'link' | 'paste';

export type BoardAttachmentCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'other';

export interface BoardAttachmentRef {
  id: string;
  artifactId: string;
  name: string;
  /** @deprecated prefer mimeType */
  mime?: string;
  mimeType?: string;
  size?: number;
  source?: BoardAttachmentSource;
  addedAt: string;
  thumbnailUrl?: string;
  category?: BoardAttachmentCategory;
  /** When set, new placements magnet-spawn below this node */
  anchorNodeId?: string;
}

export type BoardBackgroundLayerType = 'color' | 'image' | 'artifact' | 'map';

export interface BoardBackgroundLayerBase {
  id: string;
  type: BoardBackgroundLayerType;
  opacity: number;
  locked?: boolean;
  zIndex: number;
}

export interface BoardBackgroundColorLayer extends BoardBackgroundLayerBase {
  type: 'color';
  color: string;
}

export interface BoardBackgroundImageLayer extends BoardBackgroundLayerBase {
  type: 'image';
  url: string;
  fit?: 'cover' | 'contain' | 'tile';
}

export interface BoardBackgroundArtifactLayer extends BoardBackgroundLayerBase {
  type: 'artifact';
  artifactId: string;
  fit?: 'cover' | 'contain' | 'tile';
}

export interface BoardBackgroundMapLayer extends BoardBackgroundLayerBase {
  type: 'map';
  center: { lat: number; lng: number };
  zoom: number;
  basemapId?: string;
}

export type BoardBackgroundLayer =
  | BoardBackgroundColorLayer
  | BoardBackgroundImageLayer
  | BoardBackgroundArtifactLayer
  | BoardBackgroundMapLayer;

export interface BoardSubBoardLink {
  type: 'subboard';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  targetBoardId: string;
  title: string;
}

export interface BoardCardLibraryRef {
  type: 'libraryRef';
  id: string;
  libraryCardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoardObject =
  | BoardStickyObject
  | BoardMediaObject
  | BoardNodeObject
  | BoardVectorObject
  | BoardConnectorObject
  | BoardFrameObject
  | BoardSubBoardLink
  | BoardCardLibraryRef;

export interface BoardStyleDefaults {
  objectOpacity?: number;
  nodeColor?: string;
  stickyColor?: string;
  connectorColor?: string;
  connectorStrokeWidth?: number;
  connectorStrokeStyle?: BoardStrokeStyle;
  connectorOpacity?: number;
  connectorArrowDirection?: BoardArrowDirection;
  connectorRouteStyle?: BoardConnectorRouteStyle;
  inkStrokeWidth?: number;
  inkColor?: string;
  inkOpacity?: number;
}

export interface BoardSnapshotV1 {
  version: 1;
  viewBox: BoardViewBox;
  objects: BoardObject[];
  inkStrokes?: BoardInkStroke[];
  comments?: BoardCommentPin[];
  attachments?: BoardAttachmentRef[];
  reportTitle?: string;
  reportContent?: string;
  legalHold?: boolean;
  styleDefaults?: BoardStyleDefaults;
  /** @deprecated Use canvasHiddenNodeRoles — kept for import migration */
  hiddenNodeRoles?: BoardNodeRole[];
  /** Node roles hidden on canvas only (display filter) */
  canvasHiddenNodeRoles?: BoardNodeRole[];
  /** Persisted graph view display settings (per board) */
  graphViewSettings?: GraphSettings;
  /** Persisted graph view filter (per board) */
  graphViewFilter?: GraphFilter;
  /** Graph view positions — independent from canvas x/y */
  graphLayout?: Record<string, { x: number; y: number }>;
  /** Fingerprint of node+connector topology for graph auto-layout */
  graphTopologyFingerprint?: string;
  /** Ordered background layers rendered below grid */
  backgroundLayers?: BoardBackgroundLayer[];
}

export type BoardSnapshot = BoardSnapshotV1;

export interface BoardRecord {
  id: string;
  title: string;
  purpose?: BoardPurpose;
  ownerId?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  snapshot: BoardSnapshot;
  snapshotVersion?: number;
}

export interface BoardRecordMeta {
  id: string;
  title: string;
  purpose?: BoardPurpose;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  objectCount: number;
}

export interface BoardShareSettings {
  mode: 'read' | 'edit';
  userIds?: string[];
  groupIds?: string[];
  publicLink?: string;
}

export interface BoardLibraryCard {
  id: string;
  title: string;
  text: string;
  color?: string;
  createdAt: string;
  boardIds: string[];
}
