'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiArrowBendUpLeftBold,
  PiSmileyBold,
  PiDotsThreeBold,
  PiShareFatBold,
} from 'react-icons/pi';
import { createPortal } from 'react-dom';
import cn from '@core/utils/class-names';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '😊', '🔥', '👏'];

interface MessageHoverToolbarProps {
  isOwn: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onForward: () => void;
  onMore: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export default function MessageHoverToolbar({
  isOwn,
  onReply,
  onReact,
  onForward,
  onMore,
  className,
}: MessageHoverToolbarProps) {
  const { t } = useTranslation();
  const [reactOpen, setReactOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  // Click-based toggle — avoids hover-gap disappearance
  const toggleReact = () => setReactOpen((v) => !v);

  // Compute picker position when it opens
  useEffect(() => {
    if (!reactOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const pickerW = 8 * 28 + 16; // 8 cols × 28px + 2×8px padding ≈ 240px
    let left = isOwn ? rect.right - pickerW : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - pickerW - 8));
    setPickerPos({ top: rect.top - 4, left });
  }, [reactOpen, isOwn]);

  // Outside-click closes picker
  useEffect(() => {
    if (!reactOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        pickerRef.current?.contains(target)
      ) return;
      setReactOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [reactOpen]);

  const picker = reactOpen && pickerPos ? (
    <div
      ref={pickerRef}
      style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, transform: 'translateY(-100%)' }}
      className="z-[10100] flex items-center gap-0.5 rounded-lg border border-muted bg-white px-1.5 py-1.5 shadow-xl dark:bg-gray-50"
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // prevent blur/outside-click from firing first
            onReact(emoji);
            setReactOpen(false);
          }}
          className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
        >
          {emoji}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'absolute top-0 z-20 flex items-center gap-0.5 rounded-lg border border-muted bg-white px-1 py-0.5 shadow-md opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-50',
        isOwn ? 'end-0 -translate-y-1/2' : 'start-0 -translate-y-1/2',
        className
      )}
    >
      <button
        type="button"
        onClick={onReply}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary"
        title={t('messages.context.reply', 'Reply')}
      >
        <PiArrowBendUpLeftBold className="h-3.5 w-3.5" />
      </button>

      <button
        ref={btnRef}
        type="button"
        onClick={toggleReact}
        className={cn(
          'rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary',
          reactOpen && 'bg-gray-100 text-primary'
        )}
        title={t('messages.context.react', 'React')}
        aria-expanded={reactOpen}
      >
        <PiSmileyBold className="h-3.5 w-3.5" />
      </button>

      {typeof document !== 'undefined' && picker && createPortal(picker, document.body)}

      <button
        type="button"
        onClick={onForward}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary"
        title={t('messages.forward.label', 'Forward')}
      >
        <PiShareFatBold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onMore}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary"
        title={t('messages.context.more', 'More')}
      >
        <PiDotsThreeBold className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
