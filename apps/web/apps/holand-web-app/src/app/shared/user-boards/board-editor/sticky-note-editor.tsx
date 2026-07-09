'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { useTranslation } from 'react-i18next';
import {
  PiDotsThreeVertical,
  PiEraser,
  PiHighlighterCircle,
  PiPencilLine,
  PiTextT,
  PiArrowsOut,
} from 'react-icons/pi';
import { Dropdown } from 'rizzui';
import cn from '@core/utils/class-names';
import type { BoardStickyInkStroke, StickyInkLayout, StickyInkRegion } from '../lib/board-types';
import { BoardColorPickerCompact } from '../components/board-color-picker';
import { stickyCanvasDprSize } from '../lib/sticky/sticky-coords';
import {
  DEFAULT_STICKY_INK_REGION,
  STICKY_HEADER_H,
  STICKY_INK_LAYOUTS,
  mapBodyPointToInkPixels,
  normalizeStickyInkRegion,
  resolveStickyBodyRects,
} from '../lib/sticky/sticky-ink-region';

const WIDTHS = [1, 2, 4, 8] as const;
const COMPACT_TOOLBAR_WIDTH = 200;

type StickyTool = 'text' | 'pen' | 'highlighter' | 'eraser';

interface StickyNoteEditorProps {
  text: string;
  strokes: BoardStickyInkStroke[];
  inkRegion?: StickyInkRegion;
  width: number;
  height: number;
  selected: boolean;
  locked?: boolean;
  onTextChange: (text: string) => void;
  onTextFocus?: () => void;
  onTextBlur?: () => void;
  onStrokesChange: (strokes: BoardStickyInkStroke[]) => void;
  onInkRegionChange?: (region: StickyInkRegion) => void;
  onDragHandlePointerDown: (e: React.PointerEvent) => void;
  onSelectPointerDown: (e: React.PointerEvent) => void;
}

