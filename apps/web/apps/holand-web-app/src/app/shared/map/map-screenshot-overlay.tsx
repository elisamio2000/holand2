// ============================================
// shared / map / map-screenshot-overlay.tsx
// Interactive "screenshot a region of the map" overlay.
//
// UX:
//   1. User clicks a camera button anywhere on the page.
//   2. The whole viewport (except the chosen map container) is dimmed.
//   3. A movable / resizable rectangle is drawn over the map; default size
//      = the inner third of the map. User can drag the rect to move it,
//      or drag any of the 8 handles to resize.
//   4. "Capture" reads pixels from the MapLibre canvas (which has
//      preserveDrawingBuffer:true), crops to the rectangle, and downloads
//      a PNG. ESC or "Cancel" exits with no capture.
// ============================================
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PiCameraBold, PiXBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import type { MapCoreRef } from './map-core';

export interface MapScreenshotOverlayProps {
  /** Map handle from MapCore — we read the canvas + container from this. */
  mapRef: React.MutableRefObject<MapCoreRef | null>;
  /** Toggle visibility from the parent toolbar. */
  open: boolean;
  /** Called when user closes the overlay (cancel or after capture). */
  onClose: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode = 'none' | 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Min size for the selection rectangle (px). Avoids zero-area screenshots. */
const MIN_RECT = 60;
/** Edge handle size (px). */
const HANDLE = 14;

/**
 * MapScreenshotOverlay — Region-select PNG capture for the underlying map.
 *
 * Why DOM portal: the dim layer + selection rect must sit on top of EVERY
 * sibling on the page (toolbars, panels, headers) — a portal to <body>
 * is the simplest way to ignore the parent's stacking context.
 *
 * Why pixel-coords: we resolve the rectangle in viewport pixels, then
 * convert to canvas-local pixels using the map canvas's bounding box and
 * its devicePixelRatio. This avoids relying on map.project() which is
 * meant for geographic coords, not screen pixels.
 */
export default function MapScreenshotOverlay({ mapRef, open, onClose }: MapScreenshotOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  /** Bounding rect of the map container in viewport coords. The rectangle
   *  is constrained to stay inside this. Recomputed on resize / scroll. */
  const [mapBounds, setMapBounds] = useState<DOMRect | null>(null);
  const dragModeRef = useRef<DragMode>('none');
  /** Pointer position + rect at the moment a drag started. */
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; rect: Rect } | null>(null);

