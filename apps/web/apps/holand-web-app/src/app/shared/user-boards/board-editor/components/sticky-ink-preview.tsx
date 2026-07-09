'use client';

import { useEffect, useMemo, useRef } from 'react';
import cn from '@core/utils/class-names';
import type { BoardStickyInkStroke, StickyInkRegion } from '../../lib/board-types';
import {
  STICKY_HEADER_H,
  STICKY_INK_PREVIEW_MAX_H,
  STICKY_INK_PREVIEW_MAX_W,
  computeStickyInkPreviewLayout,
  mapBodyPointToInkPixels,
  mapInkLocalToPreview,
  normalizeStickyInkRegion,
  resolveStickyBodyRects,
} from '../../lib/sticky/sticky-ink-region';
import { stickyCanvasDprSize } from '../../lib/sticky/sticky-coords';

interface StickyInkPreviewProps {
  strokes: BoardStickyInkStroke[];
  width: number;
  height: number;
  backgroundColor: string;
  inkRegion?: StickyInkRegion;
  className?: string;
}

/**
 * Inspector ink thumbnail — minimap-style: fixed max size, fit-to-content so all
 * strokes stay visible even when the sticky note is very large.
 */
export function StickyInkPreview({
  strokes,
  width,
  height,
  backgroundColor,
  inkRegion,
  className,
}: StickyInkPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyW = Math.max(1, width);
  const bodyH = Math.max(1, height - STICKY_HEADER_H);
  const region = useMemo(() => normalizeStickyInkRegion(inkRegion), [inkRegion]);
  const layout = useMemo(() => resolveStickyBodyRects(bodyW, bodyH, region), [bodyW, bodyH, region]);
  const preview = useMemo(
    () => computeStickyInkPreviewLayout(bodyW, bodyH, layout.ink, strokes),
    [bodyW, bodyH, layout.ink, strokes]
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const cw = preview.canvasW;
    const ch = preview.canvasH;
    const { width: pxW, height: pxH, dpr } = stickyCanvasDprSize(cw, ch);
    c.width = pxW;
    c.height = pxH;
    c.style.width = `${cw}px`;
    c.style.height = `${ch}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, cw, ch);

    const inkPreviewRect = {
      x: preview.offsetX,
      y: preview.offsetY,
      w: layout.ink.w * preview.scale,
      h: layout.ink.h * preview.scale,
    };
    ctx.fillStyle = backgroundColor;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(inkPreviewRect.x, inkPreviewRect.y, inkPreviewRect.w, inkPreviewRect.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(inkPreviewRect.x, inkPreviewRect.y, inkPreviewRect.w, inkPreviewRect.h);

    for (const s of strokes) {
      if (s.points.length < 1) continue;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.tool === 'eraser' ? backgroundColor : s.color;
      ctx.lineWidth = Math.max(0.5, s.width * preview.scale);
      ctx.globalAlpha = s.opacity ?? (s.tool === 'highlighter' ? 0.35 : 1);
      ctx.beginPath();
      const firstLocal = mapBodyPointToInkPixels(s.points[0], s.normalized, bodyW, bodyH, layout.ink);
      const first = mapInkLocalToPreview(firstLocal, preview);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < s.points.length; i++) {
        const local = mapBodyPointToInkPixels(s.points[i], s.normalized, bodyW, bodyH, layout.ink);
        const p = mapInkLocalToPreview(local, preview);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [strokes, bodyW, bodyH, backgroundColor, layout.ink, preview]);

  if (!strokes.length) return null;

  return (
    <canvas
      ref={canvasRef}
      className={cn('shrink-0 rounded border border-muted', className)}
      style={{
        width: preview.canvasW,
        height: preview.canvasH,
        maxWidth: STICKY_INK_PREVIEW_MAX_W,
        maxHeight: STICKY_INK_PREVIEW_MAX_H,
      }}
      aria-label="Sticky ink preview"
    />
  );
}
