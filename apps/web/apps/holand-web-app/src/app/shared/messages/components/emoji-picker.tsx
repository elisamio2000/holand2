'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import cn from '@core/utils/class-names';

const EMOJI_GRID = [
  '😀', '😂', '🥰', '😍', '🤔', '😮', '😢', '🙏', '👍', '👎',
  '❤️', '🔥', '✨', '🎉', '💯', '👏', '🤝', '💪', '🙌', '😎',
  '😭', '🤣', '😊', '🥳', '😤', '🤯', '😴', '🤗', '🫡', '✅',
  '❌', '⭐', '💡', '📎', '📷', '🎵', '🎬', '📁', '💬', '📧',
];

type EmojiPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  className?: string;
  /** Anchor element for fixed portal positioning (inline composer) */
  anchorRef?: React.RefObject<HTMLElement | null>;
};

export default function EmojiPicker({
  isOpen,
  onClose,
  onSelect,
  className,
  anchorRef,
}: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fixedStyle, setFixedStyle] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      setFixedStyle(null);
      return;
    }
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const pickerW = 256;
      let left = rect.right - pickerW;
      if (left < 8) left = 8;
      setFixedStyle({ top: rect.top - 8, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const picker = (
    <div
      ref={ref}
      style={
        fixedStyle
          ? { position: 'fixed', top: fixedStyle.top, left: fixedStyle.left, transform: 'translateY(-100%)' }
          : undefined
      }
      className={cn(
        'z-[10050] grid w-64 grid-cols-8 gap-0.5 rounded-lg border border-muted bg-gray-0 p-2 shadow-lg dark:bg-gray-50',
        !fixedStyle && className
      )}
    >
      {EMOJI_GRID.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-gray-100 dark:hover:bg-gray-200/20"
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  if (fixedStyle && typeof document !== 'undefined') {
    return createPortal(picker, document.body);
  }

  return picker;
}
