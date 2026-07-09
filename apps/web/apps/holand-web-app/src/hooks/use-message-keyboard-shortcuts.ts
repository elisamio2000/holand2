'use client';

import { useEffect } from 'react';

type ShortcutHandlers = {
  onCompose?: () => void;
  onReply?: () => void;
  onArchive?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onEscape?: () => void;
  onCommandPalette?: () => void;
  enabled?: boolean;
};

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

export function useMessageKeyboardShortcuts({
  onCompose,
  onReply,
  onArchive,
  onNext,
  onPrev,
  onEscape,
  onCommandPalette,
  enabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onCommandPalette?.();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'c':
          e.preventDefault();
          onCompose?.();
          break;
        case 'r':
          e.preventDefault();
          onReply?.();
          break;
        case 'a':
          e.preventDefault();
          onArchive?.();
          break;
        case 'j':
          e.preventDefault();
          onNext?.();
          break;
        case 'k':
          e.preventDefault();
          onPrev?.();
          break;
        case 'Escape':
          onEscape?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onArchive, onCompose, onCommandPalette, onEscape, onNext, onPrev, onReply]);
}
