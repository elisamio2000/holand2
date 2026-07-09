// ============================================
// chat-timeline-cache — localStorage cache for AI Chat timeline/orchestrator
// state that the backend does not currently persist.
// ============================================

import type {
  ThinkingStep,
  ExecutionPlan,
  OrchestratorNodeName,
  UIMessage,
  WarningItem,
  SuggestionItem,
} from '@/types/chat.types';

/** Schema version — bump if the cached payload shape changes. */
const CACHE_VERSION = 2;
const STORAGE_KEY_PREFIX = `chatTimelineCache:v${CACHE_VERSION}:`;
/** Secondary lookup key prefix for trace_id → entry */
export const TRACE_CACHE_KEY_PREFIX = 'trace:';
/** TTL: 30 days. Older entries are pruned on read. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Soft cap on number of cached messages per session to bound storage. */
const MAX_MESSAGES_PER_SESSION = 200;

export interface TimelineCacheEntry {
  /** When this entry was written (epoch ms) */
  savedAt: number;
  /** Canonical message id (real backend id when known) */
  messageId?: string;
  /** Trace id for secondary lookup after page refresh */
  traceId?: string;
  /** Frontend-built reasoning timeline (full, not just buildStepsFromHistory) */
  thinkingSteps?: ThinkingStep[];
  /** Execution plan with tasks + states */
  executionPlan?: ExecutionPlan;
  /** Last orchestrator node */
  currentNode?: OrchestratorNodeName;
  /** Critic confidence */
  overallConfidence?: number;
  /** Replan count */
  replanCount?: number;
  /** Client-measured thinking duration */
  thinkingDuration?: number;
  /** Client-side stream start */
  streamStartedAt?: string;
  /** Non-fatal stream warnings */
  warnings?: WarningItem[];
  /** Follow-up suggestions */
  suggestions?: SuggestionItem[];
}

/** Per-session cached blob: lookupKey → entry */
interface SessionCache {
  version: number;
  updatedAt: number;
  messages: Record<string, TimelineCacheEntry>;
}

function storageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

function traceKey(traceId: string): string {
  return `${TRACE_CACHE_KEY_PREFIX}${traceId}`;
}

function safeGetStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSession(sessionId: string): SessionCache | null {
  const store = safeGetStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCache;
    if (!parsed || parsed.version !== CACHE_VERSION || typeof parsed.messages !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(sessionId: string, cache: SessionCache): void {
  const store = safeGetStorage();
  if (!store) return;
  try {
    store.setItem(storageKey(sessionId), JSON.stringify(cache));
  } catch (err) {
    console.warn('[chatTimelineCache] Failed to persist; pruning oldest entries.', err);
    try {
      const pruned = pruneOldest(cache, Math.max(20, Math.floor(MAX_MESSAGES_PER_SESSION / 2)));
      store.setItem(storageKey(sessionId), JSON.stringify(pruned));
    } catch {
      // Give up silently
    }
  }
}

function pruneOldest(cache: SessionCache, keep: number): SessionCache {
  const entries = Object.entries(cache.messages);
  if (entries.length <= keep) return cache;
  entries.sort((a, b) => (b[1].savedAt ?? 0) - (a[1].savedAt ?? 0));
  const kept = entries.slice(0, keep);
  return {
    ...cache,
    messages: Object.fromEntries(kept),
  };
}

function pruneExpiredMessages(
  messages: Record<string, TimelineCacheEntry>,
  now: number
): Record<string, TimelineCacheEntry> {
  const fresh: Record<string, TimelineCacheEntry> = {};
  for (const [id, val] of Object.entries(messages)) {
    if (val && typeof val.savedAt === 'number' && now - val.savedAt < CACHE_TTL_MS) {
      fresh[id] = val;
    }
  }
  return fresh;
}

function writeEntryUnderKeys(
  messages: Record<string, TimelineCacheEntry>,
  keys: string[],
  entry: TimelineCacheEntry
): Record<string, TimelineCacheEntry> {
  const next = { ...messages };
  for (const key of keys) {
    if (key) next[key] = entry;
  }
  return next;
}

/**
 * Persist a single message's timeline state under message id and optional trace id.
 */
export function saveMessageTimeline(
  sessionId: string,
  messageId: string,
  entry: Omit<TimelineCacheEntry, 'savedAt'>,
  options?: { traceId?: string }
): void {
  if (!sessionId || !messageId) return;
  const now = Date.now();
  const existing = readSession(sessionId) ?? {
    version: CACHE_VERSION,
    updatedAt: now,
    messages: {},
  };

  const fresh = pruneExpiredMessages(existing.messages, now);
  const traceId = options?.traceId ?? entry.traceId;
  const saved: TimelineCacheEntry = {
    ...entry,
    messageId,
    traceId: traceId ?? entry.traceId,
    savedAt: now,
  };

  const keys = [messageId];
  if (traceId) keys.push(traceKey(traceId));

  let nextMessages = writeEntryUnderKeys(fresh, keys, saved);

  let next: SessionCache = {
    version: CACHE_VERSION,
    updatedAt: now,
    messages: nextMessages,
  };

  if (Object.keys(next.messages).length > MAX_MESSAGES_PER_SESSION) {
    next = pruneOldest(next, MAX_MESSAGES_PER_SESSION);
  }

  writeSession(sessionId, next);
}

/**
 * Move cached timeline from a temp client id to the real backend message id.
 */
export function remapMessageTimelineEntry(
  sessionId: string,
  fromMessageId: string,
  toMessageId: string,
  traceId?: string
): void {
  if (!sessionId || !fromMessageId || !toMessageId || fromMessageId === toMessageId) return;

  const existing = readSession(sessionId);
  if (!existing) return;

  const entry =
    existing.messages[fromMessageId] ??
    (traceId ? existing.messages[traceKey(traceId)] : undefined);
  if (!entry) return;

  const now = Date.now();
  const fresh = pruneExpiredMessages(existing.messages, now);
  delete fresh[fromMessageId];
  if (traceId) delete fresh[traceKey(traceId)];

  const updated: TimelineCacheEntry = {
    ...entry,
    messageId: toMessageId,
    traceId: traceId ?? entry.traceId,
    savedAt: now,
  };

  const keys = [toMessageId];
  const resolvedTrace = traceId ?? entry.traceId;
  if (resolvedTrace) keys.push(traceKey(resolvedTrace));

  writeSession(sessionId, {
    version: CACHE_VERSION,
    updatedAt: now,
    messages: writeEntryUnderKeys(fresh, keys, updated),
  });
}

/**
 * Read the entire session cache (lookupKey → entry).
 */
export function loadSessionTimeline(sessionId: string): Record<string, TimelineCacheEntry> {
  const cache = readSession(sessionId);
  if (!cache) return {};
  const now = Date.now();
  const result: Record<string, TimelineCacheEntry> = {};
  for (const [id, val] of Object.entries(cache.messages)) {
    if (val && typeof val.savedAt === 'number' && now - val.savedAt < CACHE_TTL_MS) {
      result[id] = val;
    }
  }
  return result;
}

/** Resolve cache entry for a loaded message (by id, then trace_id). */
export function resolveTimelineCacheEntry(
  cache: Record<string, TimelineCacheEntry>,
  message: UIMessage
): TimelineCacheEntry | undefined {
  const byId = cache[message.id];
  if (byId) return byId;
  if (message.trace_id) {
    return cache[traceKey(message.trace_id)];
  }
  return undefined;
}

export function clearSessionTimeline(sessionId: string): void {
  const store = safeGetStorage();
  if (!store) return;
  try {
    store.removeItem(storageKey(sessionId));
  } catch {
    // ignore
  }
}

export function clearSessionsTimeline(sessionIds: string[]): void {
  for (const id of sessionIds) clearSessionTimeline(id);
}

/**
 * Merge cached timeline state into messages loaded from the backend.
 * Lookup order: message.id → trace_id → unchanged.
 */
export function mergeMessagesWithCache(
  sessionId: string,
  messages: UIMessage[]
): UIMessage[] {
  const cache = loadSessionTimeline(sessionId);
  if (Object.keys(cache).length === 0) return messages;

  return messages.map((m) => {
    const entry = resolveTimelineCacheEntry(cache, m);
    if (!entry) return m;

    const merged: UIMessage = { ...m };

    if ((!merged.thinkingSteps || merged.thinkingSteps.length === 0) && entry.thinkingSteps?.length) {
      merged.thinkingSteps = entry.thinkingSteps;
    }
    if (!merged.executionPlan && entry.executionPlan) {
      merged.executionPlan = entry.executionPlan;
    }
    if (!merged.currentNode && entry.currentNode) {
      merged.currentNode = entry.currentNode;
    }
    if (merged.overallConfidence == null && entry.overallConfidence != null) {
      merged.overallConfidence = entry.overallConfidence;
    }
    if (merged.replanCount == null && entry.replanCount != null) {
      merged.replanCount = entry.replanCount;
    }
    if (merged.thinkingDuration == null && entry.thinkingDuration != null) {
      merged.thinkingDuration = entry.thinkingDuration;
    }
    if (!merged.streamStartedAt && entry.streamStartedAt) {
      merged.streamStartedAt = entry.streamStartedAt;
    }
    if ((!merged.warnings || merged.warnings.length === 0) && entry.warnings?.length) {
      merged.warnings = entry.warnings;
    }
    if ((!merged.suggestions || merged.suggestions.length === 0) && entry.suggestions?.length) {
      merged.suggestions = entry.suggestions;
    }
    return merged;
  });
}
