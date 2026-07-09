'use client';

import { useEffect } from 'react';

interface UseChatKeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onNewChat: () => void;
  onFocusSidebarSearch: () => void;
  onOpenInThreadFind?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useChatKeyboardShortcuts({
  onOpenSearch,
  onNewChat,
  onFocusSidebarSearch,
  onOpenInThreadFind,
  onEscape,
  enabled = true,
}: UseChatKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onNewChat();
        return;
      }
      if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey && onOpenInThreadFind) {
        e.preventDefault();
        onOpenInThreadFind();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onFocusSidebarSearch();
        return;
      }
      if (e.key === 'Escape' && onEscape && !isEditable) {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onOpenSearch, onNewChat, onFocusSidebarSearch, onOpenInThreadFind, onEscape]);
}