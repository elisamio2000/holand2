'use client';

import { IconTooltip } from '@/components/tooltip';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { ActionIcon } from 'rizzui';
import {
  PiDotsSixVerticalBold,
  PiMinusBold,
  PiPictureInPictureBold,
  PiArrowSquareOutBold,
  PiXBold,
} from 'react-icons/pi';
import {
  loadPanelWidth,
  savePanelWidth,
  type BoardPanelMode,
} from '../../lib/board-panel-prefs';

interface BoardPanelShellProps {
  id: string;
  title: string;
  visible: boolean;
  mode: BoardPanelMode;
  boardId?: string;
  supportsPopout?: boolean;
  supportsMinimize?: boolean;
  /** docked panel side — left panels resize from the trailing edge */
  side?: 'left' | 'right';
  onModeChange: (mode: BoardPanelMode) => void;
  onClose: () => void;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  /** When set, floating panels use absolute positioning inside this container (graph workspace). */
  floatAnchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function BoardPanelShell({
  id,
  title,
  visible,
  mode,
  boardId,
  supportsPopout = true,
  supportsMinimize = true,
  side = 'right',
  onModeChange,
  onClose,
  defaultWidth = 260,
  minWidth = 220,
  maxWidth = 420,
  className,
  floatAnchorRef,
  children,
}: BoardPanelShellProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [width, setWidth] = useState(defaultWidth);
  const dockedRef = useRef<HTMLDivElement>(null);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef({ pos: 0, size: 0 });
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const prevModeRef = useRef<BoardPanelMode>(mode);
  const popoutRef = useRef<Window | null>(null);

  useEffect(() => {
    setMounted(true);
    setWidth(loadPanelWidth(id, defaultWidth));
  }, [id, defaultWidth]);

  useEffect(() => {
    if (!mounted) return;
    savePanelWidth(id, width);
  }, [id, width, mounted]);

  useEffect(() => {
    if (mode === 'floating' && prevModeRef.current === 'docked' && dockedRef.current) {
      const panelRect = dockedRef.current.getBoundingClientRect();
      const anchorEl = floatAnchorRef?.current;
      if (anchorEl) {
        const anchorRect = anchorEl.getBoundingClientRect();
        setFloatPos({
          x: panelRect.left - anchorRect.left,
          y: panelRect.top - anchorRect.top,
        });
      } else {
        setFloatPos({ x: panelRect.left, y: panelRect.top });
      }
    }
    if (mode === 'docked' && prevModeRef.current === 'floating') {
      setFloatPos(null);
    }
    prevModeRef.current = mode;
  }, [mode, floatAnchorRef]);

  const handlePopout = useCallback(() => {
    if (!boardId || typeof window === 'undefined') return;
    const url = `${window.location.origin}/boards/${boardId}/panel/${id}`;
    popoutRef.current = window.open(url, `board-panel-${id}`, 'width=440,height=720,resizable=yes');
    onModeChange('popout');
  }, [boardId, id, onModeChange]);

  useEffect(() => {
    return () => {
      popoutRef.current?.close();
    };
  }, []);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);
      startRef.current = { pos: e.clientX, size: width };
    },
    [width]
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (ev: MouseEvent) => {
      const delta =
        side === 'left' ? ev.clientX - startRef.current.pos : startRef.current.pos - ev.clientX;
      const next = Math.min(maxWidth, Math.max(minWidth, startRef.current.size + delta));
      setWidth(next);
    };
    const onUp = () => setResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, minWidth, maxWidth, side]);

  const onFloatDragStart = (e: React.PointerEvent) => {
    if (mode !== 'floating') return;
    if ((e.target as Element).closest('[data-no-drag]')) return;
    const panel = (e.currentTarget as HTMLElement).closest('[data-board-float-panel]') as HTMLElement | null;
    const rect = panel?.getBoundingClientRect();
    const originX = floatPos?.x ?? rect?.left ?? 16;
    const originY = floatPos?.y ?? rect?.top ?? 64;
    if (!floatPos) setFloatPos({ x: originX, y: originY });
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX,
      originY,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onFloatDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setFloatPos({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    });
  };

  const onFloatDragEnd = () => {
    dragRef.current = null;
  };

  if (!visible) return null;

  if (mode === 'popout') {
    return (
      <div
        className={cn(
          'fixed bottom-4 end-4 z-40 flex items-center gap-2 rounded-lg border border-muted bg-background px-3 py-2 text-xs shadow-lg',
          className
        )}
      >
        <span className="font-medium">{title}</span>
        <span className="text-gray-500">{t('boards.panel.popoutActive', 'Open in separate window')}</span>
        <IconTooltip content={t('boards.panel.restore', 'Restore')} preset="toolbar">
          <ActionIcon size="sm" variant="text" aria-label={t('boards.panel.restore', 'Restore')} onClick={() => onModeChange('docked')}>
            <PiPictureInPictureBold className="h-3.5 w-3.5" />
          </ActionIcon>
        </IconTooltip>
        <IconTooltip content={t('boards.panel.close', 'Close panel')} preset="toolbar">
          <ActionIcon size="sm" variant="text" aria-label={t('boards.panel.close', 'Close panel')} onClick={onClose}>
            <PiXBold className="h-3.5 w-3.5" />
          </ActionIcon>
        </IconTooltip>
      </div>
    );
  }

  if (mode === 'minimized') {
    return (
      <div
        className={cn(
          'fixed bottom-4 z-40 flex cursor-pointer items-center gap-2 rounded-lg border border-muted bg-background px-3 py-1.5 text-xs shadow-md',
          side === 'left' ? 'start-4' : 'end-4',
          className
        )}
        onClick={() => onModeChange('docked')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onModeChange('docked');
        }}
      >
        <span className="font-medium">{title}</span>
        <span className="text-gray-400">{t('boards.panel.minimized', 'Click to restore')}</span>
      </div>
    );
  }

  const header = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 border-b border-muted bg-gray-50/80 px-2 py-1.5 dark:bg-gray-100/5',
        mode === 'floating' && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={mode === 'floating' ? onFloatDragStart : undefined}
      onPointerMove={mode === 'floating' ? onFloatDragMove : undefined}
      onPointerUp={mode === 'floating' ? onFloatDragEnd : undefined}
      onPointerCancel={mode === 'floating' ? onFloatDragEnd : undefined}
    >
      <span className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">{title}</span>
      <div className="flex shrink-0 items-center gap-0.5" data-no-drag>
        {supportsMinimize ? (
          <IconTooltip content={t('boards.panel.minimize', 'Minimize')} preset="toolbar">
            <ActionIcon
              size="sm"
              variant="text"
              aria-label={t('boards.panel.minimize', 'Minimize')}
              onClick={() => onModeChange('minimized')}
            >
              <PiMinusBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </IconTooltip>
        ) : null}
        <IconTooltip content={t('boards.panel.float', 'Float panel')} preset="toolbar">
          <ActionIcon
            size="sm"
            variant="text"
            aria-label={t('boards.panel.float', 'Float panel')}
            onClick={() => onModeChange(mode === 'floating' ? 'docked' : 'floating')}
          >
            <PiPictureInPictureBold className="h-3.5 w-3.5" />
          </ActionIcon>
        </IconTooltip>
        {supportsPopout && boardId ? (
          <IconTooltip content={t('boards.panel.popout', 'Pop out')} preset="toolbar">
            <ActionIcon
              size="sm"
              variant="text"
              aria-label={t('boards.panel.popout', 'Pop out')}
              onClick={handlePopout}
            >
              <PiArrowSquareOutBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </IconTooltip>
        ) : null}
        <IconTooltip content={t('boards.panel.close', 'Close panel')} preset="toolbar">
          <ActionIcon size="sm" variant="text" aria-label={t('boards.panel.close', 'Close panel')} onClick={onClose}>
            <PiXBold className="h-3.5 w-3.5" />
          </ActionIcon>
        </IconTooltip>
      </div>
    </div>
  );

  const displayWidth = mounted ? width : defaultWidth;

  const body = (
    <>
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {mode === 'docked' && mounted ? (
        <div
          onMouseDown={onResizeMouseDown}
          className={cn(
            'absolute inset-y-0 z-20 w-1.5 cursor-col-resize',
            side === 'left' ? 'end-0' : 'start-0',
            'transition-colors hover:bg-primary/20',
            resizing && 'bg-primary/30'
          )}
          role="separator"
          aria-label={t('boards.panel.resize', 'Resize panel')}
        >
          <div
            className={cn(
              'absolute top-1/2 flex h-8 w-4 -translate-y-1/2 items-center justify-center',
              'rounded border border-muted bg-background shadow-sm',
              'opacity-0 transition-opacity hover:opacity-100',
              resizing && 'opacity-100',
              side === 'left' ? '-end-1.5' : '-start-1.5'
            )}
          >
            <PiDotsSixVerticalBold className="h-3 w-3 text-gray-500" />
          </div>
        </div>
      ) : null}
    </>
  );

  if (mode === 'floating') {
    const isAnchored = floatAnchorRef !== undefined;
    const anchorEl = floatAnchorRef?.current;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const anchorWidth = anchorEl?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : displayWidth);
    const anchorHeight = anchorEl?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 520);
    const floatWidth = isMobile
      ? Math.min(displayWidth, anchorWidth - 16)
      : displayWidth;
    const defaultLeft = isAnchored
      ? Math.max(8, anchorWidth - floatWidth - 8)
      : typeof window !== 'undefined'
        ? window.innerWidth - floatWidth - 16
        : 16;
    const defaultTop = isAnchored ? 8 : 64;
    const left = floatPos?.x ?? defaultLeft;
    const top = floatPos?.y ?? defaultTop;
    const maxHeight = isAnchored
      ? Math.min(anchorHeight - top - 8, 520)
      : Math.min(typeof window !== 'undefined' ? window.innerHeight * 0.7 : 520, 520);
    const useRightAnchor = isAnchored && floatPos == null && side === 'right';

    return (
      <div
        data-board-float-panel
        className={cn(
          'z-20 flex flex-col overflow-hidden rounded-lg border border-muted bg-background shadow-xl',
          isAnchored ? 'absolute' : 'fixed z-40',
          className
        )}
        style={{
          width: floatWidth,
          maxHeight: Math.max(160, maxHeight),
          top,
          ...(useRightAnchor ? { right: 8, left: 'auto' } : { left }),
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      ref={dockedRef}
      className={cn(
        'relative flex h-full shrink-0 flex-col overflow-hidden bg-background',
        side === 'left' ? 'border-e border-muted' : 'border-s border-muted',
        className
      )}
      style={{ width: displayWidth }}
    >
      {body}
    </div>
  );
}
