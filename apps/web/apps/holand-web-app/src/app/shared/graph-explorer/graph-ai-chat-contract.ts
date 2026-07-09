// ============================================
// Graph AI Chat — Backend contract (v1)
// ============================================
//
// ## Where this payload goes
//
// The existing chat gateway already accepts `ChatRequest.context` as
// `Record<string, unknown> | null` (see `src/types/chat.types.ts`). The
// frontend will nest this graph payload under a single stable key so the
// gateway / orchestrator can merge it deterministically.
//
// ### HTTP body shape (POST `/chat/stream` via gateway proxy)
//
// ```json
// {
//   "message": "string — user text",
//   "session_id": "uuid | null",
//   "model": "string | null",
//   "stream": true,
//   "streaming": true,
//   "show_thinking": true,
//   "include_suggestions": true,
//   "artifacts": [],
//   "context": {
//     "graph_visual_explorer_v1": { ...GraphAiChatContextV1 }
//   }
// }
// ```
//
// ## Gateway / agent responsibilities
//
// 1. **Key stability**: Read only `context.graph_visual_explorer_v1`. Ignore
//    unknown sibling keys. If the key is missing, treat as “no graph UI context”.
// 2. **Schema version**: `schema_version` is required. If not `1`, the server
//    should log once and skip structured merge (still process `message`).
// 3. **Injection point**: After RBAC and session load, merge a compact text
//    block derived from this object into the planner / system context (not
//    necessarily visible to the end user). Recommended template:
//    `[Graph UI v1] route=… cases=[…] focus=… counts=… user_note=…`.
// 4. **`heavy` block**: Optional. May contain `stats`, `extraction_meta`, and
//    expanded `focus_record`. The gateway MUST enforce a byte budget (e.g. 24–64KB
//    JSON) and truncate with `truncated: true` if exceeded.
// 5. **Privacy**: `client.href` may contain tokens — strip query strings server-side
//    unless explicitly required for support flows.
//
// ## Frontend versioning
//
// When breaking structure, bump the object key to `graph_visual_explorer_v2`
// and keep v1 parsers for older mobile clients until sunset.

import type { GraphStats } from '@/types/graph-explorer.types';

/** Stable key inside `ChatRequest.context` — do not rename without backend sync. */
export const GRAPH_AI_CHAT_CONTEXT_KEY = 'graph_visual_explorer_v1' as const;

export const GRAPH_AI_CHAT_SCHEMA_VERSION = 1 as const;

/** How the standalone visualizer obtained its dataset. */
export type GraphAiDataSource = 'route' | 'session';

/** Focus target derived from the inspector (never send full canvas). */
export interface GraphAiChatFocusV1 {
  kind: 'node' | 'link' | 'community';
  id: string;
  label?: string;
  entity_type?: string;
  relation?: string;
  case_id?: string;
  artifact_id?: string;
  community_id?: number | null;
}

/** Optional pathfinding hint when the path panel is in use. */
export interface GraphAiChatPathfindingV1 {
  active: boolean;
  mode: string | null;
  source_node_id?: string | null;
  target_node_id?: string | null;
  /** Completed routes still on the graph (may be several after repeated runs). */
  result_layers?: Array<{
    source_node_id: string;
    target_node_id: string;
    mode: string;
    highlight: boolean;
  }>;
}

/** Optional “large” payload gated by UI toggle + gateway limits. */
export interface GraphAiChatHeavyV1 {
  stats?: GraphStats | null;
  extraction_meta?: unknown;
  /** Full inspector record for the focused node/link when `kind` is node|link. */
  focus_record?: Record<string, unknown> | null;
  /** Sample of visible node ids for disambiguation (capped client-side). */
  visible_node_id_sample?: string[];
  truncated?: boolean;
}

/**
 * Canonical graph-explorer context for LLM orchestration (v1).
 * Serialized under `context[GRAPH_AI_CHAT_CONTEXT_KEY]`.
 */
export interface GraphAiChatContextV1 {
  schema_version: typeof GRAPH_AI_CHAT_SCHEMA_VERSION;
  captured_at: string;
  client: {
    pathname: string;
    /** Full URL when available; server should strip sensitive query params. */
    href: string;
  };
  surface: 'standalone_visual_explorer';
  data_source: GraphAiDataSource;
  route_case_ids: string[];
  graph: {
    total_nodes: number;
    total_links: number;
    visible_nodes: number;
    visible_links: number;
  };
  filter: {
    query_builder_narrowed: boolean;
  };
  focus: GraphAiChatFocusV1 | null;
  pathfinding: GraphAiChatPathfindingV1;
  /** Free-text hint typed by the analyst in the floating panel. */
  user_note: string | null;
  heavy?: GraphAiChatHeavyV1 | null;
}

export type GraphAiChatContextRecord = Record<
  typeof GRAPH_AI_CHAT_CONTEXT_KEY,
  GraphAiChatContextV1
>;
