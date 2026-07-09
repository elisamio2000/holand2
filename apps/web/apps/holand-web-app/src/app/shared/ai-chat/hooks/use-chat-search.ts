'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatService } from '@/services/chat.service';
import { searchChatAdapter } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import type { ChatFeatureHealthMap } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import { highlightSnippetText } from '@/app/shared/ai-chat/search/utils/highlight-query';
import { mergeSearchResults } from '@/app/shared/ai-chat/search/utils/merge-search-hits';
import type { ArtifactInput, ChatSession, StorageArtifact, UIMessage } from '@/types/chat.types';
export type ChatSearchResultType = 'session' | 'message' | 'file';
export type ChatSearchTab = 'sessions' | 'messages' | 'files';

export interface ChatSearchResult {
  type: ChatSearchResultType;
  sessionId: string;
  sessionTitle: string;
  messageId?: string;
  artifactId?: string;
  fileName?: string;
  mimeType?: string;
  snippet: string;
  matchIndex: number;
}

const MESSAGE_CACHE_MAX = 10;
const ARTIFACT_CACHE_MAX = 10;
export const SEARCH_RESULT_LIMIT_COMPACT = 50;
export const SEARCH_RESULT_LIMIT_EXPANDED = 100;

function highlightSnippet(text: string, query: string, maxLen = 120): string {
  return highlightSnippetText(text, query, maxLen);
}

