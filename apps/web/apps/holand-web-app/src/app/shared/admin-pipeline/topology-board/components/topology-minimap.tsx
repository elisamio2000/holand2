'use client';

import { IconTooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { ActionIcon, Checkbox, Dropdown, Popover, Text } from 'rizzui';
import { PiArrowsOutCardinal, PiCrosshair, PiGear, PiPushPin, PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTopologyBoardStore } from '../store/topology-board-store';
import { ENTITY_KIND_COLORS } from '../../helpers/topology-visual-tokens';
import type { TopologyEntityKind, TopologyNode } from '../helpers/topology-board-types';

export type TopologyMiniMapAnchor =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'floating';

interface PersistedState {
  anchor: TopologyMiniMapAnchor;
  width: number;
  height: number;
  floatingPos?: { x: number; y: number };
  showNodes: boolean;
  showEdges: boolean;
  opacity: number;
}

const DEFAULT_STATE: PersistedState = {
  anchor: 'bottom-right',
  width: 240,
  height: 170,
  showNodes: true,
  showEdges: true,
  opacity: 0.95,
};

const MIN_W = 160;
const MAX_W = 480;
const MIN_H = 120;
const MAX_H = 360;
const HEADER_H = 24;
const SVG_PAD = 8;
const EDGE_GAP = 12;
const STORAGE_KEY = 'topology-mini-map:v1';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

function saveState(state: PersistedState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function nodeCenter(n: TopologyNode): { x: number; y: number } {
  const w = n.width ?? 172;
  const h = n.height ?? 64;
  return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
}

interface Props {
  onClose?: () => void;
  className?: string;
}

export default function TopologyMiniMap({ onClose, className }: Props) {
  const { t } = useTranslation();
  const { getViewport, setViewport, fitView } = useReactFlow();
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const edges = useTopologyBoardStore((s) => s.edges);
  const selectedNodeIds = useTopologyBoardStore((s) => s.selectedNodeIds);
  const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);
  const [viewport, setViewportState] = useState(() => getViewport());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parentSizeRef = useRef({ w: 800, h: 600 });

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    saveState(state);
  }, [state, mounted]);

  useEffect(() => {
    const tick = () => setViewportState(getViewport());
    tick();
    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, [getViewport]);

  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      parentSizeRef.current = { w: parent.clientWidth, h: parent.clientHeight };
    });
    ro.observe(parent);
    parentSizeRef.current = { w: parent.clientWidth, h: parent.clientHeight };
    return () => ro.disconnect();
  }, []);

  const visibleNodes = useMemo(
    () => nodes.filter((n) => n.data.kind !== 'group' && !n.hidden),
    [nodes]
  );

  const bounds = useMemo(() => {
    const { w: pw, h: ph } = parentSizeRef.current;
    const { x, y, zoom } = viewport;
    const vx = -x / zoom;
    const vy = -y / zoom;
    const vw = pw / zoom;
    const vh = ph / zoom;

    let minX = vx;
    let minY = vy;
    let maxX = vx + vw;
    let maxY = vy + vh;

    visibleNodes.forEach((n) => {
      const c = nodeCenter(n);
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    });

    const pad = 80;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    return {
      minX,
      minY,
      w: Math.max(200, maxX - minX),
      h: Math.max(200, maxY - minY),
      viewBox: { x: vx, y: vy, w: vw, h: vh },
    };
  }, [visibleNodes, viewport]);

  const W = state.width;
  const H = state.height;
  const SVG_W = W;
  const SVG_H = Math.max(60, H - HEADER_H);
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

  const centerViewportOn = useCallback(
    (worldX: number, worldY: number) => {
      const { zoom } = getViewport();
      const { w: pw, h: ph } = parentSizeRef.current;
      setViewport({
        x: pw / 2 - worldX * zoom,
        y: ph / 2 - worldY * zoom,
        zoom,
      });
    },
    [getViewport, setViewport]
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

  const onMapMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pt = getSvgPoint(e);
      const world = mapToWorld(pt.x, pt.y);
      const vb = bounds.viewBox;
      const inside =
        world.x >= vb.x &&
        world.x <= vb.x + vb.w &&
        world.y >= vb.y &&
        world.y <= vb.y + vb.h;
      if (inside) {
        vpDragRef.current = {
          active: true,
          offsetX: world.x - vb.x,
          offsetY: world.y - vb.y,
        };
      } else {
        centerViewportOn(world.x, world.y);
        vpDragRef.current = {
          active: true,
          offsetX: vb.w / 2,
          offsetY: vb.h / 2,
        };
      }
      const onMove = (ev: MouseEvent) => {
        const st = vpDragRef.current;
        if (!st?.active) return;
        const p = getSvgPoint(ev);
        const w = mapToWorld(p.x, p.y);
        const { zoom } = getViewport();
        const { w: pw, h: ph } = parentSizeRef.current;
        setViewport({
          x: pw / 2 - (w.x - st.offsetX + vb.w / 2) * zoom,
          y: ph / 2 - (w.y - st.offsetY + vb.h / 2) * zoom,
          zoom,
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
    [getSvgPoint, mapToWorld, bounds.viewBox, centerViewportOn, getViewport, setViewport]
  );

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (state.anchor !== 'floating') return;
      if ((e.target as HTMLElement).closest('button, [data-no-drag], input')) return;
      e.preventDefault();
      const orig = state.floatingPos ?? { x: 80, y: 80 };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: MouseEvent) => {
        const parent = containerRef.current?.parentElement;
        const maxX = parent ? parent.clientWidth - W - 4 : 9999;
        const maxY = parent ? parent.clientHeight - H - 4 : 9999;
        setState((s) => ({
          ...s,
          floatingPos: {
            x: clamp(orig.x + ev.clientX - startX, 4, maxX),
            y: clamp(orig.y + ev.clientY - startY, 4, maxY),
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

  const handleCorner = state.anchor === 'top-left' || state.anchor === 'bottom-right' ? 'br' : 'bl';
  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = W;
      const startH = H;
      const onMove = (ev: MouseEvent) => {
        setState((s) => ({
          ...s,
          width: clamp(startW + (ev.clientX - startX), MIN_W, MAX_W),
          height: clamp(startH + (ev.clientY - startY), MIN_H, MAX_H),
        }));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [W, H]
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
      case 'floating':
        return { ...base, top: state.floatingPos?.y ?? 80, left: state.floatingPos?.x ?? 80 };
    }
  }, [state.anchor, state.floatingPos, W, H]);

  const vTL = worldToMap(bounds.viewBox.x, bounds.viewBox.y);
  const vBR = worldToMap(bounds.viewBox.x + bounds.viewBox.w, bounds.viewBox.y + bounds.viewBox.h);
  const vRect = {
    x: vTL.x,
    y: vTL.y,
    w: Math.max(6, vBR.x - vTL.x),
    h: Math.max(6, vBR.y - vTL.y),
  };

  const ANCHORS: { value: TopologyMiniMapAnchor; label: string }[] = [
    { value: 'top-left', label: t('boards.minimap.anchorTopLeft', 'Top left') },
    { value: 'top-right', label: t('boards.minimap.anchorTopRight', 'Top right') },
    { value: 'bottom-left', label: t('boards.minimap.anchorBottomLeft', 'Bottom left') },
    { value: 'bottom-right', label: t('boards.minimap.anchorBottomRight', 'Bottom right') },
    { value: 'floating', label: t('boards.minimap.anchorFloating', 'Free (drag)') },
  ];

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      style={{ ...positionStyle, opacity: state.opacity }}
      className={cn(
        'z-20 flex flex-col overflow-hidden rounded-md border border-muted bg-white shadow-lg dark:bg-gray-100',
        className
      )}
      role="region"
      aria-label={t('pipeline.topology.board.minimap', 'Minimap')}
    >
      <div
        style={{ height: HEADER_H }}
        className={cn(
          'flex shrink-0 items-center gap-0.5 border-b border-muted px-1 text-[9px] text-gray-500',
          state.anchor === 'floating' && 'cursor-grab'
        )}
        onMouseDown={onHeaderMouseDown}
      >
        <span className="min-w-0 flex-1 truncate ps-1 font-medium">
          {visibleNodes.length} {t('pipeline.topology.board.minimapNodes', 'nodes')} · {edges.length}{' '}
          {t('pipeline.topology.board.minimapEdges', 'edges')}
        </span>
        <IconTooltip content={t('boards.minimap.center', 'Fit all')} preset="toolbar">
          <ActionIcon
            size="sm"
            variant="text"
            aria-label={t('boards.minimap.center', 'Fit all')}
            onClick={() => fitView({ padding: 0.2 })}
          >
            <PiCrosshair className="size-3" />
          </ActionIcon>
        </IconTooltip>
        <Dropdown placement="bottom-end">
          <Dropdown.Trigger>
            <IconTooltip content={t('boards.minimap.anchor', 'Anchor')} preset="toolbar">
              <ActionIcon size="sm" variant="text" aria-label={t('boards.minimap.anchor', 'Anchor')}>
                <PiPushPin className="size-3" />
              </ActionIcon>
            </IconTooltip>
          </Dropdown.Trigger>
          <Dropdown.Menu className="w-36">
            {ANCHORS.map((a) => (
              <Dropdown.Item key={a.value} onClick={() => setState((s) => ({ ...s, anchor: a.value }))}>
                {a.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        <Popover>
          <Popover.Trigger>
            <IconTooltip content={t('boards.minimap.display', 'Display')} preset="toolbar">
              <ActionIcon size="sm" variant="text" aria-label={t('boards.minimap.display', 'Display')}>
                <PiGear className="size-3" />
              </ActionIcon>
            </IconTooltip>
          </Popover.Trigger>
          <Popover.Content className="z-50 w-60 space-y-3 p-3">
            <Checkbox
              label={t('pipeline.topology.board.minimapShowNodes', 'Show nodes')}
              checked={state.showNodes}
              onChange={(e) => setState((s) => ({ ...s, showNodes: e.target.checked }))}
            />
            <Checkbox
              label={t('pipeline.topology.board.minimapShowEdges', 'Show edges')}
              checked={state.showEdges}
              onChange={(e) => setState((s) => ({ ...s, showEdges: e.target.checked }))}
            />
            <div>
              <Text className="mb-1 text-xs text-gray-500">{t('boards.minimap.opacity', 'Opacity')}</Text>
              <input
                type="range"
                min={30}
                max={100}
                value={Math.round(state.opacity * 100)}
                onChange={(e) =>
                  setState((s) => ({ ...s, opacity: Number(e.target.value) / 100 }))
                }
                className="w-full"
              />
            </div>
          </Popover.Content>
        </Popover>
        {onClose && (
          <ActionIcon size="sm" variant="text" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <PiX className="size-3" />
          </ActionIcon>
        )}
      </div>
      <svg
        ref={svgRef}
        width={SVG_W}
        height={SVG_H}
        className="cursor-crosshair bg-gray-50 dark:bg-gray-900/40"
        onMouseDown={onMapMouseDown}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="transparent" />
        {state.showEdges &&
          edges.map((e) => {
            const src = visibleNodes.find((n) => n.id === e.source);
            const tgt = visibleNodes.find((n) => n.id === e.target);
            if (!src || !tgt) return null;
            const s = worldToMap(nodeCenter(src).x, nodeCenter(src).y);
            const t2 = worldToMap(nodeCenter(tgt).x, nodeCenter(tgt).y);
            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={t2.x}
                y2={t2.y}
                stroke="#64748b"
                strokeWidth={1}
                opacity={0.6}
              />
            );
          })}
        {state.showNodes &&
          visibleNodes.map((n) => {
            const c = worldToMap(nodeCenter(n).x, nodeCenter(n).y);
            const kind = n.data.kind as TopologyEntityKind;
            const color = ENTITY_KIND_COLORS[kind] ?? '#6366f1';
            const selected = selectedSet.has(n.id);
            return (
              <circle
                key={n.id}
                cx={c.x}
                cy={c.y}
                r={selected ? 3.5 : 2.5}
                fill={selected ? '#2563eb' : color}
              />
            );
          })}
        <rect
          x={vRect.x}
          y={vRect.y}
          width={vRect.w}
          height={vRect.h}
          fill="rgba(37,99,235,0.15)"
          stroke="#2563eb"
          strokeWidth={1.5}
          rx={1}
        />
      </svg>
      <div
        className={cn(
          'absolute bottom-0 end-0 size-3 rounded-sm bg-gray-300/80 dark:bg-gray-600/80',
          handleCorner === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
        )}
        onMouseDown={onResizeStart}
        aria-hidden
      >
        <PiArrowsOutCardinal className="size-3 opacity-50" />
      </div>
    </div>
  );
}
