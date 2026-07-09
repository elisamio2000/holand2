// ============================================

// POST /memory/search → OneSearchHit (chat lane)

// ============================================



import { routes } from '@/config/routes';

import type { MemoryEntry } from '@/types/chat.types';

import type { OneSearchHit } from '@/types/one-search.types';



export const MEMORY_TOOL = 'memory.search';

export const MEMORY_ENDPOINT = 'POST /memory/search';



export function mapMemoryToHits(

  items: MemoryEntry[],

  query: string,

  args: Record<string, unknown>

): OneSearchHit[] {

  return items.map((entry, index) => ({

    id: `mem-${entry.id ?? index}`,

    title: entry.category ? `Memory (${entry.category})` : 'Memory',

    snippet: entry.content?.slice(0, 200) ?? '',

    href: entry.session_id
      ? routes.aiChat.session(entry.session_id)
      : routes.aiChat.root,

    score: typeof entry.score === 'number' ? entry.score : undefined,

    occurredAt: entry.created_at,

    meta: {

      memory_id: entry.id,

      session_id: entry.session_id,

      user_id: entry.user_id,

      is_long_term: entry.is_long_term,

      source: MEMORY_TOOL,

      sourceEndpoint: MEMORY_ENDPOINT,

      sourceArgs: args,

      lane: 'chat',

    },

  }));

}