function sessionsToSearch(
  sessions: ChatSession[],
  activeSessionId: string | null,
  useFullList: boolean
): ChatSession[] {
  if (useFullList) return sessions;
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  return activeSession
    ? [activeSession, ...sessions.filter((s) => s.id !== activeSessionId).slice(0, 8)]
    : sessions.slice(0, 9);
}
function trimCache<K, V>(cache: Map<K, V>, max: number) {
  if (cache.size > max) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

export function useChatSearch(
  sessions: ChatSession[],
  activeMessages: UIMessage[],
  activeSessionId: string | null,
  query: string,
  options?: {
    featureHealth?: ChatFeatureHealthMap;
    backendScope?: 'all' | 'titles' | 'messages' | 'files';
  }
) {  const [isSearching, setIsSearching] = useState(false);
  const [messageResults, setMessageResults] = useState<ChatSearchResult[]>([]);
  const [fileResults, setFileResults] = useState<ChatSearchResult[]>([]);
  const messageCacheRef = useRef<Map<string, UIMessage[]>>(new Map());
  const artifactCacheRef = useRef<Map<string, StorageArtifact[]>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionResults = useMemo((): ChatSearchResult[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sessions
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => ({
        type: 'session' as const,
        sessionId: s.id,
        sessionTitle: s.title,
        snippet: s.title,
        matchIndex: s.title.toLowerCase().indexOf(q),
      }));
  }, [query, sessions]);

  const loadMessages = useCallback(
    async (sessionId: string): Promise<UIMessage[]> => {
      if (sessionId === activeSessionId) return activeMessages;
      const cached = messageCacheRef.current.get(sessionId);
      if (cached) return cached;
      const loaded = (await chatService.listMessages(sessionId, { limit: 50 })) as UIMessage[];
      messageCacheRef.current.set(sessionId, loaded);
      trimCache(messageCacheRef.current, MESSAGE_CACHE_MAX);
      return loaded;
    },
    [activeMessages, activeSessionId]
  );

  const loadArtifacts = useCallback(async (sessionId: string): Promise<StorageArtifact[]> => {
    const cached = artifactCacheRef.current.get(sessionId);
    if (cached) return cached;
    try {
      const loaded = await chatService.getSessionArtifacts(sessionId, 50);
      artifactCacheRef.current.set(sessionId, loaded);
      trimCache(artifactCacheRef.current, ARTIFACT_CACHE_MAX);
      return loaded;
    } catch {
      return [];
    }
  }, []);

  const searchMessagesInSession = useCallback(
    async (session: ChatSession, q: string): Promise<ChatSearchResult[]> => {
      const messages = await loadMessages(session.id);
      const results: ChatSearchResult[] = [];
      for (const msg of messages) {
        const content = msg.content || msg.streamContent || '';
        const lower = content.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx >= 0) {
          results.push({
            type: 'message',
            sessionId: session.id,
            sessionTitle: session.title,
            messageId: msg.id,
            snippet: highlightSnippet(content, q),
            matchIndex: idx,
          });
        }
      }
      return results;
    },
    [loadMessages]
  );

  const searchFilesInSession = useCallback(
    async (session: ChatSession, q: string): Promise<ChatSearchResult[]> => {
      const seen = new Set<string>();
      const results: ChatSearchResult[] = [];

      const pushFile = (opts: {
        artifactId?: string;
        messageId?: string;
        fileName: string;
        mimeType?: string;
        snippet: string;
        matchIndex: number;
      }) => {
        const key = opts.artifactId ?? `${opts.messageId}-${opts.fileName}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({
          type: 'file',
          sessionId: session.id,
          sessionTitle: session.title,
          messageId: opts.messageId,
          artifactId: opts.artifactId,
          fileName: opts.fileName,
          mimeType: opts.mimeType,
          snippet: opts.snippet,
          matchIndex: opts.matchIndex,
        });
      };

      const messages = await loadMessages(session.id);
      for (const msg of messages) {
        const artifacts = (msg.artifacts ?? []) as ArtifactInput[];
        for (const att of artifacts) {
          const name = (att.name || '').toLowerCase();
          const mime = (att.mime_type || '').toLowerCase();
          const idx = name.includes(q) ? name.indexOf(q) : mime.includes(q) ? mime.indexOf(q) : -1;
          if (idx >= 0) {
            pushFile({
              artifactId: att.id ?? undefined,
              messageId: msg.id,
              fileName: att.name || att.path.split('/').pop() || 'file',
              mimeType: att.mime_type ?? undefined,
              snippet: att.name || att.mime_type || '',
              matchIndex: idx,
            });
          }
        }
      }

      const storageArtifacts = await loadArtifacts(session.id);
      for (const art of storageArtifacts) {
        const name = (art.original_filename || '').toLowerCase();
        const mime = (art.mime_type || '').toLowerCase();
        const idx = name.includes(q) ? name.indexOf(q) : mime.includes(q) ? mime.indexOf(q) : -1;
        if (idx >= 0) {
          pushFile({
            artifactId: art.id,
            fileName: art.original_filename || 'file',
            mimeType: art.mime_type,
            snippet: art.mime_type
              ? `${art.original_filename || 'file'} · ${art.mime_type}`
              : art.original_filename || 'file',
            matchIndex: idx,
          });
        }
      }

      return results;
    },
    [loadArtifacts, loadMessages]
  );

  const mapBackendFileHits = useCallback(
    (
      hits: Awaited<ReturnType<typeof chatService.searchChat>>,
      q: string
    ): ChatSearchResult[] => {      const sessionTitleById = new Map(sessions.map((s) => [s.id, s.title]));
      return hits
        .filter((h) => h.type === 'file')
        .map((h) => {
          const fileName = h.snippet.trim() || 'file';
          const lower = fileName.toLowerCase();
          return {
            type: 'file' as const,
            sessionId: h.session_id,
            sessionTitle: sessionTitleById.get(h.session_id) ?? h.session_id,
            messageId: h.message_id,
            fileName,
            snippet: h.snippet,
            matchIndex: lower.indexOf(q),
          };
        });
    },
    [sessions]
  );

  const featureHealth = options?.featureHealth;
  const backendSearchLive = featureHealth?.search === 'available';
  const backendScope = options?.backendScope ?? 'all';

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setMessageResults([]);
      setFileResults([]);
      setIsSearching(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const toSearch = sessionsToSearch(sessions, activeSessionId, backendSearchLive);
        const sessionTitleById = new Map(sessions.map((s) => [s.id, s.title]));

        const [messageBatches, fileBatches, backendHits] = await Promise.all([
          Promise.all(toSearch.map((s) => searchMessagesInSession(s, q))),
          Promise.all(toSearch.map((s) => searchFilesInSession(s, q))),
          featureHealth
            ? searchChatAdapter(featureHealth, {
                query: q,
                scope: backendScope,
                limit: SEARCH_RESULT_LIMIT_EXPANDED,
              }).catch(() => [])
            : chatService
                .searchChat({ query: q, scope: 'files', limit: SEARCH_RESULT_LIMIT_COMPACT })
                .catch(() => []),
        ]);

        const clientMessages = messageBatches.flat();
        const backendMessages = backendHits.filter(
          (h) => h.type === 'message' || h.type === 'session'
        );
        const mergedMessages = backendSearchLive
          ? mergeSearchResults(
              clientMessages,
              backendMessages,
              sessionTitleById,
              q,
              SEARCH_RESULT_LIMIT_EXPANDED
            ).filter((r) => r.type === 'message')
          : clientMessages.slice(0, SEARCH_RESULT_LIMIT_EXPANDED);
        setMessageResults(mergedMessages);

        const clientFiles = fileBatches.flat();
        const backendFiles = mapBackendFileHits(
          backendHits.filter((h) => h.type === 'file'),
          q
        );
        const mergedFiles: ChatSearchResult[] = [];
        const seen = new Set<string>();
        for (const r of [...backendFiles, ...clientFiles]) {
          const key = r.artifactId ?? `${r.sessionId}-${r.messageId ?? ''}-${r.fileName}`;
          if (seen.has(key)) continue;
          seen.add(key);
          mergedFiles.push(r);
        }
        setFileResults(mergedFiles.slice(0, SEARCH_RESULT_LIMIT_EXPANDED));
      } catch (error: unknown) {
        console.error('[useChatSearch]', error);
        setMessageResults([]);
        setFileResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    query,
    sessions,
    activeSessionId,
    searchMessagesInSession,
    searchFilesInSession,
    mapBackendFileHits,
    featureHealth,
    backendSearchLive,
    backendScope,
  ]);
  return {
    sessionResults,
    messageResults,
    fileResults,
    isSearching,
    hasQuery: query.trim().length >= 1,
  };
}
