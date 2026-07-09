import type { ChatSearchHit } from '@/types/chat.types';
import type { ChatSearchResult } from '@/app/shared/ai-chat/hooks/use-chat-search';
import { highlightSnippetText } from './highlight-query';

function hitKey(hit: ChatSearchHit | ChatSearchResult): string {
  if ('sessionId' in hit) {
    const r = hit as ChatSearchResult;
    return `${r.type}-${r.sessionId}-${r.messageId ?? r.artifactId ?? r.snippet}`;
  }
  const h = hit as ChatSearchHit;
  return `${h.type}-${h.session_id}-${h.message_id ?? h.snippet}`;
}

function mapBackendHit(
  hit: ChatSearchHit,
  sessionTitleById: Map<string, string>,
  query: string
): ChatSearchResult {
  return {
    type: hit.type === 'session' ? 'session' : hit.type === 'file' ? 'file' : 'message',
    sessionId: hit.session_id,
    sessionTitle: sessionTitleById.get(hit.session_id) ?? hit.session_id,
    messageId: hit.message_id,
    fileName: hit.type === 'file' ? hit.snippet : undefined,
    snippet: highlightSnippetText(hit.snippet, query),
    matchIndex: hit.snippet.toLowerCase().indexOf(query.toLowerCase()),
  };
}

export function mergeSearchResults(
  client: ChatSearchResult[],
  backend: ChatSearchHit[],
  sessionTitleById: Map<string, string>,
  query: string,
  limit: number
): ChatSearchResult[] {
  const merged: ChatSearchResult[] = [];
  const seen = new Set<string>();

  const push = (item: ChatSearchResult) => {
    const key = hitKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  for (const hit of backend) {
    push(mapBackendHit(hit, sessionTitleById, query));
  }

  const clientSorted = [...client].sort((a, b) => {
    const scoreA = a.matchIndex >= 0 ? a.matchIndex : 9999;
    const scoreB = b.matchIndex >= 0 ? b.matchIndex : 9999;
    return scoreA - scoreB;
  });

  for (const item of clientSorted) {
    push(item);
  }

  return merged.slice(0, limit);
}

export function mergeMessageAndFileResults(
  messages: ChatSearchResult[],
  files: ChatSearchResult[],
  limit: number
): { messages: ChatSearchResult[]; files: ChatSearchResult[] } {
  return {
    messages: messages.slice(0, limit),
    files: files.slice(0, limit),
  };
}
