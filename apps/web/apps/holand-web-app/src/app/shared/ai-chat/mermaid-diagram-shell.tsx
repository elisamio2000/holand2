'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react';
import {
  PiArrowsOut,
  PiMagnifyingGlassMinus,
  PiMagnifyingGlassPlus,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import { getMermaidExportBackgroundColor } from '@/app/shared/ai-chat/mermaid-render-config';
import { patchMermaidSvgLabels } from '@/utils/mermaid-svg-labels';

const SCALE_MIN = 0.35;
/** Max zoom as scale factor (6 = 600% in toolbar). */
const SCALE_MAX = 6;

export function clampMermaidScale(s: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(s * 100) / 100));
}

/** Fit rendered SVG to the scroll container width (uses viewBox width when present). */
export function mermaidFitToWidth(
  scrollEl: HTMLDivElement | null,
  innerEl: HTMLElement | null,
  setScale: (n: number) => void
): void {
  if (!scrollEl || !innerEl) return;
  const svg = innerEl.querySelector('svg');
  if (!svg) return;
  let w = svg.clientWidth || 400;
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0) w = vb.width;
  const cw = scrollEl.clientWidth - 32;
  if (!cw || !w) return;
  const next = Math.max(SCALE_MIN, Math.min(SCALE_MAX, (cw / w) * 0.96));
  setScale(Math.round(next * 100) / 100);
}

function resolveMermaidSvgExportSize(svgEl: SVGSVGElement): { w: number; h: number } {
  const vb = svgEl.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { w: Math.ceil(vb.width), h: Math.ceil(vb.height) };
  }
  const attrW = parseFloat(svgEl.getAttribute('width') || '');
  const attrH = parseFloat(svgEl.getAttribute('height') || '');
  if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
    return { w: Math.ceil(attrW), h: Math.ceil(attrH) };
  }
  const r = svgEl.getBoundingClientRect();
  return {
    w: Math.max(1, Math.round(r.width)),
    h: Math.max(1, Math.round(r.height)),
  };
}

function prepareMermaidSvgForRasterExport(svgEl: SVGSVGElement): {
  svg: SVGSVGElement;
  w: number;
  h: number;
} {
  const { w, h } = resolveMermaidSvgExportSize(svgEl);
  const svg = svgEl.cloneNode(true) as SVGSVGElement;
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.querySelectorAll('script').forEach((n) => n.remove());

  const fontFamily =
    typeof window !== 'undefined'
      ? getComputedStyle(document.body).fontFamily || 'inherit'
      : 'inherit';
  svg.setAttribute('font-family', fontFamily);

  if (!svg.getAttribute('viewBox')) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.style.maxWidth = 'none';
  svg.style.width = `${w}px`;
  svg.style.height = `${h}px`;

  ensureSvgReadableForRasterExport(svg);

  return { svg, w, h };
}

/** Avoid invisible labels in exported PNG/JPG (inherits currentColor / theme CSS). */
function ensureSvgReadableForRasterExport(svg: SVGSVGElement): void {
  patchMermaidSvgLabels(svg);
}

export type MermaidRasterFormat = 'png' | 'jpeg';

function triggerBlobDownload(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Rasterize the rendered Mermaid SVG to PNG or JPEG and download.
 */
export async function mermaidDownloadRaster(
  innerRoot: HTMLElement | null,
  format: MermaidRasterFormat
): Promise<void> {
  if (!innerRoot || typeof window === 'undefined') {
    throw new Error('Nothing to export');
  }
  patchMermaidSvgLabels(innerRoot);
  const svgEl = innerRoot.querySelector('svg');
  if (!svgEl) {
    throw new Error('No diagram to export');
  }

  const { svg, w, h } = prepareMermaidSvgForRasterExport(svgEl);

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(svg);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Browser could not rasterize the SVG'));
    img.src = src;
  });

  await img.decode().catch(() => undefined);

  let dw = img.naturalWidth;
  let dh = img.naturalHeight;
  if (!dw || !dh) {
    dw = w;
    dh = h;
  }

  const exportScale = Math.min(4, Math.max(3, (window.devicePixelRatio || 1) * 2));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(dw * exportScale));
  canvas.height = Math.max(1, Math.floor(dh * exportScale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not available');
  }
  ctx.fillStyle = getMermaidExportBackgroundColor();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, dw, dh);

  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';
  const quality = format === 'jpeg' ? 0.92 : undefined;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error(`${ext.toUpperCase()} encoding failed`));
          return;
        }
        resolve(b);
      },
      mime,
      quality
    );
  });

  triggerBlobDownload(blob, `mermaid-diagram-${Date.now()}.${ext}`);
}

/** @deprecated Use `mermaidDownloadRaster(innerRoot, 'png')` */
export async function mermaidDownloadPng(innerRoot: HTMLElement | null): Promise<void> {
  return mermaidDownloadRaster(innerRoot, 'png');
}

export async function mermaidDownloadJpeg(innerRoot: HTMLElement | null): Promise<void> {
  return mermaidDownloadRaster(innerRoot, 'jpeg');
}

export interface MermaidZoomToolbarProps {
  scale: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  innerRef: RefObject<HTMLDivElement | null>;
  onScaleChange: (n: number) => void;
  className?: string;
}

/**
 * Compact zoom / fit / PNG actions — place in the block or canvas header.
 */
