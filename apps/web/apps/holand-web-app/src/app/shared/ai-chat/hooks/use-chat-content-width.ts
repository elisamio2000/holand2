'use client';

import { useCallback, useEffect, useState } from 'react';

export type ChatContentWidthPreset = 'narrow' | 'default' | 'wide' | 'full';

export const CHAT_CONTENT_WIDTH_STORAGE_KEY = 'ai-chat-content-width';

const PRESET_MAX_WIDTH: Record<ChatContentWidthPreset, string> = {
  narrow: '640px',
  default: '768px',
  wide: '1024px',
  full: '100%',
};

export function isChatContentWidthPreset(value: string): value is ChatContentWidthPreset {
  return value === 'narrow' || value === 'default' || value === 'wide' || value === 'full';
}

export function getChatContentMaxWidth(preset: ChatContentWidthPreset): string {
  return PRESET_MAX_WIDTH[preset];
}

export function readStoredChatContentWidth(): ChatContentWidthPreset {
  if (typeof window === 'undefined') return 'default';
  try {
    const stored = localStorage.getItem(CHAT_CONTENT_WIDTH_STORAGE_KEY);
    if (stored && isChatContentWidthPreset(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'default';
}

export function useChatContentWidth() {
  const [preset, setPresetState] = useState<ChatContentWidthPreset>('default');

  useEffect(() => {
    setPresetState(readStoredChatContentWidth());
  }, []);

  const setPreset = useCallback((next: ChatContentWidthPreset) => {
    setPresetState(next);
    try {
      localStorage.setItem(CHAT_CONTENT_WIDTH_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const maxWidth = getChatContentMaxWidth(preset);

  const contentStyle = {
    '--chat-content-max-width': maxWidth,
    maxWidth,
  } as React.CSSProperties;

  return { preset, setPreset, maxWidth, contentStyle };
}
