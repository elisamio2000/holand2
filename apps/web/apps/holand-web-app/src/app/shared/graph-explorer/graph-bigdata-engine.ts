// ============================================
// Graph Big Data Engine — LOD, Virtual Viewport, Performance
// Provides scalability layers for large graph rendering
// ============================================

import type { EntityType } from '@/types/graph-explorer.types';

// ─── LOD (Level of Detail) Definitions ────────────────────────────────────────

/**
 * Detail level thresholds based on canvas globalScale (zoom level).
 *
 * WHY these thresholds: Calibrated via profiling to balance visual quality
 * against rendering cost. Each level progressively adds visual complexity.
 *
 * Level 0 — Community blobs only (globalScale < 0.3)
 * Level 1 — Simple circles, no text (0.3 ≤ globalScale < 0.7)
 * Level 2 — Circles + icon letters + labels (0.7 ≤ globalScale < 1.5)
 * Level 3 — Full detail: badges, indicators, glows (globalScale ≥ 1.5)
 */
export enum LODLevel {
  /** Community blob — minimal rendering for extreme zoom-out */
  BLOB = 0,
  /** Simple colored circle — no text, no decorations */
  SIMPLE = 1,
  /** Standard — icon letter + label + basic selection highlight */
  STANDARD = 2,
  /** Full detail — all badges, indicators, connection counts, glows */
  FULL = 3,
}

/** Zoom thresholds for transitioning between LOD levels (baseline for small graphs) */
export const LOD_THRESHOLDS = {
  /** Below this → BLOB */
  blobMax: 0.3,
  /** Below this → SIMPLE */
  simpleMax: 0.7,
  /** Below this → STANDARD; above → FULL */
  standardMax: 1.5,
} as const;

/**
 * Compute adaptive LOD thresholds based on node count.
 *
 * WHY adaptive: With 10K+ nodes, each individual circle draw is expensive.
 * Pushing BLOB and SIMPLE thresholds higher keeps the cheap rendering active
 * longer as you zoom in, giving better FPS at large scales.
 *
 * Scaling logic:
 * - <500 nodes: baseline thresholds (0.3 / 0.7 / 1.5)
 * - 500–2K:   slight bump (0.4 / 0.8 / 1.5)
 * - 2K–5K:   moderate bump (0.5 / 1.0 / 2.0)
 * - >5K:     aggressive bump (0.7 / 1.2 / 2.5)
 *
 * @param nodeCount - Total number of visible nodes
 */
export function getAdaptiveLODThresholds(nodeCount: number): {
  blobMax: number;
  simpleMax: number;
  standardMax: number;
} {
  if (nodeCount > 5000) return { blobMax: 0.7, simpleMax: 1.2, standardMax: 2.5 };
  if (nodeCount > 2000) return { blobMax: 0.5, simpleMax: 1.0, standardMax: 2.0 };
  if (nodeCount > 500)  return { blobMax: 0.4, simpleMax: 0.8, standardMax: 1.5 };
  return { blobMax: 0.3, simpleMax: 0.7, standardMax: 1.5 };
}

/**
 * Determine the current LOD level from canvas zoom scale.
 * Uses fixed baseline thresholds — prefer getLODLevelAdaptive for large graphs.
 *
 * @param globalScale - The current zoom scale from react-force-graph's onRenderFramePost
 * @returns The LOD level to use for rendering
 */
export function getLODLevel(globalScale: number): LODLevel {
  if (globalScale < LOD_THRESHOLDS.blobMax) return LODLevel.BLOB;
  if (globalScale < LOD_THRESHOLDS.simpleMax) return LODLevel.SIMPLE;
  if (globalScale < LOD_THRESHOLDS.standardMax) return LODLevel.STANDARD;
  return LODLevel.FULL;
}

/**
 * Determine the current LOD level with node-count-aware adaptive thresholds.
 *
 * @param globalScale - The current zoom scale from react-force-graph
 * @param nodeCount - Total number of visible nodes
 * @returns The LOD level to use for rendering
 */
export function getLODLevelAdaptive(globalScale: number, nodeCount: number): LODLevel {
  const t = getAdaptiveLODThresholds(nodeCount);
  if (globalScale < t.blobMax) return LODLevel.BLOB;
  if (globalScale < t.simpleMax) return LODLevel.SIMPLE;
  if (globalScale < t.standardMax) return LODLevel.STANDARD;
  return LODLevel.FULL;
}

// ─── Link LOD ─────────────────────────────────────────────────────────────────

/**
 * Link LOD levels — simpler than node LOD.
 *
 * Level 1 — Thin lines only (overview / cheap)
 * Level 2 — Arrows + optional labels
 *
 * (@deprecated enum value HIDDEN — links are never fully skipped; preserves graph readability.)
 */
