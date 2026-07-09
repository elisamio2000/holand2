'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { PiMinus, PiSidebarSimple, PiX, PiArrowsOutSimple } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { CanvasContent } from '@/types/chat.types';
import MarkdownErrorBoundary from './markdown-error-boundary';
import MarkdownRenderer from './markdown-renderer';

const MIN_W = 280;
const MIN_H = 200;
const MAX_W_CAP = 920;
const MAX_H_CAP = 880;

interface AssistantReferenceFloatProps {
  /** Full markdown to keep visible alongside chat */
  content: string;
  /** Header label */
  title?: string;
  /** Backend / UI message id (shown in header when present) */
  messageId?: string;
  onClose: () => void;
  /** Open canvas from nested code/table — does NOT close this panel */
  onOpenCanvas?: (c: CanvasContent) => void;
}

/**
 * Draggable, resizable floating panel for an assistant reply — reference while continuing in chat.
 * Rendered via portal above the page (not the modal stack).
 */
export default function AssistantReferenceFloat({
  content,
  title = 'Reference',
  messageId,
  onClose,
  onOpenCanvas,
}: AssistantReferenceFloatProps) {
  const { t } = useTranslation();
  const [minimized, setMinimized] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 440, h: 560 });
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth - 24;
    const vh = window.innerHeight - 32;
    setSize({
      w: Math.min(480, Math.max(MIN_W, vw)),
      h: Math.min(640, Math.max(MIN_H, Math.round(window.innerHeight * 0.68))),
    });
  }, []);

  const clampTranslate = useCallback((tx: number, ty: number) => {
    if (typeof window === 'undefined' || !rootRef.current) return { x: tx, y: ty };
    const rect = rootRef.current.getBoundingClientRect();
    const pad = 8;
    const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
    const maxY = Math.max(pad, window.innerHeight - rect.height - pad);
    const minX = -(window.innerWidth - rect.width - pad);
    const minY = -(window.innerHeight - rect.height - pad);
    return {
      x: Math.min(maxX, Math.max(minX, tx)),
      y: Math.min(maxY, Math.max(minY, ty)),
    };
  }, []);

  useEffect(() => {
    setTranslate((prev) => clampTranslate(prev.x, prev.y));
  }, [size.w, size.h, clampTranslate]);

  const onPointerDownHeader = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;
      dragRef.current = {
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        startTx: translate.x,
        startTy: translate.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [translate.x, translate.y]
  );

  const onPointerMoveHeader = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const nx = d.startTx + (e.clientX - d.originX);
      const ny = d.startTy + (e.clientY - d.originY);
      setTranslate(clampTranslate(nx, ny));
    },
    [clampTranslate]
  );

  const endHeaderDrag = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      resizeRef.current = {
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        startW: size.w,
        startH: size.h,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size.w, size.h]
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r || r.pointerId !== e.pointerId) return;
      if (typeof window === 'undefined') return;
      const dw = e.clientX - r.originX;
      const dh = e.clientY - r.originY;
      const maxW = Math.min(MAX_W_CAP, window.innerWidth - 24);
      const maxH = Math.min(MAX_H_CAP, window.innerHeight - 24);
      const nw = Math.min(maxW, Math.max(MIN_W, r.startW + dw));
      const nh = Math.min(maxH, Math.max(MIN_H, r.startH + dh));
      setSize({ w: nw, h: nh });
    },
    []
  );

  const endResize = useCallback((e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    resizeRef.current = null;
  }, []);

  useEffect(() => {
    const onResize = () => setTranslate((prev) => clampTranslate(prev.x, prev.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampTranslate]);

  if (typeof document === 'undefined') return null;

  const panel = (
    <div
      ref={rootRef}
      role="complementary"
      aria-label={title}
      className={cn(
        'fixed z-[10050] flex flex-col overflow-hidden rounded-xl border border-muted bg-gray-0 shadow-2xl dark:bg-gray-50',
        minimized ? 'h-11 w-72' : 'min-h-0'
      )}
      style={
        minimized
          ? {
              insetInlineEnd: 16,
              bottom: 24,
              transform: `translate(${translate.x}px, ${translate.y}px)`,
            }
          : {
              width: size.w,
              height: size.h,
              insetInlineEnd: 16,
              bottom: 24,
              transform: `translate(${translate.x}px, ${translate.y}px)`,
              maxWidth: 'min(100vw - 16px, 920px)',
              maxHeight: 'min(100vh - 24px, 880px)',
            }
      }
    >
      <div
        className={cn(
          'flex shrink-0 cursor-grab items-center justify-between border-b border-muted bg-gray-50/90 px-2 py-2 active:cursor-grabbing dark:bg-gray-100/80',
          minimized && 'border-0'
        )}
        onPointerDown={onPointerDownHeader}
        onPointerMove={onPointerMoveHeader}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 ps-1">
          <div className="flex min-w-0 items-center gap-2">
            <PiSidebarSimple className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate text-xs font-semibold text-gray-800 dark:text-gray-700">
              {title}
            </span>
          </div>
          {messageId ? (
            <span
              className="truncate ps-6 font-mono text-[10px] leading-tight text-gray-500 dark:text-gray-400"
              title={messageId}
            >
              {t('chatPage.referenceMessageId', { id: messageId })}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-gray-200/40"
            title={minimized ? t('chatPage.referenceFloatRestore') : t('chatPage.referenceFloatMinimize')}
            aria-label={minimized ? t('chatPage.referenceFloatRestore') : t('chatPage.referenceFloatMinimize')}
          >
            {minimized ? (
              <PiArrowsOutSimple className="h-4 w-4" />
            ) : (
              <PiMinus className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-gray-200/40"
            title={t('chatPage.referenceFloatClose')}
            aria-label={t('chatPage.referenceFloatClose')}
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="custom-scrollbar scrollbar-no-auto-hide relative min-h-0 flex-1 overflow-y-auto overflow-x-auto p-3">
            <MarkdownErrorBoundary fallbackContent={content}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <MarkdownRenderer
                  content={content}
                  fullSource={content}
                  onOpenCanvas={onOpenCanvas}
                  className="font-vazirmatn"
                />
              </div>
            </MarkdownErrorBoundary>
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('chatPage.referenceFloatResize')}
            className="absolute bottom-0 end-0 z-[1] h-5 w-5 cursor-se-resize touch-none rounded-ss-md bg-gradient-to-tl from-gray-200/90 to-transparent dark:from-gray-600/50"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        </>
      )}
    </div>
  );

  return createPortal(panel, document.body);
}
