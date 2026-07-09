'use client';

import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  PiArrowBendUpLeftBold,
  PiCopyBold,
  PiSmileyBold,
  PiTrashBold,
  PiShareFatBold,
  PiPencilSimpleBold,
  PiPushPinBold,
  PiArrowClockwiseBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

export type ContextMenuAction =
  | 'reply'
  | 'forward'
  | 'edit'
  | 'pin'
  | 'copy'
  | 'react'
  | 'delete'
  | 'resend';

interface MessageContextMenuProps {
  x: number;
  y: number;
  isOwn?: boolean;
  isPinned?: boolean;
  onReply: () => void;
  onForward: () => void;
  onEdit?: () => void;
  onPin: () => void;
  onCopy: () => void;
  onReact: () => void;
  onDelete?: () => void;
  onResend?: () => void;
  onClose: () => void;
}

function clampPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number
): { top: number; left: number } {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;

  if (left + menuWidth + pad > vw) left = vw - menuWidth - pad;
  if (left < pad) left = pad;
  if (top + menuHeight + pad > vh) top = y - menuHeight;
  if (top < pad) top = pad;

  return { top, left };
}

export default function MessageContextMenu({
  x,
  y,
  isOwn,
  isPinned,
  onReply,
  onForward,
  onEdit,
  onPin,
  onCopy,
  onReact,
  onDelete,
  onResend,
  onClose,
}: MessageContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(clampPosition(x, y, rect.width, rect.height));
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const actions: {
    id: ContextMenuAction;
    icon: typeof PiArrowBendUpLeftBold;
    label: string;
    onClick: () => void;
    ownerOnly?: boolean;
    danger?: boolean;
  }[] = [
    { id: 'reply', icon: PiArrowBendUpLeftBold, label: t('messages.context.reply', 'Reply'), onClick: onReply },
    { id: 'forward', icon: PiShareFatBold, label: t('messages.forward.label', 'Forward'), onClick: onForward },
    ...(isOwn && onEdit
      ? [{ id: 'edit' as const, icon: PiPencilSimpleBold, label: t('messages.context.edit', 'Edit'), onClick: onEdit, ownerOnly: true }]
      : []),
    ...(isOwn && onResend
      ? [{ id: 'resend' as const, icon: PiArrowClockwiseBold, label: t('messages.context.resend', 'Resend'), onClick: onResend, ownerOnly: true }]
      : []),
    {
      id: 'pin',
      icon: PiPushPinBold,
      label: isPinned ? t('messages.context.unpin', 'Unpin') : t('messages.context.pin', 'Pin'),
      onClick: onPin,
    },
    { id: 'copy', icon: PiCopyBold, label: t('messages.context.copy', 'Copy'), onClick: onCopy },
    { id: 'react', icon: PiSmileyBold, label: t('messages.context.react', 'React'), onClick: onReact },
    ...(onDelete
      ? [{ id: 'delete' as const, icon: PiTrashBold, label: t('messages.context.delete', 'Delete'), onClick: onDelete, danger: true }]
      : []),
  ];

  const menu = (
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left }}
      className={cn(
        'fixed z-[10050] min-w-[180px] rounded-lg border border-muted bg-white py-1 shadow-2xl dark:bg-gray-50'
      )}
    >
      {actions.map((action, idx) => {
        const Icon = action.icon;
        const showDivider = action.danger && idx > 0;

        return (
          <div key={action.id}>
            {showDivider && <div className="my-1 h-px bg-gray-200" />}
            <button
              type="button"
              onClick={() => handleAction(action.onClick)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-gray-100',
                action.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </button>
          </div>
        );
      })}
    </div>
  );

  if (typeof document === 'undefined') return menu;
  return createPortal(menu, document.body);
}