export enum LinkLODLevel {
  /** @deprecated Use SIMPLE — links always draw at least as thin strokes */
  HIDDEN = 0,
  SIMPLE = 1,
  FULL = 2,
}

/**
 * Relaxed importance bar for link rendering at far zoom.
 * Slightly lower than {@link getVisibilityThreshold} so edges remain visible
 * between mid-importance nodes while nodes stay progressively disclosed.
 */
export function getLinkVisibilityImportanceThreshold(
  globalScale: number,
  nodeCount: number
): number {
  const nodeTh = getVisibilityThreshold(globalScale, nodeCount);
  if (nodeCount <= 500) return 0;
  return Math.max(0, nodeTh * 0.38 - 0.1);
}

/**
 * Link LOD from zoom + graph size. Never returns HIDDEN — overview uses thin
 * SIMPLE strokes so the graph still reads as a network (not isolated dots).
 */
export function getLinkLODLevel(globalScale: number, nodeCount: number): LinkLODLevel {
  if (nodeCount <= 500) {
    return globalScale < 0.32 ? LinkLODLevel.SIMPLE : LinkLODLevel.FULL;
  }
  const t = getAdaptiveLODThresholds(nodeCount);
  if (globalScale < t.simpleMax) return LinkLODLevel.SIMPLE;
  return LinkLODLevel.FULL;
}

// ─── Virtual Viewport (Frustum Culling) ────────────────────────────────────────

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Check if a node is within the visible viewport with a margin.
 *
 * WHY margin: Nodes just outside the viewport should still render to prevent
 * pop-in artifacts during panning. Margin = 1.5× viewport size on each side.
 *
 * @param nodeX - Node's X position in graph coordinates
 * @param nodeY - Node's Y position in graph coordinates
 * @param bounds - Current viewport bounds in graph coordinates
 * @param margin - Extra margin factor (default 0.5 = 50% of viewport width/height)
 * @returns Whether the node should be rendered
 */
export function isNodeInViewport(
  nodeX: number,
  nodeY: number,
  bounds: ViewportBounds,
  margin: number = 0.5
): boolean {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const mx = w * margin;
  const my = h * margin;

  return (
    nodeX >= bounds.minX - mx &&
    nodeX <= bounds.maxX + mx &&
    nodeY >= bounds.minY - my &&
    nodeY <= bounds.maxY + my
  );
}

/**
 * Calculate viewport bounds from the force-graph's canvas transform.
 *
 * Uses the graph instance's screen2GraphCoords to convert the four
 * corners of the canvas into graph-space coordinates.
 *
 * @param graphRef - Reference to the force-graph instance
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns ViewportBounds in graph coordinates, or null if transform unavailable
 */
export function getViewportBounds(
  graphRef: { screen2GraphCoords?: (x: number, y: number) => { x: number; y: number } } | null,
  width: number,
  height: number
): ViewportBounds | null {
  if (!graphRef?.screen2GraphCoords) return null;

  try {
    const topLeft = graphRef.screen2GraphCoords(0, 0);
    const bottomRight = graphRef.screen2GraphCoords(width, height);

    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  } catch {
    return null;
  }
}

// ─── Auto Engine Switch ───────────────────────────────────────────────────────

/**
 * Engine recommendation thresholds.
 *
 * WHY these values: Canvas2D performs well up to ~2K nodes but degrades
 * sharply past that. WebGL (3D) handles 10K+ nodes but loses canvas2D's
 * pixel-perfect text rendering. Above 10K, WebGL is essential.
 */
export const ENGINE_THRESHOLDS = {
  /** Below this: Canvas2D recommended (best text quality) */
  canvas2DMax: 2000,
  /** Above this: WebGL strongly recommended (Canvas2D unusable) */
  webGLRequired: 5000,
} as const;

export type EngineRecommendation = 'canvas2d' | 'webgl' | 'either';

/**
 * Get engine recommendation based on node count.
 *
 * @param nodeCount - Total number of nodes in the graph
 * @returns Engine recommendation
 */
export function getEngineRecommendation(nodeCount: number): EngineRecommendation {
  if (nodeCount <= ENGINE_THRESHOLDS.canvas2DMax) return 'canvas2d';
  if (nodeCount >= ENGINE_THRESHOLDS.webGLRequired) return 'webgl';
  return 'either';
}

// ─── Render Stats Tracker ─────────────────────────────────────────────────────

/**
 * Lightweight FPS tracker for monitoring graph render performance.
 *
 * Calculates rolling average FPS over the last N frames.
 * Used to trigger auto-degradation (reduce LOD, switch engine) when FPS drops.
 */
export class RenderStatsTracker {
  private frameTimes: number[] = [];
  private maxFrames: number;
  private lastTime: number = 0;
  private frameCount: number = 0;

