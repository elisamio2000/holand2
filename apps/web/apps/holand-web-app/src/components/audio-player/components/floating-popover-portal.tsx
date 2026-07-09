'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import cn from '@core/utils/class-names';

/**
 * Global z-index stack for audio/video player floating UI.
 * Must sit above sticky dock (z-120) and standard app chrome.
 */
export const PLAYER_OVERLAY_Z = {
  backdrop: 10048,
  popover: 10050,
} as const;

export interface FloatingPopoverPortalProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  /** Panel width in px — used for end-alignment under anchor */
  width?: number;
  /** Gap between anchor and panel edge */
  gap?: number;
  placement?: 'above' | 'below';
}

/**
 * Renders a popover in document.body so it is never clipped by overflow:hidden ancestors.
 * Use for all player settings/more menus (sticky, inline, modal).
 */
export function FloatingPopoverPortal({
  open,
  onClose,
  anchorRef,
  children,
  className,
  width = 176,
  gap = 6,
  placement = 'above',
}: FloatingPopoverPortalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const margin = 8;
      let left = rect.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      const top = placement === 'below' ? rect.bottom + gap : rect.top - gap;
      setPos({ top, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, width, gap, placement]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: PLAYER_OVERLAY_Z.backdrop }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="menu"
        className={cn(
          'fixed overflow-hidden rounded-lg border border-muted bg-gray-0 py-1.5 shadow-lg dark:bg-gray-50',
          className
        )}
        style={{
          zIndex: PLAYER_OVERLAY_Z.popover,
          top: pos.top,
          left: pos.left,
          width,
          transform: placement === 'above' ? 'translateY(-100%)' : undefined,
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
