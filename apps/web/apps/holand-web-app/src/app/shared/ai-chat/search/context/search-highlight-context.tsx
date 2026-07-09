'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface ActiveSearchHighlight {
  messageId: string;
  query: string;
}

interface SearchHighlightContextValue {
  activeHighlight: ActiveSearchHighlight | null;
  setHighlight: (messageId: string, query: string) => void;
  clearHighlight: () => void;
  isHighlighted: (messageId: string) => boolean;
  flashMessageId: string | null;
}

const SearchHighlightContext = createContext<SearchHighlightContextValue | null>(null);

const HIGHLIGHT_TTL_MS = 8000;

export function SearchHighlightProvider({ children }: { children: ReactNode }) {
  const [activeHighlight, setActiveHighlight] = useState<ActiveSearchHighlight | null>(
    null
  );
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);

  const setHighlight = useCallback((messageId: string, query: string) => {
    setActiveHighlight({ messageId, query });
    setFlashMessageId(messageId);
    window.setTimeout(() => setFlashMessageId(null), 1200);
  }, []);

  const clearHighlight = useCallback(() => {
    setActiveHighlight(null);
    setFlashMessageId(null);
  }, []);

  useEffect(() => {
    if (!activeHighlight) return;
    const t = window.setTimeout(() => setActiveHighlight(null), HIGHLIGHT_TTL_MS);
    return () => window.clearTimeout(t);
  }, [activeHighlight]);

  const isHighlighted = useCallback(
    (messageId: string) => activeHighlight?.messageId === messageId,
    [activeHighlight]
  );

  const value = useMemo(
    () => ({
      activeHighlight,
      setHighlight,
      clearHighlight,
      isHighlighted,
      flashMessageId,
    }),
    [activeHighlight, setHighlight, clearHighlight, isHighlighted, flashMessageId]
  );

  return (
    <SearchHighlightContext.Provider value={value}>
      {children}
    </SearchHighlightContext.Provider>
  );
}

export function useSearchHighlight() {
  const ctx = useContext(SearchHighlightContext);
  if (!ctx) {
    throw new Error('useSearchHighlight must be used within SearchHighlightProvider');
  }
  return ctx;
}

export function useSearchHighlightOptional() {
  return useContext(SearchHighlightContext);
}
