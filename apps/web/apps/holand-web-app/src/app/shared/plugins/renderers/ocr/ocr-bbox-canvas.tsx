// ============================================
// OcrBboxCanvas — Canvas overlay برای bounding box‌ها
//
// ویژگی‌ها:
// - رسم مستطیل‌های رنگ‌کد شده بر اساس confidence
// - tooltip هنگام hover روی هر کلمه
// - پشتیبانی از resize (observer)
// - قابل فعال/غیرفعال‌سازی
// ============================================
'use client';

import {
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import cn from '@core/utils/class-names';
import { OcrWord, bboxToRect } from './ocr-types';

// ==========================================
// Types
// ==========================================

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WordRect {
  word: OcrWord;
  rect: Rect;          // در مختصات طبیعی تصویر (0-1)
  rectPx: Rect;        // در مختصات پیکسل canvas
}

interface TooltipState {
  word: OcrWord;
  x: number;
  y: number;
}

interface OcrBboxCanvasProps {
  /** src تصویر — برای محاسبه ابعاد */
  imageSrc: string;
  /** عرض واقعی تصویر اصلی (پیکسل) */
  imageNaturalWidth: number;
  /** ارتفاع واقعی تصویر اصلی (پیکسل) */
  imageNaturalHeight: number;
  /** لیست کلمات با bbox */
  words: OcrWord[];
  /** فعال/غیرفعال بودن overlay */
  enabled?: boolean;
  className?: string;
}

// ==========================================
// Confidence Colors (CSS hex)
// ==========================================

function confidenceToColor(confidence: number): string {
  if (confidence >= 0.8) return 'rgba(34, 197, 94, 0.75)';   // green-500
  if (confidence >= 0.5) return 'rgba(234, 179, 8, 0.75)';   // yellow-500
  return 'rgba(239, 68, 68, 0.75)';                           // red-500
}

// ==========================================
// Main Component
// ==========================================

export default function OcrBboxCanvas({
  imageSrc,
  imageNaturalWidth,
  imageNaturalHeight,
  words,
  enabled = true,
  className,
}: OcrBboxCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wordRectsRef = useRef<WordRect[]>([]);

  // ----------------------------------------
  // ساخت word rects (normalized 0-1)
  // ----------------------------------------

  const buildWordRects = useCallback(
    (containerW: number, containerH: number): WordRect[] => {
      if (!imageNaturalWidth || !imageNaturalHeight) return [];

      const scaleX = containerW / imageNaturalWidth;
      const scaleY = containerH / imageNaturalHeight;

      return words
        .filter((w) => w.bbox && w.bbox.length > 0)
        .map((word) => {
          const rect = bboxToRect(word.bbox);
          const rectPx: Rect = {
            x: rect.x * imageNaturalWidth * scaleX,
            y: rect.y * imageNaturalHeight * scaleY,
            w: rect.w * imageNaturalWidth * scaleX,
            h: rect.h * imageNaturalHeight * scaleY,
          };
          return { word, rect, rectPx };
        });
    },
    [words, imageNaturalWidth, imageNaturalHeight]
  );

  // ----------------------------------------
  // رسم روی canvas
  // ----------------------------------------

  const drawBoxes = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    if (!enabled) return;

    const rects = buildWordRects(w, h);
    wordRectsRef.current = rects;

    rects.forEach(({ word, rectPx }) => {
      ctx.strokeStyle = confidenceToColor(word.confidence);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rectPx.x, rectPx.y, rectPx.w, rectPx.h);
      // پر کردن خیلی شفاف
      ctx.fillStyle = confidenceToColor(word.confidence).replace('0.75', '0.1');
      ctx.fillRect(rectPx.x, rectPx.y, rectPx.w, rectPx.h);
    });
  }, [enabled, buildWordRects]);

  // ----------------------------------------
  // ResizeObserver
  // ----------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      drawBoxes();
    });
    observer.observe(container);
    drawBoxes();

    return () => observer.disconnect();
  }, [drawBoxes]);

  // ----------------------------------------
  // Mouse move → tooltip
  // ----------------------------------------

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!enabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const bounding = canvas.getBoundingClientRect();
      const mx = e.clientX - bounding.left;
      const my = e.clientY - bounding.top;

      const hit = wordRectsRef.current.find(({ rectPx }) => {
        return (
          mx >= rectPx.x &&
          mx <= rectPx.x + rectPx.w &&
          my >= rectPx.y &&
          my <= rectPx.y + rectPx.h
        );
      });

      if (hit) {
        setTooltip({ word: hit.word, x: e.clientX, y: e.clientY });
      } else {
        setTooltip(null);
      }
    },
    [enabled]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // ----------------------------------------
  // Render
  // ----------------------------------------

  if (!imageSrc) return null;

  return (
    <div ref={containerRef} className={cn('relative select-none', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt="OCR تصویر"
        className="block h-auto w-full rounded-lg"
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'pointer-events-auto absolute inset-0 h-full w-full rounded-lg',
          !enabled && 'pointer-events-none'
        )}
      />

      {/* Tooltip */}
      {tooltip && enabled && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="max-w-[200px] rounded-lg border border-muted bg-gray-0 px-2.5 py-1.5 shadow-md dark:bg-gray-100"
        >
          <p className="font-[Vazirmatn,sans-serif] text-sm font-medium text-gray-800 dark:text-gray-100">
            {tooltip.word.text}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            دقت: {Math.round(tooltip.word.confidence * 100)}%
            {tooltip.word.engine && (
              <> · {tooltip.word.engine}</>
            )}
          </p>
        </div>
      )}

      {/* Toggle hint */}
      {!enabled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
            نمایش جعبه‌ها غیرفعال
          </span>
        </div>
      )}
    </div>
  );
}