export function MermaidZoomToolbar({
  scale,
  scrollRef,
  innerRef,
  onScaleChange,
  className,
}: MermaidZoomToolbarProps) {
  const zoomIn = useCallback(() => {
    onScaleChange(clampMermaidScale(scale + 0.15));
  }, [onScaleChange, scale]);

  const zoomOut = useCallback(() => {
    onScaleChange(clampMermaidScale(scale - 0.15));
  }, [onScaleChange, scale]);

  const resetZoom = useCallback(() => onScaleChange(1), [onScaleChange]);

  const fitToWidth = useCallback(() => {
    mermaidFitToWidth(scrollRef.current, innerRef.current, onScaleChange);
  }, [innerRef, onScaleChange, scrollRef]);

  const downloadRaster = useCallback(
    (format: MermaidRasterFormat) => {
      void mermaidDownloadRaster(innerRef.current, format).catch((err: unknown) => {
        console.error('[MermaidZoomToolbar] Image export failed:', err);
        const label = format === 'png' ? 'PNG' : 'JPG';
        toast.error(err instanceof Error ? err.message : `${label} export failed`);
      });
    },
    [innerRef]
  );

  const pct = Math.round(scale * 100);

  return (
    <div className={cn('flex flex-wrap items-center gap-0.5', className)}>
      <button
        type="button"
        onClick={zoomOut}
        className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
        title="Zoom out"
      >
        <PiMagnifyingGlassMinus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={zoomIn}
        className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
        title="Zoom in"
      >
        <PiMagnifyingGlassPlus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={resetZoom}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
        title="Reset zoom (100%)"
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={fitToWidth}
        className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-300"
        title="Fit to width"
      >
        <PiArrowsOut className="h-3.5 w-3.5" />
      </button>
      <div
        className="flex items-center gap-px rounded-md border border-muted/70 bg-gray-0/80 p-0.5 dark:bg-gray-50/50"
        role="group"
        aria-label="Download diagram image"
      >
        <button
          type="button"
          onClick={() => downloadRaster('png')}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-200"
          title="Download PNG"
        >
          PNG
        </button>
        <button
          type="button"
          onClick={() => downloadRaster('jpeg')}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-200/30 dark:hover:text-gray-200"
          title="Download JPG"
        >
          JPG
        </button>
      </div>
    </div>
  );
}

export type MermaidWheelZoomMode = 'off' | 'on';
export type MermaidDiagramShellVariant = 'standalone' | 'embedded';

interface MermaidDiagramShellProps {
  /** Inline SVG HTML from `mermaid.render` */
  svgHtml: string;
  /** Zoom factor (1 = 100%) */
  scale: number;
  onScaleChange: (n: number) => void;
  /** Optional refs for toolbar actions (fit / PNG) */
  scrollRef?: RefObject<HTMLDivElement | null>;
  innerRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  /**
   * `off` — chat inline: no wheel zoom (toolbar only). `on` — expanded canvas modal only.
   */
  wheelZoom?: MermaidWheelZoomMode;
  /** `embedded` — lighter chrome inside markdown documents */
  shellVariant?: MermaidDiagramShellVariant;
}

/**
 * Centered scrollable viewport; optional wheel zoom when `wheelZoom="on"`; drag pan when zoomed in.
 */
export default function MermaidDiagramShell({
  svgHtml,
  scale,
  onScaleChange,
  scrollRef: scrollRefProp,
  innerRef: innerRefProp,
  className,
  wheelZoom = 'off',
  shellVariant = 'standalone',
}: MermaidDiagramShellProps) {
  const isEmbeddedShell = shellVariant === 'embedded';
  const localScrollRef = useRef<HTMLDivElement>(null);
  const localInnerRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollRefProp ?? localScrollRef;
  const innerRef = innerRefProp ?? localInnerRef;

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [svgHtml]);

  useEffect(() => {
    if (scale <= 1.01) setPan({ x: 0, y: 0 });
  }, [scale]);

  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;

  useLayoutEffect(() => {
    if (wheelZoom === 'off') return;
    const el = scrollRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const step = e.deltaY > 0 ? -0.08 : 0.08;
      onScaleChangeRef.current(clampMermaidScale(scaleRef.current + step));
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [wheelZoom, svgHtml, scrollRef]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scale <= 1.02) return;
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      panDrag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan.x, pan.y, scale]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = panDrag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setPan({ x: d.panX + dx, y: d.panY + dy });
    },
    []
  );

  const endPan = useCallback((e: React.PointerEvent) => {
    const d = panDrag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    panDrag.current = null;
  }, []);

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={scrollRef as Ref<HTMLDivElement>}
        className={cn(
          'w-full overflow-auto bg-gray-0 dark:bg-gray-50',
          isEmbeddedShell
            ? 'max-h-[min(55vh,480px)] rounded-md'
            : 'max-h-[min(70vh,560px)] rounded-xl border border-muted/70 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.07]'
        )}
      >
        <div
          className={cn(
            'flex w-full min-w-full items-center justify-center',
            isEmbeddedShell ? 'min-h-[120px] p-3' : 'min-h-[min(50vh,420px)] p-6'
          )}
        >
          <div
            ref={innerRef as Ref<HTMLDivElement>}
            role="presentation"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            className={cn(
              'touch-none select-none',
              scale > 1.02 && 'cursor-grab active:cursor-grabbing'
            )}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </div>
      </div>
    </div>
  );
}