  // Initialise bounds + default rectangle each time we open.
  useEffect(() => {
    if (!open) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const recompute = () => {
      const canvas = map.getCanvas();
      const cb = canvas.getBoundingClientRect();
      setMapBounds(cb);
      // Default selection: middle 60% of the map, capped to a reasonable size.
      const defaultW = Math.max(MIN_RECT, Math.round(cb.width * 0.6));
      const defaultH = Math.max(MIN_RECT, Math.round(cb.height * 0.6));
      setRect({
        x: cb.left + (cb.width - defaultW) / 2,
        y: cb.top + (cb.height - defaultH) / 2,
        w: defaultW,
        h: defaultH,
      });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, mapRef]);

  // ESC to cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        capture();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rect, mapBounds]);

  /** Clamp rect inside map bounds, enforcing min size. */
  const clampRect = useCallback(
    (r: Rect): Rect => {
      if (!mapBounds) return r;
      let { x, y, w, h } = r;
      w = Math.max(MIN_RECT, Math.min(w, mapBounds.width));
      h = Math.max(MIN_RECT, Math.min(h, mapBounds.height));
      x = Math.max(mapBounds.left, Math.min(x, mapBounds.right - w));
      y = Math.max(mapBounds.top, Math.min(y, mapBounds.bottom - h));
      return { x, y, w, h };
    },
    [mapBounds]
  );

  // Pointer events on the rectangle / handles.
  const onPointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (!rect) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragModeRef.current = mode;
      dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, rect: { ...rect } };
    },
    [rect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const mode = dragModeRef.current;
      const start = dragStartRef.current;
      if (mode === 'none' || !start) return;
      const dx = e.clientX - start.pointerX;
      const dy = e.clientY - start.pointerY;
      const r = { ...start.rect };
      if (mode === 'move') {
        r.x += dx;
        r.y += dy;
      } else {
        // Resize handles — adjust the relevant edges, keeping opposite anchored.
        if (mode.includes('e')) r.w = start.rect.w + dx;
        if (mode.includes('s')) r.h = start.rect.h + dy;
        if (mode.includes('w')) {
          r.x = start.rect.x + dx;
          r.w = start.rect.w - dx;
        }
        if (mode.includes('n')) {
          r.y = start.rect.y + dy;
          r.h = start.rect.h - dy;
        }
        // Disallow inverted rectangles by snapping to MIN_RECT before clamping.
        if (r.w < MIN_RECT) {
          if (mode.includes('w')) r.x = r.x + r.w - MIN_RECT;
          r.w = MIN_RECT;
        }
        if (r.h < MIN_RECT) {
          if (mode.includes('n')) r.y = r.y + r.h - MIN_RECT;
          r.h = MIN_RECT;
        }
      }
      setRect(clampRect(r));
    },
    [clampRect]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragModeRef.current === 'none') return;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* the element might already have lost capture — safe to ignore */
    }
    dragModeRef.current = 'none';
    dragStartRef.current = null;
  }, []);

  /** Crop the MapLibre canvas to the selected rectangle and download as PNG. */
  const capture = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !rect || !mapBounds) {
      toast.error('Map is not ready.');
      return;
    }
    const sourceCanvas = map.getCanvas();
    // Convert viewport-space rect → canvas-local rect, accounting for HiDPI.
    // We re-read the canvas bounds at capture-time so it works after zoom/pan.
    const cb = sourceCanvas.getBoundingClientRect();
    const scaleX = sourceCanvas.width / cb.width;
    const scaleY = sourceCanvas.height / cb.height;
    const sx = Math.max(0, Math.round((rect.x - cb.left) * scaleX));
    const sy = Math.max(0, Math.round((rect.y - cb.top) * scaleY));
    const sw = Math.min(sourceCanvas.width - sx, Math.round(rect.w * scaleX));
    const sh = Math.min(sourceCanvas.height - sy, Math.round(rect.h * scaleY));
    if (sw <= 0 || sh <= 0) {
      toast.error('Invalid screenshot region.');
      return;
    }

    /** Read the cropped image and download. MUST run synchronously inside
     *  the same frame MapLibre painted, otherwise the WebGL back-buffer
     *  is cleared by the browser compositor and we'd capture a blank PNG. */
    const doCapture = () => {
      try {
        const out = document.createElement('canvas');
        out.width = sw;
        out.height = sh;
        const ctx = out.getContext('2d');
        if (!ctx) {
          toast.error('Canvas not available.');
          return;
        }
        ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
        // Sanity check — sniff the centre pixel; if alpha is 0 the buffer
        // was cleared and we'd hand the user a blank image. Warn instead.
        try {
          const probe = ctx.getImageData(Math.floor(sw / 2), Math.floor(sh / 2), 1, 1).data;
          if (probe[0] === 0 && probe[1] === 0 && probe[2] === 0 && probe[3] === 0) {
            console.warn('[MapScreenshot] back-buffer appears empty; output may be blank');
          }
        } catch {
          /* getImageData can throw on tainted canvas — ignore */
        }
        out.toBlob((blob) => {
          if (!blob) {
            toast.error('Could not produce PNG (browser security).');
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `map-screenshot-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Saved PNG');
          console.info('[MapScreenshot] Saved PNG', { sw, sh, sx, sy });
          onClose();
        }, 'image/png');
      } catch (err) {
        console.error('[MapScreenshot] capture failed:', err);
        toast.error('Capture failed.');
      }
    };

    // Force MapLibre to fully repaint, THEN read the canvas synchronously
    // inside the same frame (no extra rAF — that would let the browser
    // clear the back-buffer first). The 'render' event fires after every
    // frame; combined with triggerRepaint() this guarantees we read a
    // frame that contains the current map content.
    map.once('render', () => {
      doCapture();
    });
    map.triggerRepaint();
  }, [mapRef, rect, mapBounds, onClose]);

  if (!open || !mapBounds || !rect || typeof document === 'undefined') return null;

  // ==========================================
  // Render — portal to body so we cover everything
  // ==========================================

  // 8 resize handles + the rectangle itself. The rectangle has pointer-events
  // ENABLED (so dragging it moves the selection); the dim layer beneath also
  // accepts clicks to absorb stray pointer events.
  const handles: Array<{ mode: DragMode; cursor: string; x: number; y: number }> = [
    { mode: 'nw', cursor: 'nwse-resize', x: rect.x - HANDLE / 2, y: rect.y - HANDLE / 2 },
    { mode: 'n', cursor: 'ns-resize', x: rect.x + rect.w / 2 - HANDLE / 2, y: rect.y - HANDLE / 2 },
    { mode: 'ne', cursor: 'nesw-resize', x: rect.x + rect.w - HANDLE / 2, y: rect.y - HANDLE / 2 },
    { mode: 'e', cursor: 'ew-resize', x: rect.x + rect.w - HANDLE / 2, y: rect.y + rect.h / 2 - HANDLE / 2 },
    { mode: 'se', cursor: 'nwse-resize', x: rect.x + rect.w - HANDLE / 2, y: rect.y + rect.h - HANDLE / 2 },
    { mode: 's', cursor: 'ns-resize', x: rect.x + rect.w / 2 - HANDLE / 2, y: rect.y + rect.h - HANDLE / 2 },
    { mode: 'sw', cursor: 'nesw-resize', x: rect.x - HANDLE / 2, y: rect.y + rect.h - HANDLE / 2 },
    { mode: 'w', cursor: 'ew-resize', x: rect.x - HANDLE / 2, y: rect.y + rect.h / 2 - HANDLE / 2 },
  ];

  return createPortal(
    <div
      // Full-viewport overlay. Pointer-events:none on the root so the map
      // underneath stays interactive (zoom / pan) — children re-enable
      // pointer-events as needed (rectangle, handles, toolbar).
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Four dim panels around the selection rectangle. They visually dim
          the page but ALSO leave pointer-events disabled — so wheel/scroll
          falls through to the map for zoom + pan. */}
      <div
        className="absolute bg-black/55 backdrop-blur-[1px]"
        style={{ left: 0, top: 0, right: 0, height: rect.y, pointerEvents: 'none' }}
      />
      <div
        className="absolute bg-black/55 backdrop-blur-[1px]"
        style={{ left: 0, top: rect.y + rect.h, right: 0, bottom: 0, pointerEvents: 'none' }}
      />
      <div
        className="absolute bg-black/55 backdrop-blur-[1px]"
        style={{ left: 0, top: rect.y, width: rect.x, height: rect.h, pointerEvents: 'none' }}
      />
      <div
        className="absolute bg-black/55 backdrop-blur-[1px]"
        style={{ left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h, pointerEvents: 'none' }}
      />

      {/* The selection rectangle — visual only (border + ring); pointer
          events are concentrated on a thin draggable border strip below
          so the centre stays click-through to the map underneath. */}
      <div
        className="pointer-events-none absolute border-2 border-blue-400 ring-1 ring-white/40"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          background: 'transparent',
        }}
      />
      {/* Four invisible drag-strips along each edge of the rectangle. They
          let the user grab the rectangle by its border to move it WITHOUT
          blocking the map zoom/pan in the visible centre. */}
      {(() => {
        const STRIP = 10; // px thick draggable edge band
        return (
          <>
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              style={{
                left: rect.x - STRIP / 2,
                top: rect.y - STRIP / 2,
                width: rect.w + STRIP,
                height: STRIP,
                position: 'absolute',
                cursor: 'move',
                pointerEvents: 'auto',
              }}
            />
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              style={{
                left: rect.x - STRIP / 2,
                top: rect.y + rect.h - STRIP / 2,
                width: rect.w + STRIP,
                height: STRIP,
                position: 'absolute',
                cursor: 'move',
                pointerEvents: 'auto',
              }}
            />
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              style={{
                left: rect.x - STRIP / 2,
                top: rect.y - STRIP / 2,
                width: STRIP,
                height: rect.h + STRIP,
                position: 'absolute',
                cursor: 'move',
                pointerEvents: 'auto',
              }}
            />
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              style={{
                left: rect.x + rect.w - STRIP / 2,
                top: rect.y - STRIP / 2,
                width: STRIP,
                height: rect.h + STRIP,
                position: 'absolute',
                cursor: 'move',
                pointerEvents: 'auto',
              }}
            />
          </>
        );
      })()}

      {/* 8 resize handles */}
      {handles.map((h) => (
        <div
          key={h.mode}
          onPointerDown={(e) => onPointerDown(e, h.mode)}
          className="absolute rounded-sm bg-white shadow ring-1 ring-blue-500"
          style={{
            left: h.x,
            top: h.y,
            width: HANDLE,
            height: HANDLE,
            cursor: h.cursor,
            pointerEvents: 'auto',
          }}
        />
      ))}

      {/* Floating action bar above the rectangle */}
      <div
        className="absolute flex items-center gap-2 rounded-lg bg-gray-900/90 px-2 py-1.5 text-xs text-white shadow-lg backdrop-blur"
        style={{
          left: rect.x,
          top: Math.max(8, rect.y - 44),
          pointerEvents: 'auto',
        }}
      >
        <span className="px-1 text-[10px] uppercase tracking-wider text-gray-300">
          {Math.round(rect.w)} × {Math.round(rect.h)} px
        </span>
        <button
          onClick={capture}
          title="Save selected region as PNG (Enter)"
          className="flex items-center gap-1 rounded bg-blue-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-600"
        >
          <PiCameraBold className="h-3.5 w-3.5" />
          Capture
        </button>
        <button
          onClick={onClose}
          title="Cancel (Esc)"
          className="flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-[11px] font-medium text-gray-200 transition hover:bg-gray-600"
        >
          <PiXBold className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>

      {/* Hint shown bottom-center */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-md bg-gray-900/85 px-3 py-1.5 text-[11px] text-gray-200 shadow-lg backdrop-blur"
        style={{ bottom: 24, pointerEvents: 'auto' }}
      >
        Map stays interactive — zoom & pan inside the box · drag the border to move · drag handles to resize ·{' '}
        <kbd className="rounded bg-gray-700 px-1">Enter</kbd> to capture ·{' '}
        <kbd className="rounded bg-gray-700 px-1">Esc</kbd> to cancel
      </div>
    </div>,
    document.body
  );
}
