'use client';

import { useCallback, useEffect, useState } from 'react';

const DRAFTS_KEY = 'messages-drafts';
const AUTOSAVE_DELAY_MS = 1000;

interface Draft {
  threadId: string;
  body: string;
  timestamp: number;
}

export function useMessageDrafts(threadId: string) {
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFTS_KEY);
      if (stored) {
        const drafts = JSON.parse(stored) as Draft[];
        const found = drafts.find((d) => d.threadId === threadId);
        if (found) {
          setDraft(found.body);
        }
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, [threadId]);

  const saveDraft = useCallback(
    (body: string) => {
      try {
        const stored = localStorage.getItem(DRAFTS_KEY);
        let drafts: Draft[] = stored ? (JSON.parse(stored) as Draft[]) : [];
        
        drafts = drafts.filter((d) => d.threadId !== threadId);
        
        if (body.trim()) {
          drafts.push({
            threadId,
            body,
            timestamp: Date.now(),
          });
        }
        
        drafts = drafts
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
        
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
      } catch {
        // ignore
      }
    },
    [threadId]
  );

  const clearDraft = useCallback(() => {
    saveDraft('');
    setDraft('');
  }, [saveDraft]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      saveDraft(draft);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, loaded, saveDraft]);

  return {
    draft,
    setDraft,
    clearDraft,
  };
}