export function StickyNoteEditor({
  text,
  strokes,
  inkRegion,
  width,
  height,
  selected,
  locked,
  onTextChange,
  onTextFocus,
  onTextBlur,
  onStrokesChange,
  onInkRegionChange,
  onDragHandlePointerDown,
  onSelectPointerDown,
}: StickyNoteEditorProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const [tool, setTool] = useState<StickyTool>('text');
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(2);
  const drawingRef = useRef<BoardStickyInkStroke | null>(null);
  const [, bump] = useState(0);

  const compactToolbar = width < COMPACT_TOOLBAR_WIDTH;
  const bodyW = Math.max(1, width);
  const bodyH = Math.max(1, height - STICKY_HEADER_H);
  const region = useMemo(() => normalizeStickyInkRegion(inkRegion), [inkRegion]);
  const layout = useMemo(() => resolveStickyBodyRects(bodyW, bodyH, region), [bodyW, bodyH, region]);

  const resizeCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return false;
    const cssW = Math.max(1, layout.ink.w);
    const cssH = Math.max(1, layout.ink.h);
    if (canvasSizeRef.current.w === cssW && canvasSizeRef.current.h === cssH && c.width > 0) {
      return false;
    }
    canvasSizeRef.current = { w: cssW, h: cssH };
    const { width: pxW, height: pxH, dpr } = stickyCanvasDprSize(cssW, cssH);
    c.width = pxW;
    c.height = pxH;
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    const ctx = c.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }, [layout.ink.w, layout.ink.h]);

  const paintCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    resizeCanvas();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const cw = Math.max(1, layout.ink.w);
    const ch = Math.max(1, layout.ink.h);
    ctx.clearRect(0, 0, cw, ch);
    const all = drawingRef.current ? [...strokes, drawingRef.current] : strokes;
    for (const s of all) {
      if (s.points.length < 1) continue;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.tool === 'eraser' ? '#fef08a' : s.color;
      ctx.lineWidth = s.width;
      ctx.globalAlpha = s.opacity ?? (s.tool === 'highlighter' ? 0.35 : 1);
      ctx.beginPath();
      const first = mapBodyPointToInkPixels(s.points[0], s.normalized, bodyW, bodyH, layout.ink);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < s.points.length; i++) {
        const p = mapBodyPointToInkPixels(s.points[i], s.normalized, bodyW, bodyH, layout.ink);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [strokes, resizeCanvas, layout.ink, bodyW, bodyH]);

  useEffect(() => {
    paintCanvas();
  }, [paintCanvas, width, height, selected, region]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const ro = new ResizeObserver(() => paintCanvas());
    ro.observe(body);
    return () => ro.disconnect();
  }, [paintCanvas]);

  const toNormalized = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const body = bodyRef.current;
    if (!canvas || !body) return null;
    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
    const nx = (e.clientX - canvasRect.left) / canvasRect.width;
    const ny = (e.clientY - canvasRect.top) / canvasRect.height;
    const bodyLocalX = layout.ink.x + nx * layout.ink.w;
    const bodyLocalY = layout.ink.y + ny * layout.ink.h;
    return {
      x: Math.min(1, Math.max(0, bodyLocalX / bodyW)),
      y: Math.min(1, Math.max(0, bodyLocalY / bodyH)),
    };
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!selected || locked || tool === 'text') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toNormalized(e);
    if (!pt) return;
    drawingRef.current = {
      id: createId(),
      color: tool === 'eraser' ? '' : color,
      width: lineWidth,
      tool: tool === 'highlighter' ? 'highlighter' : tool === 'eraser' ? 'eraser' : 'pen',
      opacity: tool === 'highlighter' ? 0.35 : 1,
      normalized: true,
      points: [pt],
    };
    bump((n) => n + 1);
    paintCanvas();
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const pt = toNormalized(e);
    if (!pt) return;
    const last = drawingRef.current.points[drawingRef.current.points.length - 1];
    if (last && Math.hypot(last.x - pt.x, last.y - pt.y) < 0.002) return;
    drawingRef.current = { ...drawingRef.current, points: [...drawingRef.current.points, pt] };
    paintCanvas();
  };

  const finishStroke = () => {
    if (!drawingRef.current || drawingRef.current.points.length < 2) {
      drawingRef.current = null;
      paintCanvas();
      return;
    }
    if (drawingRef.current.tool === 'eraser') {
      const hit = drawingRef.current.points[drawingRef.current.points.length - 1];
      const hitR = drawingRef.current.width / Math.max(bodyW, bodyH);
      const next = strokes.filter((s) => {
        return !s.points.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < hitR * 4);
      });
      onStrokesChange(next);
    } else {
      onStrokesChange([...strokes, drawingRef.current]);
    }
    drawingRef.current = null;
    paintCanvas();
  };

  const setLayout = (layoutMode: StickyInkLayout) => {
    if (!onInkRegionChange) return;
    const next = normalizeStickyInkRegion({ ...region, layout: layoutMode });
    if (layoutMode === 'overlay') {
      onInkRegionChange({ ...next, x: 0, y: 0, w: 1, h: 1 });
    } else if (layoutMode === 'wrap-start' || layoutMode === 'wrap-end') {
      onInkRegionChange({ ...next, x: 0, y: 0, w: Math.max(0.35, region.w), h: 1 });
    } else {
      onInkRegionChange({ ...next, x: 0, y: 0, w: 1, h: Math.max(0.35, region.h) });
    }
  };

  const expandInkToFull = () => {
    onInkRegionChange?.({ ...DEFAULT_STICKY_INK_REGION });
  };

  const onInkResizePointerDown = (e: React.PointerEvent) => {
    if (!selected || locked || tool === 'text' || !onInkRegionChange) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...region };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / bodyW;
      const dy = (ev.clientY - startY) / bodyH;
      let next = { ...start };
      if (start.layout === 'overlay') {
        next = normalizeStickyInkRegion({
          ...start,
          w: start.w + dx,
          h: start.h + dy,
        });
      } else if (start.layout === 'wrap-start' || start.layout === 'wrap-end') {
        next = normalizeStickyInkRegion({ ...start, w: start.w + dx });
      } else {
        next = normalizeStickyInkRegion({ ...start, h: start.h + dy });
      }
      onInkRegionChange(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onInkMovePointerDown = (e: React.PointerEvent) => {
    if (!selected || locked || tool === 'text' || region.layout !== 'overlay' || !onInkRegionChange) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...region };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / bodyW;
      const dy = (ev.clientY - startY) / bodyH;
      onInkRegionChange(
        normalizeStickyInkRegion({
          ...start,
          x: start.x + dx,
          y: start.y + dy,
        })
      );
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const inkActive = selected && !locked && tool !== 'text';
  const showInkChrome = inkActive && (region.layout !== 'overlay' || region.w < 0.99 || region.h < 0.99);

  const toolBtn = (id: StickyTool, icon: React.ReactNode, label: string) => (
    <button
      key={id}
      type="button"
      className={cn('rounded p-0.5', tool === id && 'bg-black/10')}
      onClick={() => setTool(id)}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );

  const inkOptions = tool !== 'text' && tool !== 'eraser' && (
    <div className="mt-2 space-y-2 border-t border-muted pt-2">
      <BoardColorPickerCompact value={color} onChange={setColor} className="mb-1.5" />
      <div className="flex flex-wrap gap-0.5">
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            className={cn(
              'min-w-[1.25rem] rounded px-1 text-[10px]',
              lineWidth === w ? 'bg-black/15 font-medium' : ''
            )}
            onClick={() => setLineWidth(w)}
          >
            {w}
          </button>
        ))}
      </div>
      {onInkRegionChange ? (
        <>
          <p className="text-[10px] font-medium text-gray-500">
            {t('boards.sticky.ink.layout', 'Drawing area')}
          </p>
          <div className="flex flex-col gap-0.5">
            {STICKY_INK_LAYOUTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'rounded px-1.5 py-0.5 text-start text-[10px] hover:bg-black/5',
                  region.layout === opt.value && 'bg-black/10 font-medium'
                )}
                onClick={() => setLayout(opt.value)}
              >
                {t(opt.labelKey, opt.fallback)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-black/5"
            onClick={expandInkToFull}
          >
            <PiArrowsOut className="size-3" />
            {t('boards.sticky.ink.expandFull', 'Use full note')}
          </button>
        </>
      ) : null}
    </div>
  );

  const toolRow = (
    <div className="flex items-center gap-0.5">
      {toolBtn('text', <PiTextT className="size-3.5" />, t('boards.sticky.ink.text', 'Text'))}
      {toolBtn('pen', <PiPencilLine className="size-3.5" />, t('boards.sticky.ink.pen', 'Pen'))}
      {toolBtn(
        'highlighter',
        <PiHighlighterCircle className="size-3.5" />,
        t('boards.sticky.ink.highlighter', 'Highlighter')
      )}
      {toolBtn('eraser', <PiEraser className="size-3.5" />, t('boards.sticky.ink.eraser', 'Eraser'))}
    </div>
  );

  const toolbar = selected && !locked && (
    <div className="ms-auto shrink-0" onPointerDown={(e) => e.stopPropagation()}>
      {compactToolbar ? (
        <Dropdown>
          <Dropdown.Trigger>
            <button
              type="button"
              className={cn(
                'flex items-center rounded p-0.5 hover:bg-black/10',
                tool !== 'text' && 'bg-black/10'
              )}
              aria-label={t('boards.sticky.toolsMenu', 'Note tools')}
              title={t('boards.sticky.toolsMenu', 'Note tools')}
            >
              <PiDotsThreeVertical className="size-3.5" />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Menu className="min-w-[160px] p-2">
            <p className="mb-1.5 text-[10px] font-medium text-gray-500">
              {t('boards.sticky.toolsMenu', 'Note tools')}
            </p>
            {toolRow}
            {inkOptions}
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-0.5">
          {toolRow}
          {tool !== 'text' && tool !== 'eraser' ? (
            <>
              <BoardColorPickerCompact value={color} onChange={setColor} />
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={cn(
                    'shrink-0 rounded px-0.5 text-[8px]',
                    lineWidth === w ? 'bg-black/15' : ''
                  )}
                  onClick={() => setLineWidth(w)}
                >
                  {w}
                </button>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );

  const textArea = (
    <textarea
      className={cn(
        'resize-none bg-transparent p-2 text-xs text-gray-800 outline-none',
        layout.textBehindInk && inkActive && 'pointer-events-none'
      )}
      style={{
        position: 'absolute',
        left: layout.text.x,
        top: layout.text.y,
        width: layout.text.w,
        height: layout.text.h,
      }}
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
      onFocus={() => onTextFocus?.()}
      onBlur={() => onTextBlur?.()}
      onPointerDown={(e) => {
        if (!selected) {
          onSelectPointerDown(e);
          return;
        }
        e.stopPropagation();
      }}
      placeholder={t('boards.sticky.placeholder', 'Write a note…')}
      readOnly={!selected || locked || tool !== 'text'}
    />
  );

  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden"
      style={{ width, height }}
      onPointerDown={(e) => {
        if (!selected) onSelectPointerDown(e);
      }}
    >
      <div
        className="flex shrink-0 cursor-grab items-center gap-0.5 overflow-hidden border-b border-black/10 px-1 py-0.5"
        style={{ height: STICKY_HEADER_H }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!locked) onDragHandlePointerDown(e);
          onSelectPointerDown(e);
        }}
      >
        <span className="min-w-0 truncate px-0.5 text-[10px] font-medium text-gray-700">
          {compactToolbar ? '…' : t('boards.sticky.label', 'Sticky')}
        </span>
        {toolbar}
      </div>

      <div
        ref={bodyRef}
        className="relative min-h-0 min-w-0 shrink-0 overflow-hidden"
        style={{ width: bodyW, height: bodyH }}
      >
        {textArea}

        <div
          className={cn(
            'absolute overflow-hidden',
            showInkChrome && 'rounded-sm border border-dashed border-gray-500/70 bg-white/20'
          )}
          style={{
            left: layout.ink.x,
            top: layout.ink.y,
            width: layout.ink.w,
            height: layout.ink.h,
          }}
          onPointerDown={region.layout === 'overlay' && inkActive ? onInkMovePointerDown : undefined}
        >
          <canvas
            ref={canvasRef}
            className={cn('block', inkActive ? 'cursor-crosshair' : 'pointer-events-none')}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={() => finishStroke()}
            onPointerLeave={() => finishStroke()}
          />
          {inkActive && onInkRegionChange ? (
            <button
              type="button"
              className="absolute bottom-0 end-0 z-10 size-3 cursor-se-resize border-0 bg-transparent p-0"
              aria-label={t('boards.sticky.ink.resize', 'Resize drawing area')}
              title={t('boards.sticky.ink.resize', 'Resize drawing area')}
              onPointerDown={onInkResizePointerDown}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