  constructor(maxFrames: number = 60) {
    this.maxFrames = maxFrames;
  }

  /** Record a new frame timestamp */
  tick(): void {
    this.frameCount++;
    const now = performance.now();
    if (this.lastTime > 0) {
      this.frameTimes.push(now - this.lastTime);
      if (this.frameTimes.length > this.maxFrames) {
        this.frameTimes.shift();
      }
    }
    this.lastTime = now;
  }

  /** Get total frame count since creation/reset */
  getFrameCount(): number {
    return this.frameCount;
  }

  /** Get current average FPS */
  getFPS(): number {
    if (this.frameTimes.length === 0) return 60;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.round(1000 / avg);
  }

  /** Check if performance is degraded (below threshold) */
  isLowFPS(threshold: number = 20): boolean {
    return this.getFPS() < threshold;
  }

  /** Reset all recorded frames */
  reset(): void {
    this.frameTimes = [];
    this.lastTime = 0;
  }
}

// ─── Progressive Visibility (Map-like Semantic Zoom) ──────────────────────────

/**
 * Compute normalized importance (0-1) for each node based on connection count.
 *
 * WHY log scale: Linear importance would make a few mega-hubs dominate.
 * Log scale compresses the range so nodes with 5-20 connections are still
 * meaningfully differentiated from leaves (1-2 connections).
 *
 * Used for:
 * - Progressive visibility: hub nodes appear first when zooming in
 * - Zoom-dependent node sizing: hubs are proportionally larger at far zoom
 *
 * @param nodes - Array of nodes with id and connectionCount
 * @returns Map of nodeId → importance (0-1, where 1 = highest-connected hub)
 */
export function computeNodeImportance(
  nodes: ReadonlyArray<{ id: string; connectionCount?: number }>
): Map<string, number> {
  if (nodes.length === 0) return new Map();

  let maxCC = 0;
  for (let i = 0; i < nodes.length; i++) {
    const cc = nodes[i].connectionCount ?? 0;
    if (cc > maxCC) maxCC = cc;
  }
  const maxLog = Math.log2(1 + Math.max(1, maxCC));

  const map = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const cc = n.connectionCount ?? 0;
    map.set(n.id, Math.log2(1 + cc) / maxLog);
  }
  return map;
}

/**
 * Get visibility threshold for progressive node disclosure.
 *
 * Returns 0-1 value. Nodes with importance < threshold are hidden.
 * Uses power curve for smooth transition from overview → detail:
 *
 *  - globalScale ≈ 0    → threshold ≈ 1   (only top hubs visible)
 *  - globalScale ≈ mid  → threshold ≈ 0.3 (most nodes visible)
 *  - globalScale ≥ full → threshold = 0   (all nodes visible)
 *
 * Small graphs (≤ 500 nodes) always return 0 (show everything).
 *
 * @param globalScale - Current canvas zoom scale
 * @param nodeCount - Total node count (drives adaptive thresholds)
 * @returns Importance threshold (0-1). Nodes below this are hidden.
 */
export function getVisibilityThreshold(
  globalScale: number,
  nodeCount: number
): number {
  if (nodeCount <= 500) return 0;

  const t = getAdaptiveLODThresholds(nodeCount);
  const normalized = Math.min(1, globalScale / t.standardMax);
  // WHY power 1.5: Gentler than linear — keeps more nodes visible at medium zoom,
  // while still hiding most at extreme zoom-out. Feels natural like map city labels.
  return Math.pow(1 - normalized, 1.5);
}

/**
 * Compute zoom-aware display size for a node based on importance.
 *
 * WHY zoom-dependent sizing: Like maps showing capitals as big dots and villages
 * as small ones at country zoom, but similar sizes at street zoom.
 * Hub nodes are proportionally larger at far zoom; sizes converge at close zoom.
 *
 * Size = baseSize * (minScale + importance * importanceWeight)
 * where importanceWeight = 3 * max(0.3, 1 - zoomNorm)
 *
 * @param importance - Node importance 0-1 (from computeNodeImportance)
 * @param globalScale - Current canvas zoom scale
 * @param baseSize - Base node radius in graph units
 * @param nodeCount - Total node count (for adaptive thresholds)
 * @returns Display radius for the node
 */
export function getImportanceNodeSize(
  importance: number,
  globalScale: number,
  baseSize: number,
  nodeCount: number
): number {
  const t = getAdaptiveLODThresholds(nodeCount);
  const zoomNorm = Math.min(1, globalScale / t.standardMax);
  // WHY 0.3 floor: Even at max zoom, hub nodes should be somewhat larger
  const importanceWeight = 3 * Math.max(0.3, 1 - zoomNorm);
  // WHY 0.6 minimum: Leaf nodes are still visible, not invisible dots
  return baseSize * (0.6 + importance * importanceWeight);
}


