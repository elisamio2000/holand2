'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import cn from '@core/utils/class-names';

const STORAGE_KEY = 'graphx-chat-preview-modal-size-v1';

export const CHAT_PREVIEW_MODAL_DEFAULT = { width: 880, height: 640 };
const MIN_SIZE = { width: 520, height: 380 };
const MAX_SIZE = { width: 1400, height: 900 };

type Size = { width: number; height: number };

function loadStoredSize(): Size {
  if (typeof window === 'undefined') return CHAT_PREVIEW_MODAL_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CHAT_PREVIEW_MODAL_DEFAULT;
    const parsed = JSON.parse(raw) as Size;
    if (
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number' &&
      parsed.width >= MIN_SIZE.width &&
      parsed.height >= MIN_SIZE.height &&
      parsed.width <= MAX_SIZE.width &&
      parsed.height <= MAX_SIZE.height
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return CHAT_PREVIEW_MODAL_DEFAULT;
}

interface ResizableModalShellProps {
  children: ReactNode;
  /** Sticky header (title row, close, etc.) */
  header?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Shared resizable body for chat expand modals (files, canvas, long markdown).
 * Size persists in localStorage; drag bottom-right grip to resize.
 */
export default function ResizableModalShell({
  children,
  header,
  className,
  bodyClassName,
}: ResizableModalShellProps) {
  const [size, setSize] = useState<Size>(CHAT_PREVIEW_MODAL_DEFAULT);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    setSize(loadStoredSize());
  }, []);

  const persistSize = useCallback((next: Size) => {
    setSize(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: size.width,
        startH: size.height,
      };
    },
    [size.height, size.width]
  );

  const onResizePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const w = Math.min(
      MAX_SIZE.width,
      Math.max(MIN_SIZE.width, d.startW + (e.clientX - d.startX))
    );
    const h = Math.min(
      MAX_SIZE.height,
      Math.max(MIN_SIZE.height, d.startH + (e.clientY - d.startY))
    );
    persistSize({ width: Math.round(w), height: Math.round(h) });
  }, [persistSize]);

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg border border-muted/60 bg-gray-0 shadow-lg dark:bg-gray-50',
        className
      )}
      style={{
        width: size.width,
        height: size.height,
        minWidth: MIN_SIZE.width,
        minHeight: MIN_SIZE.height,
        maxWidth: 'min(96vw, 1400px)',
        maxHeight: 'min(92vh, 900px)',
      }}
    >
      {header}
      <div className={cn('min-h-0 flex-1 overflow-auto custom-scrollbar', bodyClassName)}>
        {children}
      </div>
      <div
        role="separator"
        aria-label="Resize preview"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        className="absolute bottom-0 end-0 z-10 h-4 w-4 cursor-nwse-resize touch-none"
        title="Drag to resize"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-full w-full text-gray-400 dark:text-gray-500"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M14 14L8 14L14 8Z M14 14L14 10L10 14Z"
          />
        </svg>
      </div>
    </div>
  );
}
