'use client';

/**
 * Board mini-map — GraphX BuilderMiniMap parity:
 * self-positioning overlay, 5 anchor modes, free resize, viewport drag sync,
 * show objects/connectors/ink toggles, opacity, localStorage persistence.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Checkbox, Dropdown, Popover, Text } from 'rizzui';
import {
  PiArrowsOutCardinal,
  PiCrosshair,
  PiGear,
  PiPushPin,
  PiX,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { BoardSnapshot, BoardViewBox } from '../lib/board-types';
import { getSnapshotBounds } from '../lib/board-snapshot';

export type MiniMapAnchor =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'floating';

interface FloatingPos {
  x: number;
  y: number;
}

interface PersistedState {
  anchor: MiniMapAnchor;
  width: number;
  height: number;
  floatingPos?: FloatingPos;
  showObjects: boolean;
  showConnectors: boolean;
  showInk: boolean;
  opacity: number;
}

const DEFAULT_STATE: PersistedState = {
  anchor: 'bottom-right',
  width: 240,
  height: 170,
  showObjects: true,
  showConnectors: true,
  showInk: true,
  opacity: 0.95,
};

const MIN_W = 160;
const MAX_W = 480;
const MIN_H = 120;
const MAX_H = 360;
const HEADER_H = 24;
const SVG_PAD = 8;
const EDGE_GAP = 12;
const STORAGE_PREFIX = 'user-boards-mini-map:';

const TYPE_COLORS: Record<string, string> = {
  sticky: '#fbbf24',
  node: '#3b82f6',
  media: '#94a3b8',
  frame: '#a78bfa',
  vector: '#22c55e',
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function loadState(id: string): PersistedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      width: clamp(parsed.width ?? DEFAULT_STATE.width, MIN_W, MAX_W),
      height: clamp(parsed.height ?? DEFAULT_STATE.height, MIN_H, MAX_H),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(id: string, state: PersistedState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

interface MiniMapNode {
  id: string;
  x: number;
  y: number;
  type: string;
}

interface MiniMapEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function extractMiniMapData(snapshot: BoardSnapshot): { nodes: MiniMapNode[]; edges: MiniMapEdge[] } {
  const spatialById = new Map<string, { x: number; y: number; width: number; height: number }>();
  const nodes: MiniMapNode[] = [];

  for (const o of snapshot.objects) {
    if (o.type === 'connector' || !('x' in o)) continue;
    spatialById.set(o.id, { x: o.x, y: o.y, width: o.width, height: o.height });
    nodes.push({
      id: o.id,
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
      type: o.type,
    });
  }

  const edges: MiniMapEdge[] = [];
  for (const o of snapshot.objects) {
    if (o.type !== 'connector') continue;
    const src = spatialById.get(o.sourceId);
    const tgt = spatialById.get(o.targetId);
    if (!src || !tgt) continue;
    edges.push({
      id: o.id,
      x1: src.x + src.width / 2,
      y1: src.y + src.height / 2,
      x2: tgt.x + tgt.width / 2,
      y2: tgt.y + tgt.height / 2,
    });
  }

  return { nodes, edges };
}

export interface BoardMiniMapProps {
  id?: string;
  snapshot: BoardSnapshot;
  viewBox: BoardViewBox;
  selectedIds?: string[];
  onViewBoxChange: (vb: BoardViewBox) => void;
  onCenter?: () => void;
  onClose?: () => void;
  className?: string;
}

export function BoardMiniMap({
  id = 'default',
  snapshot,
  viewBox,
  selectedIds = [],
  onViewBoxChange,
  onCenter,
  onClose,
  className,
}: BoardMiniMapProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);

  const { nodes, edges } = useMemo(() => extractMiniMapData(snapshot), [snapshot]);

  useEffect(() => {
    setState(loadState(id));
    setMounted(true);
  }, [id]);

  useEffect(() => {
    if (!mounted) return;
    saveState(id, state);
  }, [id, state, mounted]);

  const setAnchor = (anchor: MiniMapAnchor) => setState((s) => ({ ...s, anchor }));

  const W = state.width;
  const H = state.height;
  const SVG_W = W;
  const SVG_H = Math.max(60, H - HEADER_H);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (state.anchor !== 'floating') return;
      if ((e.target as HTMLElement).closest('button, [data-no-drag], input')) return;
      e.preventDefault();
      const orig = state.floatingPos ?? { x: 80, y: 80 };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const parent = containerRef.current?.parentElement;
        const maxX = parent ? parent.clientWidth - W - 4 : 9999;
        const maxY = parent ? parent.clientHeight - H - 4 : 9999;
        setState((s) => ({
          ...s,
          floatingPos: {
            x: clamp(orig.x + dx, 4, maxX),
            y: clamp(orig.y + dy, 4, maxY),
          },
        }));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [state.anchor, state.floatingPos, W, H]
  );

  const handleCorner: 'tl' | 'tr' | 'bl' | 'br' = useMemo(() => {
    switch (state.anchor) {
      case 'top-left':
        return 'br';
      case 'top-right':
        return 'bl';
      case 'bottom-left':
        return 'tr';
      case 'bottom-right':
        return 'tl';
      case 'floating':
        return 'br';
    }
  }, [state.anchor]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = W;
      const startH = H;
      const cornerSx = handleCorner.includes('r') ? 1 : -1;
      const cornerSy = handleCorner.includes('b') ? 1 : -1;
      const onMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) * cornerSx;
        const dy = (ev.clientY - startY) * cornerSy;
        setState((s) => ({
          ...s,
          width: clamp(startW + dx, MIN_W, MAX_W),
          height: clamp(startH + dy, MIN_H, MAX_H),
        }));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [W, H, handleCorner]
  );

  const bounds = useMemo(() => {
    const snap = getSnapshotBounds(snapshot);
    let minX = Math.min(viewBox.x, snap.minX);
    let minY = Math.min(viewBox.y, snap.minY);
    let maxX = Math.max(viewBox.x + viewBox.width, snap.maxX);
    let maxY = Math.max(viewBox.y + viewBox.height, snap.maxY);
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    const pad = 80;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const w = Math.max(200, maxX - minX);
    const h = Math.max(200, maxY - minY);
    return { minX, minY, w, h };
  }, [nodes, snapshot, viewBox.x, viewBox.y, viewBox.width, viewBox.height]);

  const innerW = SVG_W - SVG_PAD * 2;
  const innerH = SVG_H - SVG_PAD * 2;
  const scale = Math.min(innerW / bounds.w, innerH / bounds.h);
  const offsetX = SVG_PAD + (innerW - bounds.w * scale) / 2;
  const offsetY = SVG_PAD + (innerH - bounds.h * scale) / 2;

  const worldToMap = useCallback(
    (wx: number, wy: number) => ({
      x: offsetX + (wx - bounds.minX) * scale,
      y: offsetY + (wy - bounds.minY) * scale,
    }),
    [offsetX, offsetY, scale, bounds.minX, bounds.minY]
  );

  const mapToWorld = useCallback(
    (mx: number, my: number) => ({
      x: bounds.minX + (mx - offsetX) / scale,
      y: bounds.minY + (my - offsetY) / scale,
    }),
    [offsetX, offsetY, scale, bounds.minX, bounds.minY]
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const vpDragRef = useRef<{ active: boolean; offsetX: number; offsetY: number } | null>(null);

  const getSvgPoint = useCallback(
    (evt: React.MouseEvent | MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      const sx = SVG_W / r.width;
      const sy = SVG_H / r.height;
      return { x: (evt.clientX - r.left) * sx, y: (evt.clientY - r.top) * sy };
    },
    [SVG_W, SVG_H]
  );

  const centerViewportOn = useCallback(
    (worldX: number, worldY: number) => {
      onViewBoxChange({
        x: worldX - viewBox.width / 2,
        y: worldY - viewBox.height / 2,
        width: viewBox.width,
        height: viewBox.height,
      });
    },
    [onViewBoxChange, viewBox.width, viewBox.height]
  );

  const onMapMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pt = getSvgPoint(e);
      const world = mapToWorld(pt.x, pt.y);
      const inside =
        world.x >= viewBox.x &&
        world.x <= viewBox.x + viewBox.width &&
        world.y >= viewBox.y &&
        world.y <= viewBox.y + viewBox.height;
      if (inside) {
        vpDragRef.current = {
          active: true,
          offsetX: world.x - viewBox.x,
          offsetY: world.y - viewBox.y,
        };
      } else {
        centerViewportOn(world.x, world.y);
        vpDragRef.current = {
          active: true,
          offsetX: viewBox.width / 2,
          offsetY: viewBox.height / 2,
        };
      }
      const onMove = (ev: MouseEvent) => {
        const st = vpDragRef.current;
        if (!st?.active) return;
        const p = getSvgPoint(ev);
        const w = mapToWorld(p.x, p.y);
        onViewBoxChange({
          x: w.x - st.offsetX,
          y: w.y - st.offsetY,
          width: viewBox.width,
          height: viewBox.height,
        });
      };
      const onUp = () => {
        vpDragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [getSvgPoint, mapToWorld, viewBox, centerViewportOn, onViewBoxChange]
  );

  const positionStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = { position: 'absolute', width: W, height: H };
    switch (state.anchor) {
      case 'top-left':
        return { ...base, top: EDGE_GAP, left: EDGE_GAP };
      case 'top-right':
        return { ...base, top: EDGE_GAP, right: EDGE_GAP };
      case 'bottom-left':
        return { ...base, bottom: EDGE_GAP, left: EDGE_GAP };
      case 'bottom-right':
        return { ...base, bottom: EDGE_GAP, right: EDGE_GAP };
      case 'floating': {
        const pos = state.floatingPos ?? { x: 80, y: 80 };
        return { ...base, top: pos.y, left: pos.x };
      }
    }
  }, [state.anchor, state.floatingPos, W, H]);

  const vTopLeft = worldToMap(viewBox.x, viewBox.y);
  const vBottomRight = worldToMap(viewBox.x + viewBox.width, viewBox.y + viewBox.height);
  const vRect = {
    x: vTopLeft.x,
    y: vTopLeft.y,
    w: Math.max(6, vBottomRight.x - vTopLeft.x),
    h: Math.max(6, vBottomRight.y - vTopLeft.y),
  };

  const ANCHORS: { value: MiniMapAnchor; label: string }[] = [
    { value: 'top-left', label: t('boards.minimap.anchorTopLeft', 'Top left') },
    { value: 'top-right', label: t('boards.minimap.anchorTopRight', 'Top right') },
    { value: 'bottom-left', label: t('boards.minimap.anchorBottomLeft', 'Bottom left') },
    { value: 'bottom-right', label: t('boards.minimap.anchorBottomRight', 'Bottom right') },
    { value: 'floating', label: t('boards.minimap.anchorFloating', 'Free (drag)') },
  ];

  const handlePosClass: Record<typeof handleCorner, string> = {
    tl: 'top-0 start-0 cursor-nwse-resize -translate-x-1 -translate-y-1',
    tr: 'top-0 end-0 cursor-nesw-resize translate-x-1 -translate-y-1',
    bl: 'bottom-0 start-0 cursor-nesw-resize -translate-x-1 translate-y-1',
    br: 'bottom-0 end-0 cursor-nwse-resize translate-x-1 translate-y-1',
  };

  const objectCount = nodes.length;
  const connectorCount = edges.length;

  return (
    <div
      ref={containerRef}
      style={{ ...positionStyle, opacity: state.opacity }}
      className={cn(
        'z-20 flex flex-col overflow-hidden rounded-md border border-muted bg-white shadow-lg dark:bg-gray-100',
        className
      )}
      role="region"
      aria-label={t('boards.minimap.title', 'Minimap')}
    >
      <div
        style={{ height: HEADER_H }}
        className={cn(
          'flex shrink-0 items-center justify-between gap-1 border-b border-muted bg-gray-50/80 px-1.5 dark:bg-gray-200/30',
          state.anchor === 'floating' && 'cursor-move'
        )}
        onMouseDown={onHeaderMouseDown}
      >
        <span className="select-none ps-1 text-[10px] uppercase tracking-wide text-gray-500">
          {objectCount}o · {connectorCount}c
        </span>
        <div className="flex items-center gap-0.5" data-no-drag>
          {onCenter ? (
            <ActionIcon
              size="sm"
              variant="text"
              title={t('boards.minimap.center', 'Center on board')}
              aria-label={t('boards.minimap.center', 'Center on board')}
              onClick={onCenter}
            >
              <PiCrosshair className="size-3.5" />
            </ActionIcon>
          ) : null}

          <Dropdown>
            <Dropdown.Trigger>
              <ActionIcon
                size="sm"
                variant="text"
                title={t('boards.minimap.position', 'Mini-map position')}
                aria-label={t('boards.minimap.position', 'Mini-map position')}
              >
                {state.anchor === 'floating' ? (
                  <PiArrowsOutCardinal className="size-3.5" />
                ) : (
                  <PiPushPin className="size-3.5" />
                )}
              </ActionIcon>
            </Dropdown.Trigger>
            <Dropdown.Menu className="min-w-[160px]">
              {ANCHORS.map((a) => (
                <Dropdown.Item
                  key={a.value}
                  onClick={() => setAnchor(a.value)}
                  className={cn('text-xs', state.anchor === a.value && 'bg-gray-100')}
                >
                  {a.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <Popover>
            <Popover.Trigger>
              <ActionIcon
                size="sm"
                variant="text"
                title={t('boards.minimap.settings', 'Mini-map settings')}
                aria-label={t('boards.minimap.settings', 'Mini-map settings')}
              >
                <PiGear className="size-3.5" />
              </ActionIcon>
            </Popover.Trigger>
            <Popover.Content className="z-50 w-60 space-y-3 p-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('boards.minimap.display', 'Display')}
              </Text>
              <Checkbox
                label={t('boards.minimap.showObjects', 'Show objects')}
                checked={state.showObjects}
                onChange={() => setState((s) => ({ ...s, showObjects: !s.showObjects }))}
                className="text-xs"
              />
              <Checkbox
                label={t('boards.minimap.showConnectors', 'Show connectors')}
                checked={state.showConnectors}
                onChange={() => setState((s) => ({ ...s, showConnectors: !s.showConnectors }))}
                className="text-xs"
              />
              <Checkbox
                label={t('boards.minimap.showInk', 'Show ink')}
                checked={state.showInk}
                onChange={() => setState((s) => ({ ...s, showInk: !s.showInk }))}
                className="text-xs"
              />
              <div className="space-y-1.5">
                <Text className="text-xs">
                  {t('boards.minimap.opacity', 'Opacity')}: {Math.round(state.opacity * 100)}%
                </Text>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={5}
                  value={Math.round(state.opacity * 100)}
                  className="w-full"
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      opacity: Number.parseInt(e.target.value, 10) / 100,
                    }))
                  }
                />
              </div>
              <Text className="border-t border-muted pt-1 text-[10px] text-gray-500">
                {t('boards.minimap.resizeHint', 'Drag the corner handle to resize.')}
                <br />
                {W}×{H}
              </Text>
            </Popover.Content>
          </Popover>

          {onClose ? (
            <ActionIcon
              size="sm"
              variant="text"
              title={t('boards.minimap.hide', 'Hide mini-map')}
              aria-label={t('boards.minimap.hide', 'Hide mini-map')}
              onClick={onClose}
            >
              <PiX className="size-3.5" />
            </ActionIcon>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-gray-50/60 dark:bg-gray-200/20">
        <svg
          ref={svgRef}
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="block cursor-pointer select-none"
          onMouseDown={onMapMouseDown}
        >
          <rect
            x={offsetX}
            y={offsetY}
            width={bounds.w * scale}
            height={bounds.h * scale}
            fill="#f1f5f9"
            opacity={0.6}
          />

          {state.showInk &&
            (snapshot.inkStrokes ?? []).map((s) =>
              s.points.length >= 2 ? (
                <polyline
                  key={s.id}
                  points={s.points
                    .map((p) => {
                      const m = worldToMap(p.x, p.y);
                      return `${m.x},${m.y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={Math.max(0.5, s.width * 0.12)}
                  opacity={0.55}
                />
              ) : null
            )}

          {state.showConnectors &&
            edges.map((edge) => {
              const a = worldToMap(edge.x1, edge.y1);
              const b = worldToMap(edge.x2, edge.y2);
              return (
                <line
                  key={edge.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  opacity={0.65}
                />
              );
            })}

          {state.showObjects &&
            nodes.map((node) => {
              const p = worldToMap(node.x, node.y);
              const sel = selectedIds.includes(node.id);
              return (
                <circle
                  key={node.id}
                  cx={p.x}
                  cy={p.y}
                  r={sel ? 3.5 : 2.5}
                  fill={sel ? '#2563eb' : (TYPE_COLORS[node.type] ?? '#64748b')}
                  opacity={sel ? 1 : 0.85}
                />
              );
            })}

          <rect
            x={vRect.x}
            y={vRect.y}
            width={vRect.w}
            height={vRect.h}
            fill="#3b82f6"
            fillOpacity={0.15}
            stroke="#2563eb"
            strokeWidth={1.4}
          />

          {nodes.length === 0 ? (
            <text
              x={SVG_W / 2}
              y={SVG_H / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill="#94a3b8"
              opacity={0.8}
            >
              {t('boards.minimap.empty', 'empty board')}
            </text>
          ) : null}
        </svg>

        <button
          type="button"
          onMouseDown={onResizeStart}
          className={cn(
            'absolute z-10 h-3.5 w-3.5 border-0 bg-transparent p-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            handlePosClass[handleCorner]
          )}
          title={t('boards.minimap.resize', 'Drag to resize')}
          aria-label={t('boards.minimap.resize', 'Drag to resize')}
        />
      </div>
    </div>
  );
}
