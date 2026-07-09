// ============================================
// useChat — AI Chat state management hook
// Manages sessions, messages, streaming, and UI state
// Uses Jotai for global state + chatService for API calls
// ============================================

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { chatService, normalizeArtifactsFromPayload } from '@/services/chat.service';
import { traceService } from '@/services/trace.service';
import { debugLog } from '@/utils/debug-logger';
import { compressImages } from '@/utils/image-compress';
import { normalizeDoneEventToolRuns, normalizeToolCallsToRuns } from '@/utils/normalize-tool-run';
import {
  saveMessageTimeline,
  mergeMessagesWithCache,
  remapMessageTimelineEntry,
  clearSessionTimeline,
  clearSessionsTimeline,
  type TimelineCacheEntry,
} from '@/utils/chat-timeline-cache';
import {
  CHAT_PREFERRED_MODEL_STORAGE_KEY,
} from '@/utils/chat-models-resolve';
import { getCachedTrace } from '@/utils/trace-cache';
import {
  resolveFinalAssistantContent,
} from '@/utils/sanitize-assistant-content';
import { useOnWorkspaceChanged } from '@/hooks/use-workspace-scope';
import {
  DEFAULT_MODEL,
  type ChatSession,
  type UIMessage,
  type StreamEvent,
  type CanvasContent,
  type MessageFeedback,
  type ToolRunInfo,
  type SuggestionItem,
  type WarningItem,
  type ModelInfo,
  type ArtifactInput,
  type FileUploadProgress,
  type ThinkingStep,
  type ExecutionPlan,
  type CriticEvaluation,
  type OrchestratorNodeName,
  type TraceDetail,
  type ChatMessage,
} from '@/types/chat.types';

// ==========================================
// Jotai Atoms — Global Chat State
// ==========================================

/** Currently active session ID */
const activeSessionIdAtom = atom<string | null>(null);

/** List of user's chat sessions */
const sessionsAtom = atom<ChatSession[]>([]);

/** Messages for the active session */
const messagesAtom = atom<UIMessage[]>([]);

/** Whether AI is currently streaming a response */
const isStreamingAtom = atom(false);

/** Whether sessions list is loading */
const isLoadingSessionsAtom = atom(false);

/** Whether messages are loading */
const isLoadingMessagesAtom = atom(false);

/** Sidebar open state */
const isSidebarOpenAtom = atom(true);

/** Canvas panel content */
const canvasContentAtom = atom<CanvasContent | null>(null);

/** Selected LLM model */
const selectedModelAtom = atom(DEFAULT_MODEL);

/** Session search query */
const searchQueryAtom = atom('');

/** Show archived sessions toggle */
const showArchivedAtom = atom(false);

/** Available LLM models fetched from API */
const availableModelsAtom = atom<ModelInfo[]>([]);

/** Whether models are loading */
const isLoadingModelsAtom = atom(false);

/**
 * Per-session upload progress map.
 * Keyed by session ID so each conversation's uploads are independent.
 * This allows background uploads to continue when switching conversations.
 */
const uploadProgressMapAtom = atom<Record<string, FileUploadProgress[]>>({});

/**
 * Per-session uploading flag map.
 * Keyed by session ID — true if that session has files being uploaded.
 */
const isUploadingMapAtom = atom<Record<string, boolean>>({});

/**
 * Cache of local blob preview URLs for uploaded artifacts.
 * Maps artifact ID → blob URL for the current browser session.
 * Used by ArtifactsPanel to show image thumbnails without a backend file-serving endpoint.
 * Only valid during the current page session — cleared on refresh.
 */
export const artifactPreviewCacheAtom = atom<Record<string, string>>({});

// ==========================================
// Reasoning Timeline Helpers
// ==========================================

/**
 * Finalize reasoning timeline steps after streaming completes.
 * Marks all remaining active steps as done and ensures
 * an answer step exists at the end.
 *
 * @param steps - Accumulated steps from streaming
 * @returns Finalized, immutable steps array
 */
function finalizeSteps(steps: ThinkingStep[]): ThinkingStep[] {
  if (steps.length === 0) return [];

  // Mark any still-active steps as done
  let finalized = steps.map((s) =>
    s.isActive ? { ...s, isActive: false } : s
  );

  // Ensure there's an answer step at the end
  const hasAnswer = finalized.some((s) => s.type === 'answer');
  if (!hasAnswer) {
    finalized = [
      ...finalized,
      {
        type: 'answer' as const,
        content: 'Answer generated',
        isActive: false,
        stepNumber: finalized.length + 1,
        timestamp: Date.now(),
      },
    ];
  }

  return finalized;
}

/**
 * Match a progress event to a plan task index.
 * Prefers stable `task_id` from backend; falls back to normalized description.
 */
/** Max assistant traces to enrich on session load (rest lazy on expand). */
const TRACE_ENRICHMENT_CAP = 5;

/** Client-only or in-flight messages that must not be wiped by selectSession. */
function isOptimisticMessage(m: UIMessage): boolean {
  return m.id.startsWith('temp-') || !!m.isStreaming;
}

function messageSortKey(m: UIMessage): number {
  return m.created_at ? new Date(m.created_at).getTime() : 0;
}

/** Map API message to UI state defaults. */
function toUIMessage(msg: ChatMessage): UIMessage {
  return {
    ...msg,
    isStreaming: false,
    feedback: null,
    thinkingExpanded: false,
  };
}

/** Merge API messages with optimistic temp/streaming messages for the same session. */
function mergeSessionMessagesWithOptimistic(
  fromApi: UIMessage[],
  optimistic: UIMessage[]
): UIMessage[] {
  if (optimistic.length === 0) return fromApi;
  const apiIds = new Set(fromApi.map((m) => m.id));
  const merged = [...fromApi];
  for (const opt of optimistic) {
    if (!apiIds.has(opt.id)) merged.push(opt);
  }
  return merged.sort((a, b) => messageSortKey(a) - messageSortKey(b));
}

function findPlanTaskMatchIndex(
  planTasks: NonNullable<ThinkingStep['tasks']>,
  progressTaskId: string | undefined,
  taskDescNorm: string
): number {
  if (progressTaskId) {
    const byId = planTasks.findIndex(
      (t) => t.taskId === progressTaskId || t.taskId === String(progressTaskId)
    );
    if (byId >= 0) return byId;
  }
  if (!taskDescNorm) return -1;
  return planTasks.findIndex((t) => {
    const tn = t.description
      .toLowerCase()
      .replace(/^executing:\s*/i, '')
      .replace(/^processing:\s*/i, '')
      .replace(/[.…\s]+$/g, '')
      .trim();
    if (!tn) return false;
    return tn === taskDescNorm || tn.includes(taskDescNorm) || taskDescNorm.includes(tn);
  });
}

/**
 * After stream completes, reconcile temp client message id with backend id,
 * mirror timeline to localStorage (by id + trace_id), and best-effort PATCH metadata.
 */
async function persistAssistantTimeline(
  sessionId: string,
  tempMessageId: string,
  traceId: string | undefined,
  entry: Omit<TimelineCacheEntry, 'savedAt'>,
  onRealId?: (realId: string) => void
): Promise<void> {
  let cacheMessageId = tempMessageId;

  try {
    const latest = await chatService.listMessages(sessionId, { limit: 12 });
    const assistants = latest.filter((m) => m.role === 'assistant');
    const matched =
      (traceId
        ? assistants.find(
            (m) =>
              (m as ChatMessage & { trace_id?: string }).trace_id === traceId ||
              m.metadata?.trace_id === traceId ||
              m.metadata?.traceId === traceId
          )
        : undefined) ?? assistants[assistants.length - 1];

    if (matched?.id && matched.id !== tempMessageId) {
      cacheMessageId = matched.id;
      remapMessageTimelineEntry(sessionId, tempMessageId, matched.id, traceId);
      onRealId?.(matched.id);
    }
  } catch (err) {
    console.warn('[useChat] Could not reconcile message id for timeline cache:', err);
  }

  saveMessageTimeline(sessionId, cacheMessageId, entry, { traceId });

  if (cacheMessageId && !cacheMessageId.startsWith('temp-')) {
    void chatService.updateMessageTimeline(cacheMessageId, {
      thinkingSteps: entry.thinkingSteps,
      executionPlan: entry.executionPlan ?? null,
      currentNode: entry.currentNode ?? null,
      overallConfidence: entry.overallConfidence ?? null,
      replanCount: entry.replanCount ?? null,
      thinkingDuration: entry.thinkingDuration ?? null,
      warnings: entry.warnings,
      suggestions: entry.suggestions,
    });
  }
}

/**
 * Reconstruct an approximate reasoning timeline from historical message data.
 *
 * The backend only persists `thinking` (text) and `tool_runs` (array),
 * not the interleaved step sequence. When `reasoningSegments` (from backend's
 * `reasoning` array) is available, we interleave them with tool_runs to
 * reconstruct the original chronological order:
 *   thinking₁ → tool₁ → thinking₂ → tool₂ → … → answer
 *
 * Without segments, falls back to: thinking → tool₁ → tool₂ → … → answer.
 *
 * @param thinking - Full thinking text from the message (joined fallback)
 * @param toolRuns - Array of tool run info objects
 * @param reasoningSegments - Individual reasoning phase texts (preserved from backend array)
 * @returns Reconstructed steps array with best-effort interleaving
 */
export function buildStepsFromHistory(
  thinking: string | null,
  toolRuns: ToolRunInfo[] | undefined,
  reasoningSegments?: string[]
): ThinkingStep[] {
  const steps: ThinkingStep[] = [];
  let stepNum = 0;

  // ── With reasoning segments: interleave with tool runs ──
  // WHY: The backend's `reasoning` array typically contains one segment
  // per thinking phase: segment[0] = before tool₁, segment[1] = before tool₂, etc.
  // This heuristic reconstructs the timeline close to the original streaming order.
  if (reasoningSegments && reasoningSegments.length > 0 && toolRuns && toolRuns.length > 0) {
    const maxInterleave = Math.max(reasoningSegments.length, toolRuns.length);

    for (let i = 0; i < maxInterleave; i++) {
      // Add thinking segment (if available at this position)
      if (i < reasoningSegments.length) {
        stepNum++;
        steps.push({
          type: 'thinking',
          content: reasoningSegments[i],
          isActive: false,
          stepNumber: stepNum,
          timestamp: 0,
        });
      }

      // Add tool run (if available at this position)
      if (i < toolRuns.length) {
        stepNum++;
        steps.push({
          type: 'tool',
          content: '',
          tool: toolRuns[i],
          isActive: false,
          stepNumber: stepNum,
          timestamp: 0,
        });
      }
    }
  } else if (reasoningSegments && reasoningSegments.length > 0) {
    // ── Reasoning segments without tools: each segment = separate thinking step ──
    for (const segment of reasoningSegments) {
      stepNum++;
      steps.push({
        type: 'thinking',
        content: segment,
        isActive: false,
        stepNumber: stepNum,
        timestamp: 0,
      });
    }
  } else {
    // ── Fallback: single thinking block + all tools sequentially ──
    if (thinking) {
      stepNum++;
      steps.push({
        type: 'thinking',
        content: thinking,
        isActive: false,
        stepNumber: stepNum,
        timestamp: 0,
      });
    }

    if (toolRuns?.length) {
      for (const tool of toolRuns) {
        stepNum++;
        steps.push({
          type: 'tool',
          content: '',
          tool,
          isActive: false,
          stepNumber: stepNum,
          timestamp: 0,
        });
      }
    }
  }

  // Add answer step only if there was thinking or tools
  if (steps.length > 0) {
    stepNum++;
    steps.push({
      type: 'answer',
      content: 'Answer generated',
      isActive: false,
      stepNumber: stepNum,
      timestamp: 0,
    });
  }

  return steps;
}

/**
 * Build a ThinkingStep[] timeline from a backend TraceDetail object.
 *
 * Used to reconstruct the full Thought Process for HISTORICAL messages
 * (where streaming events are not available). Maps:
 * - TraceStep (assess_complexity, planner, executor, critic, ...) → 'node' step
 * - planner output_data.plan → 'plan' step with tasks
 * - critic output_data → 'evaluation' step
 * - tool_executions → 'tool' steps under their parent node
 *
 * @param trace - Full trace detail from GET /traces/{id}?full=true
 * @returns Reconstructed ThinkingStep[] preserving execution order
 */
export function buildStepsFromTrace(trace: TraceDetail): ThinkingStep[] {
  debugLog.trace('buildStepsFromTrace: start', {
    traceId: trace.trace_id,
    stepsCount: trace.steps?.length ?? 0,
    toolsCount: trace.tool_executions?.length ?? 0,
  });
  const steps: ThinkingStep[] = [];
  let stepNum = 0;
  const traceSteps = [...(trace.steps ?? [])].sort((a, b) => a.step_number - b.step_number);
  const tools = trace.tool_executions ?? [];

  for (const ts of traceSteps) {
    const isPlannerNode = ts.node_name === 'planner';
    const isCriticNode = ts.node_name === 'critic';
    const status = ts.status;
    const isActive = status === 'running';

    // ── Add the node step itself ──
    stepNum++;
    const nodeLabel = ts.node_name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // For planner: extract tasks from output_data.plan
    if (isPlannerNode && ts.output_data) {
      const planData = (ts.output_data.plan ?? ts.output_data) as Record<string, unknown>;
      const planTasks = ((planData.tasks as Array<Record<string, unknown>>) ?? [])
        .map((task) => ({
          description: (task.description as string) || (task.name as string) || '',
          state: 'completed' as const, // Historical: all done
        }))
        .filter((t) => t.description.length > 0);

      // Add the node row
      steps.push({
        type: 'node',
        content: nodeLabel,
        nodeName: ts.node_name,
        isActive: false,
        stepNumber: stepNum,
        timestamp: ts.started_at ? new Date(ts.started_at).getTime() : 0,
      });

      // Add plan step with tasks if available
      if (planTasks.length > 0) {
        stepNum++;
        steps.push({
          type: 'plan',
          content: `Execution Plan: ${planTasks.length} task${planTasks.length !== 1 ? 's' : ''}`,
          plan: planData as unknown as ExecutionPlan,
          tasks: planTasks,
          totalTaskCount: planTasks.length,
          isActive: false,
          stepNumber: stepNum,
          timestamp: ts.started_at ? new Date(ts.started_at).getTime() : 0,
        });
      }
      continue;
    }

    // For critic: extract evaluation from output_data
    if (isCriticNode && ts.output_data) {
      const evalData = ts.output_data as unknown as CriticEvaluation;
      steps.push({
        type: 'node',
        content: nodeLabel,
        nodeName: ts.node_name,
        isActive: false,
        stepNumber: stepNum,
        timestamp: ts.started_at ? new Date(ts.started_at).getTime() : 0,
      });
      stepNum++;
      steps.push({
        type: 'evaluation',
        content: 'Critic Evaluation',
        evaluation: evalData,
        confidence: (evalData as unknown as { overall_confidence?: number }).overall_confidence,
        isActive: false,
        stepNumber: stepNum,
        timestamp: ts.completed_at ? new Date(ts.completed_at).getTime() : 0,
      });
      continue;
    }

    // Generic node row
    steps.push({
      type: 'node',
      content: nodeLabel,
      nodeName: ts.node_name,
      isActive,
      stepNumber: stepNum,
      timestamp: ts.started_at ? new Date(ts.started_at).getTime() : 0,
    });

    // ── Attach tools that belong to this step ──
    const stepTools = tools.filter((t) => t.step_number === ts.step_number);
    for (const tool of stepTools) {
      stepNum++;
      steps.push({
        type: 'tool',
        content: tool.tool_name,
        tool: {
          tool_id: tool.tool_name,
          args: tool.arguments,
          result: typeof tool.result === 'object' && tool.result !== null
            ? (tool.result as Record<string, unknown>)
            : { value: tool.result },
          status: tool.status === 'completed' ? 'success' : tool.status === 'failed' ? 'error' : undefined,
          execution_time: tool.duration_ms ? tool.duration_ms / 1000 : undefined,
        },
        isActive: false,
        stepNumber: stepNum,
        timestamp: 0,
      });
    }
  }

  // Final answer marker
  if (steps.length > 0) {
    stepNum++;
    steps.push({
      type: 'answer',
      content: 'Answer generated',
      isActive: false,
      stepNumber: stepNum,
      timestamp: 0,
    });
  }

  debugLog.trace('buildStepsFromTrace: done', {
    totalSteps: steps.length,
    stepTypes: steps.map((s) => s.type),
  });
  return steps;
}

// ==========================================
// Hook Definition
// ==========================================

/**
 * useChat — Main hook for AI chat page state and actions.
 *
 * Provides complete state management for:
 * - Session CRUD (create, list, rename, delete, archive, pin)
 * - Message sending with streaming support
 * - Stream control (abort/stop)
 * - UI state (sidebar, canvas, model selection)
 *
 * @returns Chat state and action methods
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isStreaming, stopStreaming } = useChat();
 * ```
 */
function sortSessionsByActivity(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return (b.message_count ?? 0) - (a.message_count ?? 0);
  });
}

export function useChat() {
  const { t } = useTranslation();
  const [activeSessionId, setActiveSessionId] = useAtom(activeSessionIdAtom);
  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [messages, setMessages] = useAtom(messagesAtom);
  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
  const [isLoadingSessions, setIsLoadingSessions] = useAtom(
    isLoadingSessionsAtom
  );
  const [isLoadingMessages, setIsLoadingMessages] = useAtom(
    isLoadingMessagesAtom
  );
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(isSidebarOpenAtom);
  const [canvasContent, setCanvasContent] = useAtom(canvasContentAtom);
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [showArchived, setShowArchived] = useAtom(showArchivedAtom);
  const [availableModels, setAvailableModels] = useAtom(availableModelsAtom);
  const [isLoadingModels, setIsLoadingModels] = useAtom(isLoadingModelsAtom);
  const [uploadProgressMap, setUploadProgressMap] = useAtom(uploadProgressMapAtom);
  const [isUploadingMap, setIsUploadingMap] = useAtom(isUploadingMapAtom);
  const [, setArtifactPreviewCache] = useAtom(artifactPreviewCacheAtom);

  // AbortController ref for cancelling streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // AbortController ref for cancelling file uploads
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Ref to track the current active session ID — avoids stale closures in long-running sendMessage
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  /** Ignore stale `selectSession` results when the user switches chats quickly. */
  const messagesLoadGenRef = useRef(0);
  /** Session id whose messages were successfully fetched for the current list. */
  const messagesLoadedForSessionRef = useRef<string | null>(null);
  /** Apply platform default_model from gateway once per chat visit. */
  const modelDefaultSyncedRef = useRef(false);
  const chatBootstrapDoneRef = useRef(false);
  /** Session created by sendMessage/createNewSession — skip URL-driven reload. */
  const programmaticSessionRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  const traceEnrichingIdsRef = useRef(new Set<string>());
  const [traceEnrichingVersion, setTraceEnrichingVersion] = useState(0);

  const messageNeedsTraceEnrichment = useCallback((m: UIMessage) => {
    return (
      m.role === 'assistant' &&
      !!m.trace_id &&
      (!m.thinkingSteps || m.thinkingSteps.length === 0) &&
      !(m.tool_runs && m.tool_runs.length > 0)
    );
  }, []);

  const enrichMessageTrace = useCallback(
    async (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg?.trace_id || !messageNeedsTraceEnrichment(msg)) return;
      if (traceEnrichingIdsRef.current.has(messageId)) return;

      traceEnrichingIdsRef.current.add(messageId);
      setTraceEnrichingVersion((v) => v + 1);
      try {
        const trace = await getCachedTrace(msg.trace_id, true);
        const steps = buildStepsFromTrace(trace);
        debugLog.trace('Trace fetch OK (lazy)', {
          messageId,
          traceId: msg.trace_id,
          stepsBuilt: steps.length,
        });
        if (steps.length > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, thinkingSteps: steps } : m
            )
          );
        }
      } catch (err) {
        console.error(
          '[useChat] Failed to load trace for message:',
          messageId,
          msg.trace_id,
          err
        );
      } finally {
        traceEnrichingIdsRef.current.delete(messageId);
        setTraceEnrichingVersion((v) => v + 1);
      }
    },
    [messageNeedsTraceEnrichment, setMessages]
  );

  const isTraceEnriching = useCallback(
    (messageId: string) => traceEnrichingIdsRef.current.has(messageId),
    // traceEnrichingVersion triggers re-render when enrichment set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [traceEnrichingVersion]
  );

  // ==========================================
  // Session Actions
  // ==========================================

  const sessionListFiltersRef = useRef<{
    folder_id?: string;
    chat_mode?: 'hub';
  }>({});

  /**
   * Server-side session list filters (e.g. active sidebar folder).
   */
  const setSessionListFilters = useCallback(
    (filters: { folder_id?: string | null }) => {
      sessionListFiltersRef.current = filters.folder_id
        ? { folder_id: filters.folder_id, chat_mode: 'hub' }
        : {};
    },
    []
  );

  /**
   * Load all sessions from backend.
   */
  const loadSessions = useCallback(async () => {
    console.info('[useChat] Loading sessions...');
    setIsLoadingSessions(true);
    try {
      const data = await chatService.listSessions({
        limit: 100,
        include_archived: showArchived,
        ...sessionListFiltersRef.current,
      });
      setSessions(sortSessionsByActivity(data));
      console.info('[useChat] Sessions loaded:', { count: data.length });
    } catch (error: unknown) {
      console.error('[useChat] Failed to load sessions:', error);
      toast.error(t('chatPage.toasts.loadConversationsFailed'));
    } finally {
      setIsLoadingSessions(false);
    }
  }, [showArchived, setSessions, setIsLoadingSessions, t]);

  useOnWorkspaceChanged(() => {
    setActiveSessionId(null);
    setMessages([]);
    void loadSessions();
  });

  /**
   * Load available LLM models from backend.
   * Model from GET /admin/llm/routes → service.orchestrator.chat
   */
  const loadModels = useCallback(async () => {
    console.info('[useChat] Loading chat model from admin LLM routes...');
    setIsLoadingModels(true);
    try {
      const snapshot = await chatService.loadChatModels();
      if (snapshot.resolved && snapshot.models.length > 0) {
        setAvailableModels(snapshot.models);
        let preferred = snapshot.defaultModel;
        try {
          const stored = localStorage.getItem(CHAT_PREFERRED_MODEL_STORAGE_KEY);
          if (stored && snapshot.models.some((m) => m.id === stored)) {
            preferred = stored;
          }
        } catch {
          /* ignore */
        }
        setSelectedModel(preferred);
        modelDefaultSyncedRef.current = true;
        console.info('[useChat] Chat model bound:', {
          modelId: snapshot.defaultModel,
          display_name: snapshot.models[0]?.display_name,
        });
      } else {
        console.warn(
          '[useChat] Chat model not resolved (check service.orchestrator.chat route in admin)'
        );
        setAvailableModels([]);
        setSelectedModel(DEFAULT_MODEL);
      }
    } catch (error: unknown) {
      console.warn('[useChat] Failed to load chat model:', error);
      setAvailableModels([]);
      setSelectedModel(DEFAULT_MODEL);
    } finally {
      setIsLoadingModels(false);
    }
  }, [setAvailableModels, setIsLoadingModels, setSelectedModel]);

  /**
   * Create a new chat session and select it.
   */
  const createNewSession = useCallback(async () => {
    console.info('[useChat] Creating new session...');
    try {
      const session = await chatService.createSession({
        model: selectedModel,
        chat_mode: 'hub',
      });
      setSessions((prev) => [session, ...prev]);
      programmaticSessionRef.current = session.id;
      setActiveSessionId(session.id);
      setMessages([]);
      console.info('[useChat] New session created:', { id: session.id });
      return session;
    } catch (error: unknown) {
      console.error('[useChat] Failed to create session:', error);
      toast.error(t('chatPage.toasts.newConversationFailed'));
      return null;
    }
  }, [selectedModel, setSessions, setActiveSessionId, setMessages]);

  /**
   * Select a session and load its messages.
   */
  const selectSession = useCallback(
    async (sessionId: string, options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const sameSession = activeSessionIdRef.current === sessionId;
      const currentMessages = messagesRef.current;
      const hasOptimistic = currentMessages.some(
        (m) => m.session_id === sessionId && isOptimisticMessage(m)
      );
      const streaming = isStreamingRef.current;

      if (
        !force &&
        sameSession &&
        messagesLoadedForSessionRef.current === sessionId
      ) {
        console.info('[useChat] Session messages already loaded, skipping:', {
          sessionId,
        });
        setActiveSessionId(sessionId);
        return;
      }

      if (
        !force &&
        sameSession &&
        (streaming || hasOptimistic || programmaticSessionRef.current === sessionId)
      ) {
        console.info('[useChat] Skipping session reload — stream or optimistic messages:', {
          sessionId,
          streaming,
          hasOptimistic,
        });
        setActiveSessionId(sessionId);
        messagesLoadedForSessionRef.current = sessionId;
        programmaticSessionRef.current = null;
        return;
      }

      const preservedOptimistic = currentMessages.filter(
        (m) => m.session_id === sessionId && isOptimisticMessage(m)
      );
      const mustPreserveOptimistic = streaming || preservedOptimistic.length > 0;

      const loadGen = ++messagesLoadGenRef.current;
      console.info('[useChat] Selecting session:', { sessionId, loadGen });
      setActiveSessionId(sessionId);
      messagesLoadedForSessionRef.current = null;
      if (!mustPreserveOptimistic) {
        setMessages([]);
      }
      setIsLoadingMessages(true);
      setCanvasContent(null);

      try {
        // Fetch messages and session traces in parallel
        // WHY: Backend MessageResponse doesn't include trace_id, so we cross-reference
        // session traces by chronological order to attach trace_id to assistant messages.
        // This enables the TracePanel and full Thought Process replay for history.
        const data = await chatService.listMessages(sessionId, { include_tool_runs: true });

        const assistantMsgs = data.filter((m) => m.role === 'assistant');
        const allHaveTraceId =
          assistantMsgs.length > 0 &&
          assistantMsgs.every(
            (m) => Boolean((m as ChatMessage & { trace_id?: string }).trace_id)
          );

        const sessionTraces = allHaveTraceId
          ? []
          : await traceService
              .listTraces({ session_id: sessionId, limit: 100 })
              .catch((err) => {
                console.warn('[useChat] Failed to fetch session traces (non-fatal):', err);
                return [] as Awaited<ReturnType<typeof traceService.listTraces>>;
              });

        // Sort traces by started_at ascending — aligns with message timeline
        const sortedTraces = [...sessionTraces].sort((a, b) => {
          const ta = new Date(a.started_at ?? 0).getTime();
          const tb = new Date(b.started_at ?? 0).getTime();
          return ta - tb;
        });

        // Prefer explicit trace ↔ message links from gateway (`message_id` on trace)
        const traceByMessageId = new Map<string, string>();
        for (const tr of sortedTraces) {
          if (tr.message_id) {
            traceByMessageId.set(tr.message_id, tr.trace_id);
          }
        }
        const assignedTraceIds = new Set<string>();

        let uiMessagesInitial: UIMessage[] = data.map((msg) => {
          const m = toUIMessage(msg);
          if (msg.role === 'assistant' && !m.trace_id) {
            const linked = traceByMessageId.get(msg.id);
            if (linked) {
              m.trace_id = linked;
              assignedTraceIds.add(linked);
            }
          }
          if (m.trace_id) assignedTraceIds.add(m.trace_id);
          return m;
        });

        // Fallback: same count/order heuristic when gateway omits message_id
        const leftoverTraces = sortedTraces.filter((t) => !assignedTraceIds.has(t.trace_id));
        let li = 0;
        uiMessagesInitial = uiMessagesInitial.map((m) => {
          if (m.role !== 'assistant' || m.trace_id) return m;
          if (li < leftoverTraces.length) {
            return { ...m, trace_id: leftoverTraces[li++].trace_id };
          }
          return m;
        });
        if (messagesLoadGenRef.current !== loadGen) {
          console.info('[useChat] Ignoring stale session load:', {
            sessionId,
            loadGen,
          });
          return;
        }

        // ── C2: Merge cached orchestrator timeline from localStorage ──
        // WHY: Backend does not persist `thinkingSteps`, `executionPlan`, etc.
        // We rehydrate them from a frontend-only cache written at stream end.
        // Server-provided fields ALWAYS take priority — once the backend starts
        // returning them this merge silently becomes a no-op.
        uiMessagesInitial = mergeMessagesWithCache(sessionId, uiMessagesInitial);

        const mergedMessages = mergeSessionMessagesWithOptimistic(
          uiMessagesInitial,
          preservedOptimistic
        );
        setMessages(mergedMessages);
        messagesLoadedForSessionRef.current = sessionId;
        programmaticSessionRef.current = null;
        debugLog.trace('Messages + traces loaded', {
          sessionId,
          count: uiMessagesInitial.length,
          tracesFound: sortedTraces.length,
          assistantWithTrace: uiMessagesInitial.filter((m) => m.role === 'assistant' && m.trace_id).length,
        });

        // ── Background: fetch full trace data and build thinkingSteps for history ──
        // WHY: This reconstructs the Thought Process timeline (plan + tasks + tools)
        // for past messages so users can review past reasoning, not just current.
        // Done in parallel after initial render to avoid blocking the message list.
        const tracesWithIds = uiMessagesInitial
          .filter(
            (m) =>
              m.role === 'assistant' &&
              m.trace_id &&
              (!m.thinkingSteps || m.thinkingSteps.length === 0) &&
              !(m.tool_runs && m.tool_runs.length > 0)
          )
          .slice(-TRACE_ENRICHMENT_CAP);
        debugLog.trace('Trace enrichment queue', {
          sessionId,
          needsEnrichment: tracesWithIds.length,
        });
        if (tracesWithIds.length > 0) {
          void Promise.all(tracesWithIds.map((msg) => enrichMessageTrace(msg.id)));
        } else {
          debugLog.trace('Skip trace enrichment', { sessionId });
        }
      } catch (error: unknown) {
        if (messagesLoadGenRef.current !== loadGen) return;
        console.error('[useChat] Failed to load messages:', {
          sessionId,
          error,
        });
        toast.error(t('chatPage.toasts.loadMessagesFailed'));
      } finally {
        if (messagesLoadGenRef.current === loadGen) {
          setIsLoadingMessages(false);
        }
      }
    },
    [setActiveSessionId, setMessages, setIsLoadingMessages, setCanvasContent, enrichMessageTrace]
  );

  /**
   * Rename a session.
   */
  const renameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      console.info('[useChat] Renaming session:', { sessionId, newTitle });
      try {
        await chatService.updateSession(sessionId, { title: newTitle });
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
        );
        toast.success(t('chatPage.toasts.renameSuccess'));
      } catch (error: unknown) {
        console.error('[useChat] Failed to rename session:', error);
        toast.error(t('chatPage.toasts.renameFailed'));
      }
    },
    [setSessions]
  );

  /**
   * Delete a session.
   */
  const deleteSession = useCallback(
    async (sessionId: string) => {
      console.info('[useChat] Deleting session:', { sessionId });
      try {
        await chatService.deleteSession(sessionId);
        // C3: Drop any cached orchestrator timeline for this session.
        clearSessionTimeline(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
          messagesLoadedForSessionRef.current = null;
        }
        toast.success(t('chatPage.toasts.deleteSuccess'));
      } catch (error: unknown) {
        console.error('[useChat] Failed to delete session:', error);
        toast.error(t('chatPage.toasts.deleteFailed'));
      }
    },
    [activeSessionId, setSessions, setActiveSessionId, setMessages]
  );

  /**
   * Delete several sessions in one round-trip; single toast and one sessions update.
   */
  const deleteSessionsBulk = useCallback(
    async (sessionIds: string[]) => {
      const unique = [...new Set(sessionIds)].filter(Boolean);
      if (unique.length === 0) return;
      try {
        await Promise.all(unique.map((id) => chatService.deleteSession(id)));
        // C3: Drop cached orchestrator timelines for all deleted sessions.
        clearSessionsTimeline(unique);
        setSessions((prev) => prev.filter((s) => !unique.includes(s.id)));
        if (activeSessionId && unique.includes(activeSessionId)) {
          setActiveSessionId(null);
          setMessages([]);
          messagesLoadedForSessionRef.current = null;
        }
        toast.success(
          unique.length === 1
            ? t('chatPage.toasts.deleteSuccess')
            : t('chatPage.toasts.bulkDeleteSuccess', { count: unique.length })
        );
      } catch (error: unknown) {
        console.error('[useChat] Bulk delete failed:', error);
        toast.error(t('chatPage.toasts.bulkDeleteFailed'));
        await loadSessions();
      }
    },
    [activeSessionId, loadSessions, setActiveSessionId, setMessages, setSessions, t]
  );

  /**
   * Archive or unarchive many sessions at once.
   */
  const archiveSessionsBulk = useCallback(
    async (sessionIds: string[], archive: boolean) => {
      const unique = [...new Set(sessionIds)].filter(Boolean);
      if (unique.length === 0) return;
      try {
        await Promise.all(
          unique.map((id) => chatService.updateSession(id, { is_archived: archive }))
        );
        setSessions((prev) =>
          prev.map((s) =>
            unique.includes(s.id) ? { ...s, is_archived: archive } : s
          )
        );
        toast.success(
          archive
            ? unique.length === 1
              ? t('chatPage.toasts.archiveSuccess')
              : t('chatPage.toasts.bulkArchiveSuccess', { count: unique.length })
            : unique.length === 1
              ? t('chatPage.toasts.unarchiveSuccess')
              : t('chatPage.toasts.bulkUnarchiveSuccess', { count: unique.length })
        );
      } catch (error: unknown) {
        console.error('[useChat] Bulk archive failed:', error);
        toast.error(t('chatPage.toasts.archiveFailed'));
        await loadSessions();
      }
    },
    [loadSessions, setSessions, t]
  );

  /**
   * Archive/unarchive a session.
   */
  const toggleArchiveSession = useCallback(
    async (sessionId: string, archive: boolean) => {
      console.info('[useChat] Toggling archive:', { sessionId, archive });
      try {
        await chatService.updateSession(sessionId, { is_archived: archive });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, is_archived: archive } : s
          )
        );
        toast.success(
          archive
            ? t('chatPage.toasts.archiveSuccess')
            : t('chatPage.toasts.unarchiveSuccess')
        );
      } catch (error: unknown) {
        console.error('[useChat] Failed to toggle archive:', error);
        toast.error(t('chatPage.toasts.archiveFailed'));
      }
    },
    [setSessions, t]
  );

  /**
   * Pin/unpin a session.
   */
  const togglePinSession = useCallback(
    async (sessionId: string, pin: boolean) => {
      console.info('[useChat] Toggling pin:', { sessionId, pin });
      try {
        await chatService.updateSession(sessionId, { is_pinned: pin });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, is_pinned: pin } : s
          )
        );
      } catch (error: unknown) {
        console.error('[useChat] Failed to toggle pin:', error);
        toast.error(t('chatPage.toasts.pinFailed'));
      }
    },
    [setSessions]
  );

  // ==========================================
  // Message Actions
  // ==========================================

  /**
   * Send a message with streaming response.
   * Creates a new session if none is active.
   * Uploads files to backend before sending the chat request.
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      if (!content.trim() && !attachments?.length) return;
      if (isStreaming) return;
      if (!selectedModel?.trim()) {
        toast.error(
          t('chatPage.toasts.modelNotConfigured')
        );
        return;
      }

      console.info('[useChat] Sending message:', {
        sessionId: activeSessionId,
        contentLength: content.length,
        attachments: attachments?.length ?? 0,
      });

      let sessionId = activeSessionId;

      // Auto-create session if needed
      if (!sessionId) {
        const session = await createNewSession();
        if (!session) return;
        sessionId = session.id;
      } else {
        programmaticSessionRef.current = sessionId;
      }

      // Upload files to backend if present — with per-file progress tracking
      let uploadedArtifacts: ArtifactInput[] | undefined;
      if (attachments && attachments.length > 0) {
        try {
          // WHY: Compress images client-side before upload to reduce upload time,
          // storage usage, and bandwidth. Phone photos (3-8MB JPEG) are resized to
          // max 2048px and converted to WebP (~100-400KB). Non-images pass through.
          console.info('[useChat] Compressing images before upload...');
          const optimizedAttachments = await compressImages(attachments);

          console.info('[useChat] Uploading files before sending message...');

          // Initialize per-session progress state for all files
          const uploadSessionId = sessionId; // capture for closures
          const initialProgress: FileUploadProgress[] = optimizedAttachments.map((file) => ({
            file,
            status: 'pending',
            progress: 0,
          }));
          setUploadProgressMap((prev) => ({ ...prev, [uploadSessionId]: initialProgress }));
          setIsUploadingMap((prev) => ({ ...prev, [uploadSessionId]: true }));

          // Create abort controller for this upload batch
          const uploadAbortController = new AbortController();
          uploadAbortControllerRef.current = uploadAbortController;

          uploadedArtifacts = await chatService.uploadFilesWithProgress(
            optimizedAttachments,
            sessionId,
            (fileIndex, fileProgress) => {
              // Update progress for the specific file in this session
              setUploadProgressMap((prev) => {
                const current = prev[uploadSessionId] ?? [];
                const updated = [...current];
                updated[fileIndex] = fileProgress;
                return { ...prev, [uploadSessionId]: updated };
              });
            },
            uploadAbortController.signal
          );

          // Attach local blob preview URLs for image files
          // so message-bubble can show thumbnails without needing a backend download endpoint
          uploadedArtifacts = uploadedArtifacts.map((artifact, idx) => {
            const originalFile = optimizedAttachments[idx];
            if (originalFile && originalFile.type.startsWith('image/')) {
              const blobUrl = URL.createObjectURL(originalFile);

              // Also store in the global cache so ArtifactsPanel can use it
              if (artifact.id) {
                setArtifactPreviewCache((prev) => ({
                  ...prev,
                  [artifact.id!]: blobUrl,
                }));
              }

              return {
                ...artifact,
                localPreviewUrl: blobUrl,
              };
            }
            return artifact;
          });

          console.info('[useChat] Files uploaded:', {
            count: uploadedArtifacts.length,
            total: optimizedAttachments.length,
          });
          debugLog.upload('Upload complete — artifacts summary', {
            totalFiles: optimizedAttachments.length,
            successCount: uploadedArtifacts.length,
            artifacts: uploadedArtifacts.map((a) => ({
              id: a.id,
              name: a.name,
              path: a.path,
              mime_type: a.mime_type,
              size: a.size,
              type: a.type,
              hasLocalPreview: !!a.localPreviewUrl,
              hasId: !!a.id,
            })),
          });

          // Show warning if some files failed
          const failedCount = optimizedAttachments.length - uploadedArtifacts.length;
          if (failedCount > 0) {
            toast.error(t('chatPage.toasts.uploadPartialFailed', { count: failedCount }));
          }

          // If ALL files failed, clear artifacts
          if (uploadedArtifacts.length === 0) {
            uploadedArtifacts = undefined;
          }
        } catch (error: unknown) {
          // If the upload was cancelled by user, stop the entire message send
          if (uploadAbortControllerRef.current?.signal.aborted) {
            console.info('[useChat] Upload cancelled by user');
            toast.success(t('chatPage.toasts.uploadCancelled'));
            // Clear upload state immediately
            setIsUploadingMap((prev) => {
              const next = { ...prev };
              delete next[sessionId!];
              return next;
            });
            setUploadProgressMap((prev) => {
              const next = { ...prev };
              delete next[sessionId!];
              return next;
            });
            uploadAbortControllerRef.current = null;
            return; // Exit sendMessage entirely — don't send a message
          }
          console.error('[useChat] File upload failed:', error);
          toast.error(t('chatPage.toasts.uploadFailed'));
          // Continue without attachments — don't block the message
        } finally {
          uploadAbortControllerRef.current = null;
          // Clear per-session upload progress after a short delay so user sees completion
          setTimeout(() => {
            setIsUploadingMap((prev) => {
              const next = { ...prev };
              delete next[sessionId!];
              return next;
            });
            setUploadProgressMap((prev) => {
              const next = { ...prev };
              delete next[sessionId!];
              return next;
            });
          }, 1500);
        }
      }

      // Add user message to UI immediately
      const userMessage: UIMessage = {
        id: `temp-user-${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        isStreaming: false,
        feedback: null,
        // Store uploaded artifacts for display in user message bubble
        artifacts: uploadedArtifacts ?? (attachments?.map((f) => ({
          path: f.name,
          name: f.name,
          mime_type: f.type || undefined,
        })) as ArtifactInput[] | undefined),
      };

      // Add placeholder assistant message
      const assistantMessage: UIMessage = {
        id: `temp-assistant-${Date.now()}`,
        session_id: sessionId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        isStreaming: true,
        streamContent: '',
        streamThinking: '',
        feedback: null,
        thinkingExpanded: true,
        // A7: Pre-fill the model badge with the user-selected model so the
        // assistant header shows which model is replying *during* streaming.
        // `final` event will overwrite this with the backend-reported model.
        model: selectedModel,
        streamStartedAt: new Date().toISOString(),
        answerPhaseStarted: false,
      };

      // Check if user switched sessions during upload — if so, switch back
      // to the original session so messages appear in the correct conversation.
      if (activeSessionIdRef.current !== sessionId) {
        console.warn('[useChat] Session changed during upload, switching back:', {
          target: sessionId,
          current: activeSessionIdRef.current,
        });
        // Re-select the original session so messages display correctly
        setActiveSessionId(sessionId);
        // Load existing messages for this session first, then append new ones
        try {
          const existingMessages = await chatService.listMessages(sessionId);
          const uiExisting: UIMessage[] = existingMessages.map(toUIMessage);
          setMessages([...uiExisting, userMessage, assistantMessage]);
        } catch {
          // Fallback: just add the new messages
          setMessages([userMessage, assistantMessage]);
        }
      } else {
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
      }
      setIsStreaming(true);

      // Create abort controller for this stream
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let accumulatedContent = '';
      let accumulatedThinking = '';
      // Using Record type because TypeScript can't track mutations in closures
      let finalResponse: Record<string, unknown> | null = null;
      // Track timing for thinking duration
      let thinkingStartTime: number | null = null;
      let thinkingDuration: number | null = null;
      const streamStartedAt = new Date().toISOString();

      // ── Step-by-step timeline tracking ──
      // Builds a ThinkingStep[] capturing: thinking → tool → thinking → tool → answer
      let accumulatedSteps: ThinkingStep[] = [];
      let stepCounter = 0;
      let currentPhaseThinking = ''; // thinking text for current phase only

      // ── Orchestrator state tracking ──
      // WHY: Backend sends node/plan/evaluation events from the Planning Agent.
      // We track them to build rich UI state (current node, execution plan, confidence).
      let currentNode: OrchestratorNodeName | undefined;
      let executionPlan: ExecutionPlan | undefined;
      let overallConfidence: number | undefined;
      let replanCount = 0;
      /** Backend `status:answer_start` — final user-facing reply phase */
      let answerPhaseStarted = false;

      try {
        // WHY: Log the full artifacts payload being sent to help debug cases where
        // backend doesn't process uploaded files (especially media files like video/audio).
        if (uploadedArtifacts?.length) {
          console.info('[useChat] Sending artifacts with message:', {
            count: uploadedArtifacts.length,
            artifacts: uploadedArtifacts.map((a) => ({
              id: a.id,
              path: a.path,
              name: a.name,
              mime_type: a.mime_type,
              size: a.size,
              type: a.type,
              hasId: !!a.id,
            })),
          });
        }
        await chatService.sendMessageStream(
          {
            message: content,
            session_id: sessionId,
            model: selectedModel,
            stream: true,
            streaming: true,
            show_thinking: true,
            include_suggestions: true,
            // Include uploaded artifacts so AI can process the files
            artifacts: uploadedArtifacts,
          },
          (event: StreamEvent) => {
            debugLog.stream('Event received in use-chat handler', {
              eventType: event.type,
              dataType: typeof event.data,
              dataLength: typeof event.data === 'string' ? event.data.length : undefined,
            });
            switch (event.type) {
              case 'thinking':
                // Accumulate thinking tokens (data is a string token)
                if (typeof event.data === 'string') {
                  // Track when thinking starts for duration calculation
                  if (!thinkingStartTime) {
                    thinkingStartTime = Date.now();
                    debugLog.thinking('>>> Thinking phase STARTED');
                  }
                  accumulatedThinking += event.data;
                  currentPhaseThinking += event.data;

                  // ── Build timeline step ──
                  // Ensure there's an active thinking step in the timeline.
                  // WHY: We also accept an active *empty* thinking step that was just
                  // created by `status:thinking_start`. Without this, the very first
                  // `thinking` token would create a duplicate step right after the
                  // status-driven placeholder.
                  const lastStep = accumulatedSteps[accumulatedSteps.length - 1];
                  const canReuseLastThinking =
                    lastStep && lastStep.type === 'thinking' && lastStep.isActive;
                  if (!canReuseLastThinking) {
                    // No active thinking step — create one (implicit thinking_start)
                    stepCounter++;
                    accumulatedSteps = [
                      ...accumulatedSteps,
                      {
                        type: 'thinking',
                        content: currentPhaseThinking,
                        isActive: true,
                        stepNumber: stepCounter,
                        timestamp: Date.now(),
                      },
                    ];
                  } else {
                    // Update existing thinking step content
                    accumulatedSteps = accumulatedSteps.map((s, i) =>
                      i === accumulatedSteps.length - 1
                        ? { ...s, content: currentPhaseThinking }
                        : s
                    );
                  }
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, streamThinking: accumulatedThinking, streamSteps: accumulatedSteps }
                      : m
                  )
                );
                break;

              case 'token':
                // Accumulate answer tokens (data is a string token)
                if (typeof event.data === 'string') {
                  // Calculate thinking duration when first answer token arrives
                  if (thinkingStartTime && thinkingDuration === null) {
                    thinkingDuration = (Date.now() - thinkingStartTime) / 1000;
                  }
                  accumulatedContent += event.data;
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          // Raw stream buffer — MessageBubble sanitizes + gates visibility
                          streamContent: accumulatedContent,
                          answerPhaseStarted,
                        }
                      : m
                  )
                );
                break;

              case 'final':
                // WHY: Backend sends final event with complete answer + metadata.
                // This is the primary source for trace_id, tool_runs, model, etc.
                // The 'done' event only carries trace_id + elapsed as a lighter signal.
                if (typeof event.data === 'object') {
                  const finalData = event.data as Record<string, unknown>;
                  // Store as final response for metadata extraction in finalization
                  finalResponse = finalData;
                  const finalContent = (finalData.content ?? finalData.answer ?? '') as string;
                  console.info('[useChat] Final event received:', {
                    hasContent: !!finalContent,
                    traceId: finalData.trace_id,
                    model: finalData.model,
                    toolRunsCount: Array.isArray(finalData.tool_runs) ? (finalData.tool_runs as unknown[]).length : 0,
                  });
                  // WHY: Previous behaviour only used `final.answer` when no tokens
                  // had streamed. But some orchestrators stream partial tokens AND
                  // emit a more complete final answer (post-processing, formatting,
                  // late blocks, etc.). If we ignored `final.answer` whenever any
                  // tokens existed, the tail of the response could be lost — exactly
                  // matching the bug report "some content shows during stream but is
                  // missing from the saved message".
                  // New rule: prefer the longer of the two.
                  if (finalContent) {
                    const trimmedFinal = finalContent.trim();
                    accumulatedContent = resolveFinalAssistantContent(
                      accumulatedContent,
                      trimmedFinal
                    );
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id
                          ? {
                              ...m,
                              streamContent: accumulatedContent,
                              answerPhaseStarted: true,
                            }
                          : m
                      )
                    );
                  }
                }
                break;

              case 'tool_start': {
                // Tool starting — set activeToolName for real-time UI indicator
                const toolStartData = event.data as Record<string, unknown>;
                const startingToolName =
                  (toolStartData.tool_name as string) ||
                  (toolStartData.tool_id as string) ||
                  'tool';
                console.info('[useChat] Tool started:', { tool: startingToolName, args: toolStartData.args });
                debugLog.tool('>>> Tool STARTED', {
                  toolName: startingToolName,
                  toolId: toolStartData.tool_id,
                  args: toolStartData.args,
                  stepNumber: stepCounter + 1,
                  totalStepsSoFar: accumulatedSteps.length,
                });

                // ── Finalize any active thinking step before tool ──
                const lastBeforeTool = accumulatedSteps[accumulatedSteps.length - 1];
                if (lastBeforeTool?.type === 'thinking' && lastBeforeTool.isActive) {
                  accumulatedSteps = accumulatedSteps.map((s, i) =>
                    i === accumulatedSteps.length - 1 ? { ...s, isActive: false } : s
                  );
                }
                // Reset phase thinking for next thinking phase
                currentPhaseThinking = '';

                // ── Add tool step to timeline (as sub-event of active node, or top-level) ──
                // WHY: Tool calls belong to the node that triggered them (Executor, Synthesizer).
                // Add as subEvent to the active node card, keeping the timeline clean.
                const activeNodeIdxForTool = accumulatedSteps.map((s, i) => ({ s, i }))
                  .reverse()
                  .find(({ s }) => s.type === 'node')?.i ?? -1;

                if (activeNodeIdxForTool >= 0) {
                  accumulatedSteps = accumulatedSteps.map((s, i) => {
                    if (i !== activeNodeIdxForTool) return s;
                    const newSubEvent = {
                      type: 'tool_start' as const,
                      label: startingToolName,
                      state: 'running' as const,
                      tool: {
                        tool_id: startingToolName,
                        args: toolStartData.args as Record<string, unknown> | undefined,
                        status: undefined,
                      } as ToolRunInfo,
                      timestamp: Date.now(),
                    };
                    return {
                      ...s,
                      isActive: true,
                      subEvents: [...(s.subEvents ?? []), newSubEvent],
                    };
                  });
                } else {
                  // Fallback: add as standalone tool step (no active node)
                  stepCounter++;
                  accumulatedSteps = [
                    ...accumulatedSteps,
                    {
                      type: 'tool',
                      content: startingToolName,
                      tool: {
                        tool_id: startingToolName,
                        args: toolStartData.args as Record<string, unknown> | undefined,
                        status: undefined,
                      },
                      isActive: true,
                      stepNumber: stepCounter,
                      timestamp: Date.now(),
                    },
                  ];
                }

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, activeToolName: startingToolName, streamSteps: accumulatedSteps }
                      : m
                  )
                );
                break;
              }

              case 'tool_result': {
                // Tool completed — clear activeToolName, accumulate into streamToolRuns
                // WHY: Backend now sends 'tool_result' (not 'tool_end').
                // SSE parser maps legacy 'tool_end' → 'tool_result' for compat.
                const toolEndData = event.data as Record<string, unknown>;
                const endedToolId =
                  (toolEndData.tool_name as string) ||
                  (toolEndData.tool_id as string) ||
                  'tool';
                const ok = toolEndData.ok !== false; // default true if not present
                console.info('[useChat] Tool completed:', { tool: endedToolId, ok });
                debugLog.tool('<<< Tool COMPLETED', {
                  toolName: endedToolId,
                  ok,
                  hasResult: !!(toolEndData.result ?? toolEndData.output),
                  hasError: !ok && !!toolEndData.error,
                  error: toolEndData.error,
                  resultPreview: toolEndData.result
                    ? JSON.stringify(toolEndData.result).slice(0, 200)
                    : undefined,
                });
                const toolRun: ToolRunInfo = {
                  tool_id: endedToolId,
                  args: (toolEndData.args ?? toolEndData.input) as Record<string, unknown> | undefined,
                  result: (toolEndData.result ?? toolEndData.output) as Record<string, unknown> | undefined,
                  status: ok ? 'success' : 'error',
                  error: (!ok && typeof toolEndData.error === 'string') ? toolEndData.error : null,
                };

                // ── Update tool sub-event in active node (or standalone tool step) ──
                // WHY: Mark the running tool_start sub-event as completed with the result.
                // Match by tool_id first; fallback to last running tool_start if no match.
                let toolResolved = false;
                accumulatedSteps = accumulatedSteps.map((s) => {
                  if (s.type === 'node' && s.subEvents?.length) {
                    // First pass: try to match by tool_id
                    let matchIdx = s.subEvents.findIndex(
                      (sub) =>
                        sub.type === 'tool_start' &&
                        sub.state === 'running' &&
                        sub.tool?.tool_id === endedToolId
                    );
                    // Fallback: last running tool_start regardless of id
                    if (matchIdx === -1) {
                      matchIdx = s.subEvents.map((sub, si) => ({ sub, si }))
                        .reverse()
                        .find(({ sub }) => sub.type === 'tool_start' && sub.state === 'running')
                        ?.si ?? -1;
                    }
                    if (matchIdx >= 0) {
                      toolResolved = true;
                      const updatedSubs = s.subEvents.map((sub, si) =>
                        si === matchIdx
                          ? {
                              ...sub,
                              type: 'tool_end' as const,
                              state: (ok ? 'completed' : 'failed') as 'completed' | 'failed',
                              tool: toolRun,
                            }
                          : sub
                      );
                      return { ...s, subEvents: updatedSubs };
                    }
                    return s;
                  }
                  // Legacy: update standalone tool step
                  if (s.type === 'tool' && s.isActive && s.content === endedToolId) {
                    toolResolved = true;
                    return { ...s, isActive: false, tool: toolRun };
                  }
                  return s;
                });
                // Final fallback: mark last active tool step
                if (!toolResolved) {
                  const hasActiveToolStep = accumulatedSteps.some(
                    (s) => s.type === 'tool' && s.isActive
                  );
                  if (hasActiveToolStep) {
                    accumulatedSteps = accumulatedSteps.map((s) =>
                      s.type === 'tool' && s.isActive
                        ? { ...s, isActive: false, tool: toolRun }
                        : s
                    );
                  }
                }

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          activeToolName: null,
                          streamToolRuns: [...(m.streamToolRuns ?? []), toolRun],
                          streamSteps: accumulatedSteps,
                        }
                      : m
                  )
                );
                break;
              }

              case 'suggestion':
                // WHY: Backend variants may send the suggestion text under `text`,
                // `content`, `value`, or `message`. Previously only `text` worked,
                // silently dropping suggestions emitted with any other key.
                if (typeof event.data === 'object' && event.data !== null) {
                  const sd = event.data as Record<string, unknown>;
                  const text =
                    (typeof sd.text === 'string' && sd.text) ||
                    (typeof sd.content === 'string' && sd.content) ||
                    (typeof sd.value === 'string' && sd.value) ||
                    (typeof sd.message === 'string' && sd.message) ||
                    '';
                  if (text) {
                    const normalized: SuggestionItem = {
                      ...(sd as Partial<SuggestionItem>),
                      text,
                    } as SuggestionItem;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id
                          ? {
                              ...m,
                              suggestions: [...(m.suggestions ?? []), normalized],
                            }
                          : m
                      )
                    );
                  }
                }
                break;

              // ── New orchestrator events from Planning Agent ──

              case 'node': {
                // WHY: Backend sends node events when the orchestrator graph
                // transitions between stages (planner → executor → critic → ...).
                const nodeData = event.data as Record<string, unknown>;
                // WHY: Use || instead of ?? to handle empty strings
                const nodeName = ((nodeData.node as string) || (nodeData.name as string) || 'processing') as OrchestratorNodeName;
                currentNode = nodeName;
                console.info('[useChat] Orchestrator node transition:', { 
                  node: nodeName, 
                  rawData: nodeData,
                });

                // Format node name for display
                const formatNodeName = (name: string): string => {
                  return name
                    .replace(/_/g, ' ')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                };

                // Add node step to timeline
                stepCounter++;
                accumulatedSteps = [
                  ...accumulatedSteps,
                  {
                    type: 'node' as ThinkingStep['type'],
                    content: formatNodeName(nodeName),
                    nodeName,
                    isActive: true,
                    stepNumber: stepCounter,
                    timestamp: Date.now(),
                  },
                ];

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, currentNode: nodeName, streamSteps: accumulatedSteps }
                      : m
                  )
                );
                break;
              }

              case 'plan': {
                // WHY: Backend sends plan events from the planner node with
                // task breakdown, total steps, and overall strategy.
                // Structure: { type: "plan", plan: { tasks: [], complexity: "..." } }
                const planData = event.data as Record<string, unknown>;
                // Extract the nested plan object — backend wraps it under "plan" key
                const nestedPlan = (planData.plan as Record<string, unknown>) ?? planData;
                executionPlan = nestedPlan as unknown as ExecutionPlan;
                const taskCount = (nestedPlan.tasks as unknown[])?.length ?? 0;
                const complexity = (nestedPlan.complexity as string) || '';
                console.info('[useChat] Execution plan received:', {
                  taskCount,
                  complexity,
                  totalSteps: nestedPlan.total_steps,
                  rawData: planData,
                });

                // Build meaningful plan content
                const planContent = taskCount > 0
                  ? `Execution Plan: ${taskCount} task${taskCount !== 1 ? 's' : ''}${complexity ? ` (${complexity})` : ''}`
                  : complexity 
                    ? `Execution Plan (${complexity})`
                    : 'Execution Plan Created';

                // ── Plan-Centric: Build initial task list with all tasks pending ──
                // WHY: This plan step becomes the SINGLE source of truth for task
                // progress. All subsequent progress events update tasks IN PLACE
                // here, so we never see duplicate rows or wrong percentages.
                const planTasks = ((nestedPlan.tasks as Array<Record<string, unknown>>) ?? [])
                  .map((task, idx) => ({
                    taskId:
                      (task.id as string) ||
                      (task.task_id as string) ||
                      (task.name as string) ||
                      `task-${idx + 1}`,
                    description: (task.description as string) || (task.name as string) || '',
                    state: 'pending' as const,
                  }))
                  .filter((t) => t.description.length > 0);

                // Add plan step to timeline
                stepCounter++;
                accumulatedSteps = [
                  ...accumulatedSteps,
                  {
                    type: 'plan' as ThinkingStep['type'],
                    content: planContent,
                    plan: executionPlan,
                    tasks: planTasks,
                    totalTaskCount: planTasks.length || taskCount,
                    isActive: planTasks.length > 0,
                    stepNumber: stepCounter,
                    timestamp: Date.now(),
                  },
                ];

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, executionPlan, streamSteps: accumulatedSteps }
                      : m
                  )
                );
                break;
              }

              case 'progress': {
                // WHY: Backend reports task progress updates during execution.
                // Used to update progress bars and task status indicators in the UI.
                const progressData = event.data as Record<string, unknown>;
                
                // Extract the full message from backend (may include emojis)
                const fullMessage = (progressData.status as string) || 
                                    (progressData.message as string) || 
                                    (progressData.step as string) || 
                                    '';
                
                // Parse progress state from message or explicit field
                let progressState: 'pending' | 'running' | 'completed' | 'failed' = 'running';
                if (fullMessage.includes('✅') || fullMessage.includes('completed')) {
                  progressState = 'completed';
                } else if (fullMessage.includes('❌') || fullMessage.includes('failed')) {
                  progressState = 'failed';
                } else if (fullMessage.includes('🤔') || fullMessage.includes('در حال')) {
                  progressState = 'running';
                }
                
                // WHY: Create a clean label for the timeline title (without emojis)
                // The full message goes in progressData for the expandable section
                const cleanLabel = fullMessage
                  .replace(/[✅❌🤔⚙️🔄]/g, '')  // Remove emojis
                  .replace(/^Progress:\s*/i, '')  // Remove "Progress:" prefix
                  .trim();
                
                // Generate a short title based on state
                const shortTitle = progressState === 'completed' 
                  ? 'مرحله تکمیل شد'
                  : progressState === 'failed'
                    ? 'خطا در اجرا'
                    : progressState === 'running'
                      ? 'در حال پردازش...'
                      : 'در انتظار';
                
                console.info('[useChat] Task progress:', {
                  task: progressData.task_id ?? progressData.step,
                  state: progressState,
                  cleanLabel,
                  fullMessage,
                  progress: progressData.progress,
                });

                // ── Plan-Centric Approach ──
                // WHY: All progress events update tasks on the LATEST plan step,
                // not the active node. This avoids duplicate Executor cards and
                // wrong percentages (>100%). Node steps remain compact rows only.

                // Helper: normalize task description for matching
                const normalizeDesc = (s: string) => s
                  .toLowerCase()
                  .replace(/^executing:\s*/i, '')
                  .replace(/^processing:\s*/i, '')
                  .replace(/[.…\s]+$/g, '')
                  .trim();

                const taskDesc = cleanLabel
                  .replace(/^Executing:\s*/i, '')
                  .replace(/^Processing:\s*/i, '')
                  .trim();
                const taskDescNorm = normalizeDesc(taskDesc);
                const progressTaskId = (
                  progressData.task_id ??
                  progressData.taskId ??
                  progressData.step
                ) as string | undefined;

                // Helper: is this a generic message that shouldn't create a row?
                const genericPatterns = /^(completed|done|finished|✅|تکمیل شد|مرحله تکمیل شد|analyzing and planning|execution plan ready|synthesizing results)/i;
                const isGenericMsg = genericPatterns.test((taskDesc || fullMessage).trim());

                // Find latest plan step
                const latestPlanIdx = accumulatedSteps.map((s, i) => ({ s, i }))
                  .reverse()
                  .find(({ s }) => s.type === 'plan')?.i ?? -1;

                // Find active node step (for fallback)
                const activeNodeIdx = accumulatedSteps.map((s, i) => ({ s, i }))
                  .reverse()
                  .find(({ s }) => s.type === 'node')?.i ?? -1;

                // ── Try to match this progress event to a task in the latest plan ──
                let didApplyToPlan = false;
                if (latestPlanIdx >= 0 && taskDescNorm.length > 5 && !isGenericMsg) {
                  const planStep = accumulatedSteps[latestPlanIdx];
                  const planTasks = planStep.tasks ?? [];

                  const matchIdx = findPlanTaskMatchIndex(
                    planTasks,
                    progressTaskId ? String(progressTaskId) : undefined,
                    taskDescNorm
                  );

                  if (matchIdx >= 0) {
                    didApplyToPlan = true;
                    accumulatedSteps = accumulatedSteps.map((s, i) => {
                      if (i !== latestPlanIdx) return s;
                      return {
                        ...s,
                        isActive: progressState === 'running',
                        tasks: (s.tasks ?? []).map((t, ti) =>
                          ti === matchIdx ? { ...t, state: progressState } : t
                        ),
                      };
                    });
                  }
                }

                // ── Fallback: completed/failed without plan match → update last running task ──
                if (!didApplyToPlan && (progressState === 'completed' || progressState === 'failed')) {
                  if (latestPlanIdx >= 0) {
                    accumulatedSteps = accumulatedSteps.map((s, i) => {
                      if (i !== latestPlanIdx) return s;
                      const tasks = s.tasks ?? [];
                      const lastRunningIdx = tasks.map((t, ti) => ({ t, ti }))
                        .reverse()
                        .find(({ t }) => t.state === 'running')?.ti ?? -1;
                      if (lastRunningIdx >= 0) {
                        didApplyToPlan = true;
                        return {
                          ...s,
                          isActive: false,
                          tasks: tasks.map((t, ti) =>
                            ti === lastRunningIdx ? { ...t, state: progressState } : t
                          ),
                        };
                      }
                      return s;
                    });
                  }
                }

                // ── Mark active node as completed when its work is done ──
                // WHY: This stops the "Analyzing and planning..." row from
                // staying blue forever. When generic completed signals arrive,
                // the latest active node transitions to completed state.
                if (!didApplyToPlan && progressState === 'completed' && activeNodeIdx >= 0) {
                  accumulatedSteps = accumulatedSteps.map((s, i) =>
                    i === activeNodeIdx ? { ...s, isActive: false } : s
                  );
                }

                // ── Only add new progress step if we couldn't apply to plan AND it's not generic ──
                // WHY: This prevents duplicate rows. If we successfully updated a plan task,
                // we DON'T add a new step. Only add a new step for meaningful progress that
                // doesn't match any existing plan task (edge cases only).
                if (!didApplyToPlan && !isGenericMsg && taskDesc.length > 5) {
                  stepCounter++;
                  accumulatedSteps = [
                    ...accumulatedSteps,
                    {
                      type: 'progress' as ThinkingStep['type'],
                      content: shortTitle,
                      progressData: {
                        message: cleanLabel || fullMessage,
                        progress: progressData.progress as number | undefined,
                        taskId: (progressData.task_id ?? progressData.step) as string | undefined,
                        state: progressState,
                      },
                      isActive: progressState === 'running',
                      stepNumber: stepCounter,
                      timestamp: Date.now(),
                    },
                  ];
                }

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, streamSteps: accumulatedSteps }
                      : m
                  )
                );
                break;
              }

              case 'tool_progress': {
                // WHY: Backend sends incremental tool progress (e.g. download %,
                // code execution output lines). Tools are stored as `subEvents`
                // under the active node when one exists; only as standalone `tool`
                // steps when no node was emitted. The previous matcher only looked
                // at standalone steps and silently did nothing for the common
                // node-with-subEvents case. Now we update both.
                const toolProgressData = event.data as Record<string, unknown>;
                const progressToolName =
                  (toolProgressData.tool_name as string) ||
                  (toolProgressData.tool_id as string) ||
                  '';
                const progressValueRaw = toolProgressData.progress as number | undefined;
                const progressValue =
                  typeof progressValueRaw === 'number' && isFinite(progressValueRaw)
                    ? Math.max(0, Math.min(1, progressValueRaw))
                    : undefined;
                const progressMsg =
                  (toolProgressData.message as string | undefined) ?? undefined;
                debugLog.tool('Tool progress:', {
                  tool: progressToolName,
                  progress: progressValue,
                  message: progressMsg,
                });

                const matchSubEvent = (
                  sub: NonNullable<ThinkingStep['subEvents']>[number]
                ): boolean =>
                  sub.type === 'tool_start' &&
                  sub.state === 'running' &&
                  (!progressToolName ||
                    sub.tool?.tool_id === progressToolName ||
                    sub.label === progressToolName);

                // Update standalone tool step OR subEvent in active node.
                accumulatedSteps = accumulatedSteps.map((s) => {
                  // Standalone tool step (legacy path)
                  if (
                    s.type === 'tool' &&
                    s.isActive &&
                    (s.tool?.tool_id === progressToolName || s.content === progressToolName || !progressToolName)
                  ) {
                    return {
                      ...s,
                      content: progressMsg
                        ? `${progressToolName}: ${progressMsg}`
                        : progressValue != null
                          ? `${progressToolName}: ${Math.round(progressValue * 100)}%`
                          : s.content,
                      tool: s.tool
                        ? {
                            ...s.tool,
                            progress: progressValue ?? s.tool.progress ?? null,
                            progressMessage: progressMsg ?? s.tool.progressMessage ?? null,
                          }
                        : s.tool,
                    };
                  }
                  // Node with running tool subEvents
                  if (s.type === 'node' && s.subEvents?.length) {
                    let touched = false;
                    const updatedSubs = s.subEvents.map((sub) => {
                      if (!matchSubEvent(sub)) return sub;
                      touched = true;
                      return {
                        ...sub,
                        progress: progressValue ?? sub.progress,
                        message: progressMsg ?? sub.message,
                        tool: sub.tool
                          ? {
                              ...sub.tool,
                              progress: progressValue ?? sub.tool.progress ?? null,
                              progressMessage: progressMsg ?? sub.tool.progressMessage ?? null,
                            }
                          : sub.tool,
                      };
                    });
                    return touched ? { ...s, subEvents: updatedSubs } : s;
                  }
                  return s;
                });

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, streamSteps: accumulatedSteps }
                      : m
                  )
                );
                break;
              }

              case 'evaluation': {
                // WHY: Backend sends evaluation events from the critic node
                // containing quality assessment and confidence score.
                // API field is `overall_confidence` (0-1), not `confidence`.
                // `needs_replan` indicates the critic rejected results (not `approved`).
                const evalData = event.data as Record<string, unknown>;
                const confidence = (evalData.overall_confidence ?? evalData.confidence) as number | undefined;
                const needsReplan = (evalData.needs_replan ?? (evalData.approved === false)) as boolean | undefined;
                overallConfidence = confidence;
                if (needsReplan === true) replanCount++;
                console.info('[useChat] Critic evaluation:', {
                  overall_confidence: confidence,
                  needs_replan: needsReplan,
                  replanCount,
                  rawData: evalData,
                });

                // Build meaningful evaluation content
                const evalContent = needsReplan 
                  ? `Needs Revision (confidence: ${confidence != null ? (confidence * 100).toFixed(0) + '%' : 'N/A'})`
                  : confidence != null 
                    ? `Approved (confidence: ${(confidence * 100).toFixed(0)}%)`
                    : 'Evaluation Complete';

                // Add evaluation step to timeline
                stepCounter++;
                accumulatedSteps = [
                  ...accumulatedSteps,
                  {
                    type: 'evaluation' as ThinkingStep['type'],
                    content: evalContent,
                    confidence,
                    evaluation: evalData as unknown as CriticEvaluation,
                    isActive: false,
                    stepNumber: stepCounter,
                    timestamp: Date.now(),
                  },
                ];

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          overallConfidence: confidence,
                          replanCount,
                          streamSteps: accumulatedSteps,
                        }
                      : m
                  )
                );
                break;
              }

              case 'warning': {
                // WHY: Backend may send non-fatal warnings during processing.
                // Surface them on the assistant message so MessageBubble can show
                // an inline banner — the user previously had no way to know a
                // warning occurred (console only).
                const warningData = event.data as Record<string, unknown>;
                console.warn('[useChat] Stream warning:', warningData);
                const wMsg =
                  (typeof warningData.message === 'string' && warningData.message) ||
                  (typeof warningData.text === 'string' && warningData.text) ||
                  (typeof warningData.content === 'string' && warningData.content) ||
                  '';
                if (wMsg) {
                  const rawLevel = (warningData.level ?? warningData.severity) as string | undefined;
                  const level: WarningItem['level'] =
                    rawLevel === 'info' || rawLevel === 'warning' || rawLevel === 'error'
                      ? rawLevel
                      : 'warning';
                  const warningItem: WarningItem = {
                    message: wMsg,
                    level,
                    code: (warningData.code as string | undefined) ?? null,
                  };
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, warnings: [...(m.warnings ?? []), warningItem] }
                        : m
                    )
                  );
                }
                break;
              }

              case 'done':
                // WHY: Backend 'done' event is a lightweight stream-end signal.
                // It only carries trace_id + elapsed. Full metadata comes from 'final'.
                // If 'final' event was missed (error case), fall back to done data.
                console.info('[useChat] Stream done event received');
                if (typeof event.data === 'object') {
                  const doneData = event.data as Record<string, unknown>;
                  debugLog.stream('>>> DONE event processed', {
                    traceId: doneData.trace_id,
                    elapsed: doneData.elapsed,
                    accumulatedContentLength: accumulatedContent.length,
                    accumulatedStepsCount: accumulatedSteps.length,
                    hasFinalResponse: !!finalResponse,
                  });
                  // Use done data as fallback only if 'final' event was never received
                  if (!finalResponse) {
                    finalResponse = doneData;
                    console.warn('[useChat] No final event received — using done event as fallback');
                  } else {
                    // Merge trace_id from done if not in final (safety net)
                    if (!finalResponse.trace_id && doneData.trace_id) {
                      finalResponse.trace_id = doneData.trace_id;
                    }
                  }
                }
                break;

              case 'error': {
                // WHY: Backend can emit a mid-stream `error` event without
                // throwing. The exception-based path (try/catch below) does NOT
                // run in that case, so without this handler the user sees a
                // truncated answer and no explanation. Surface it on the message
                // so MessageBubble shows the error banner + Retry button.
                console.error('[useChat] Stream error event:', event.data);
                const errData = event.data as Record<string, unknown> | string;
                const errMsg =
                  typeof errData === 'string'
                    ? errData
                    : (typeof errData?.message === 'string' && errData.message) ||
                      (typeof errData?.error === 'string' && errData.error) ||
                      'Stream error';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? { ...m, error: errMsg } : m
                  )
                );
                break;
              }

              case 'status': {
                // ── Process lifecycle events for reasoning timeline ──
                const statusData = event.data as Record<string, unknown>;
                const statusType = statusData.type as string | undefined;
                debugLog.stream('Status event', {
                  statusType,
                  data: statusData,
                });

                if (statusType === 'thinking_start') {
                  // Start a new thinking phase — reset phase accumulator
                  currentPhaseThinking = '';
                  stepCounter++;
                  accumulatedSteps = [
                    ...accumulatedSteps,
                    {
                      type: 'thinking',
                      content: '',
                      isActive: true,
                      stepNumber: stepCounter,
                      timestamp: Date.now(),
                    },
                  ];
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, streamSteps: accumulatedSteps }
                        : m
                    )
                  );
                } else if (statusType === 'thinking_end') {
                  // Finalize current thinking step
                  accumulatedSteps = accumulatedSteps.map((s, i) =>
                    i === accumulatedSteps.length - 1 && s.type === 'thinking' && s.isActive
                      ? { ...s, isActive: false, content: currentPhaseThinking }
                      : s
                  );
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, streamSteps: accumulatedSteps }
                        : m
                    )
                  );
                } else if (statusType === 'answer_start') {
                  answerPhaseStarted = true;
                  // Finalize any remaining active thinking step
                  accumulatedSteps = accumulatedSteps.map((s) =>
                    s.isActive && s.type === 'thinking'
                      ? { ...s, isActive: false, content: currentPhaseThinking }
                      : s
                  );
                  // Add answer generation step
                  stepCounter++;
                  accumulatedSteps = [
                    ...accumulatedSteps,
                    {
                      type: 'answer',
                      content: 'Generating answer...',
                      isActive: true,
                      stepNumber: stepCounter,
                      timestamp: Date.now(),
                    },
                  ];
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                            ...m,
                            streamSteps: accumulatedSteps,
                            answerPhaseStarted: true,
                          }
                        : m
                    )
                  );
                }
                // Other lifecycle events (init_complete, state_update, etc.) — skip
                break;
              }

              default:
                break;
            }
          },
          abortController.signal
        );

        // Finalize the assistant message with accumulated content and metadata
        // WHY: finalResponse comes from the 'final' event (primary) or 'done' event (fallback).
        // The 'final' event carries: answer, trace_id, tool_runs, model, tools_used, etc.
        // The 'done' event only carries: trace_id, elapsed.
        const fr = finalResponse as Record<string, unknown> | null;

        // ── Pre-normalize tool_runs from final event ──
        // WHY: The final event may include tool_runs in a format that differs
        // from ToolRunInfo. Uses centralized normalizer for consistent display.
        const finalToolRunsRaw = fr?.tool_runs as Array<Record<string, unknown>> | undefined;
        const normalizedFinalToolRuns: ToolRunInfo[] | undefined =
          finalToolRunsRaw && finalToolRunsRaw.length > 0
            ? normalizeDoneEventToolRuns(finalToolRunsRaw)
            : undefined;

        debugLog.stream('=== FINALIZING MESSAGE ===', {
          hasContent: !!accumulatedContent,
          contentLength: accumulatedContent.length,
          hasThinking: !!accumulatedThinking,
          thinkingLength: accumulatedThinking.length,
          thinkingDuration,
          totalSteps: accumulatedSteps.length,
          stepsBreakdown: accumulatedSteps.map((s) => ({
            type: s.type,
            isActive: s.isActive,
            stepNumber: s.stepNumber,
            contentPreview: typeof s.content === 'string' ? s.content.slice(0, 50) : s.content,
          })),
          traceId: fr?.trace_id,
          model: fr?.model,
          currentNode,
          overallConfidence,
          replanCount,
          toolRunsFromFinal: Array.isArray(fr?.tool_runs) ? (fr?.tool_runs as unknown[]).length : 0,
          toolsUsedFromFinal: fr?.tools_used,
          normalizedFinalToolRunsCount: normalizedFinalToolRuns?.length ?? 0,
        });

        const responseArtifacts = normalizeArtifactsFromPayload(
          fr?.artifacts ?? fr?.attachments
        );

        const finalSuggestionsRaw = fr?.suggestions;
        const parsedFinalSuggestions: SuggestionItem[] | undefined =
          Array.isArray(finalSuggestionsRaw) && finalSuggestionsRaw.length > 0
            ? finalSuggestionsRaw
                .map((item) => {
                  if (typeof item === 'string') return { text: item } as SuggestionItem;
                  if (item && typeof item === 'object') {
                    const o = item as Record<string, unknown>;
                    const text =
                      (typeof o.text === 'string' && o.text) ||
                      (typeof o.content === 'string' && o.content) ||
                      (typeof o.value === 'string' && o.value) ||
                      '';
                    return text ? ({ ...o, text } as SuggestionItem) : null;
                  }
                  return null;
                })
                .filter((s): s is SuggestionItem => s !== null)
            : undefined;

        const finalWarningsRaw = fr?.warnings;
        const parsedFinalWarnings: WarningItem[] | undefined =
          Array.isArray(finalWarningsRaw) && finalWarningsRaw.length > 0
            ? (finalWarningsRaw as WarningItem[])
            : undefined;

        const finalizedSteps = finalizeSteps(accumulatedSteps);
        const resolvedTraceId = (fr?.trace_id as string) ?? undefined;
        const finalAnswerRaw = (fr?.content ?? fr?.answer ?? '') as string;
        const resolvedContent = resolveFinalAssistantContent(
          accumulatedContent,
          typeof finalAnswerRaw === 'string' ? finalAnswerRaw : ''
        );
        let cacheWarnings: WarningItem[] | undefined;
        let cacheSuggestions: SuggestionItem[] | undefined;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMessage.id) return m;

            cacheWarnings = [
              ...(m.warnings ?? []),
              ...(parsedFinalWarnings ?? []),
            ].filter(
              (w, i, arr) =>
                arr.findIndex((x) => x.message === w.message && x.level === w.level) === i
            );
            cacheSuggestions = [
              ...(m.suggestions ?? []),
              ...(parsedFinalSuggestions ?? []),
            ].filter(
              (s, i, arr) => arr.findIndex((x) => x.text === s.text) === i
            );

            // ── Determine final tool_runs by merging stream + final event data ──
            // WHY: streamToolRuns captures real-time tool_result results (rich data),
            // while final event tool_runs may only have summaries. Prefer richer source.
            let mergedToolRuns: ToolRunInfo[] | undefined = m.streamToolRuns ?? m.tool_runs;
            if (normalizedFinalToolRuns && normalizedFinalToolRuns.length > 0) {
              const streamHasResults = m.streamToolRuns?.some((t) => t.result != null);
              const finalHasResults = normalizedFinalToolRuns.some((t) => t.result != null);
              if (streamHasResults && !finalHasResults) {
                console.info('[useChat] Keeping streamToolRuns (richer data) over final event tool_runs');
                mergedToolRuns = m.streamToolRuns;
              } else {
                mergedToolRuns = normalizedFinalToolRuns;
              }
            }

            return {
              ...m,
              content: resolvedContent || resolveFinalAssistantContent(m.streamContent ?? '', null),
              thinking: accumulatedThinking || m.streamThinking || null,
              isStreaming: false,
              answerPhaseStarted: true,
              streamContent: undefined,
              streamThinking: undefined,
              artifacts: responseArtifacts ?? m.artifacts,
              // Use properly merged tool_runs (stream vs final event)
              tool_runs: mergedToolRuns,
              // tools_used — lightweight name list for display badges
              tools_used: (fr?.tools_used as string[])
                ?? (m.streamToolRuns ?? m.tool_runs ?? []).map((t) => t.tool_id),
              // Clear streaming-only fields
              streamToolRuns: undefined,
              activeToolName: null,
              session_id: (fr?.session_id as string) ?? sessionId,
              trace_id: (fr?.trace_id as string) ?? undefined,
              model: (fr?.model as string) ?? selectedModel,
              steps: fr?.steps as number | undefined,
              total_tokens: fr?.total_tokens as number | undefined,
              processing_time: fr?.processing_time as number | undefined,
              thinkingDuration: thinkingDuration ?? undefined,
              streamStartedAt: streamStartedAt,
              // ── Orchestrator state ──
              currentNode,
              executionPlan,
              overallConfidence,
              replanCount: replanCount > 0 ? replanCount : undefined,
              // ── Finalize reasoning timeline ──
              thinkingSteps: finalizedSteps,
              streamSteps: undefined,
              warnings: cacheWarnings?.length ? cacheWarnings : undefined,
              suggestions: cacheSuggestions?.length ? cacheSuggestions : undefined,
            };
          })
        );

        // ── C1: Mirror full orchestrator timeline to localStorage + backend ──
        void persistAssistantTimeline(
          (fr?.session_id as string) || sessionId,
          assistantMessage.id,
          resolvedTraceId,
          {
            thinkingSteps: finalizedSteps,
            executionPlan: executionPlan ?? undefined,
            currentNode: currentNode ?? undefined,
            overallConfidence: overallConfidence ?? undefined,
            replanCount: replanCount > 0 ? replanCount : undefined,
            thinkingDuration: thinkingDuration ?? undefined,
            streamStartedAt,
            traceId: resolvedTraceId,
            warnings: cacheWarnings,
            suggestions: cacheSuggestions,
          },
          (realId) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessage.id ? { ...m, id: realId } : m))
            );
          }
        ).catch((cacheErr) => {
          console.warn('[useChat] Failed to cache timeline (non-fatal):', cacheErr);
        });

        // Update session title if this was the first message
        // (backend auto-generates title from first message)
        const frSessionId = (fr?.session_id as string) || sessionId;
        if (frSessionId) {
          try {
            const updatedSession = await chatService.getSession(frSessionId);
            setSessions((prev) =>
              prev.map((s) =>
                s.id === updatedSession.id ? updatedSession : s
              )
            );
          } catch {
            // Non-critical — session title will update on next refresh
          }
        }
      } catch (error: unknown) {
        if (abortController.signal.aborted) {
          // User cancelled — finalize with accumulated content and steps
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? {
                    ...m,
                    content: accumulatedContent || 'Response stopped.',
                    thinking: accumulatedThinking || null,
                    isStreaming: false,
                    streamContent: undefined,
                    streamThinking: undefined,
                    thinkingSteps: finalizeSteps(accumulatedSteps),
                    streamSteps: undefined,
                    error: 'Stopped by user',
                  }
                : m
            )
          );
        } else {
          console.error('[useChat] Send message failed:', error);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? {
                    ...m,
                    content: '',
                    isStreaming: false,
                    streamContent: undefined,
                    streamThinking: undefined,
                    thinkingSteps: finalizeSteps(accumulatedSteps),
                    streamSteps: undefined,
                    error: 'Failed to get response. Please try again.',
                  }
                : m
            )
          );
          toast.error(t('chatPage.toasts.sendFailed'));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        messagesLoadedForSessionRef.current = sessionId;
        if (programmaticSessionRef.current === sessionId) {
          programmaticSessionRef.current = null;
        }
      }
    },
    [isStreaming, selectedModel, activeSessionId, setIsStreaming, createNewSession, setUploadProgressMap, setIsUploadingMap, setArtifactPreviewCache, setActiveSessionId, setMessages, setSessions]
  );

  /**
   * Stop the current streaming response.
   */
  const stopStreaming = useCallback(() => {
    console.info('[useChat] Stopping stream...');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Cancel active file upload.
   * Aborts the current upload batch and clears upload state.
   */
  const cancelUpload = useCallback(() => {
    console.info('[useChat] Cancelling upload...');
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
  }, []);

  /**
   * Resend the last user message (retry).
   * Removes both the last user message and assistant response, then resends.
   * Uses a ref to capture content before state update to avoid race conditions.
   */
  const resendLastMessage = useCallback(async () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    console.info('[useChat] Resending last message');

    // Capture content before modifying state to avoid race condition
    const contentToResend = lastUserMessage.content;

    // Remove the last user + assistant pair to avoid duplication
    setMessages((prev) => {
      // Find indices of last user and assistant messages
      let lastUserIdx = -1;
      let lastAssistantIdx = -1;
      
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'assistant' && lastAssistantIdx === -1) {
          lastAssistantIdx = i;
        }
        if (prev[i].role === 'user' && lastUserIdx === -1) {
          lastUserIdx = i;
          break; // Found both, stop searching
        }
      }

      // Remove both messages if found
      if (lastUserIdx >= 0 && lastAssistantIdx >= 0) {
        return prev.filter((_, idx) => idx !== lastUserIdx && idx !== lastAssistantIdx);
      } else if (lastAssistantIdx >= 0) {
        // Only remove assistant if user message not found
        return prev.filter((_, idx) => idx !== lastAssistantIdx);
      }
      
      return prev;
    });

    // Use requestAnimationFrame to ensure state update is committed before re-sending
    requestAnimationFrame(() => {
      sendMessage(contentToResend);
    });
  }, [messages, setMessages, sendMessage]);

  /**
   * Set feedback on a message.
   * Updates local state and persists to backend via POST /feedback.
   * Maps like → rating 5, dislike → rating 1.
   *
   * @param messageId - The message ID to set feedback on
   * @param feedback - 'like', 'dislike', or null to remove
   */
  const setMessageFeedback = useCallback(
    (messageId: string, feedback: MessageFeedback) => {
      console.info('[useChat] Setting feedback:', { messageId, feedback });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );

      if (feedback && activeSessionId) {
        const rating = feedback === 'like' ? 5 : 1;
        const msg = messages.find((m) => m.id === messageId);
        void chatService
          .submitFeedback({
            session_id: activeSessionId,
            message_id: messageId,
            rating,
            message_text: msg?.content?.substring(0, 200),
          })
          .then((ok) => {
            if (!ok) {
              toast.error(t('chatPage.feedback.notPersisted'));
            }
          });
      }
    },
    [setMessages, activeSessionId, messages, t]
  );

  /**
   * Edit a previously sent user message and re-send it.
   * Removes all messages after the edited message, then re-sends with new content.
   * This is a frontend-only operation — the backend will process the new message
   * as if it were sent fresh.
   *
   * @param messageId - The ID of the user message to edit
   * @param newContent - The new content for the message
   */
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!newContent.trim()) return;
      if (isStreaming) return;

      console.info('[useChat] Editing message:', { messageId, newContentLength: newContent.length });

      // Find the message index
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0) {
        console.warn('[useChat] Message not found for editing:', messageId);
        return;
      }

      // Remove the edited message and all messages after it
      setMessages((prev) => prev.slice(0, msgIndex));

      // Re-send with new content after state update
      requestAnimationFrame(() => {
        sendMessage(newContent);
      });
    },
    [messages, isStreaming, setMessages, sendMessage]
  );

  /**
   * Fork session from a message (branch) — requires POST /chat/sessions/{id}/fork.
   */
  const forkSessionFromMessage = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return;
      try {
        const result = await chatService.forkSession(activeSessionId, {
          up_to_message_id: messageId,
        });
        await loadSessions();
        await selectSession(result.session_id);
        toast.success(t('chatPage.fork.success'));
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          toast.error(t('chatPage.fork.pendingBackend'));
        } else {
          console.error('[useChat] Fork failed:', error);
          toast.error(t('chatPage.fork.failed'));
        }
      }
    },
    [activeSessionId, loadSessions, selectSession, t]
  );

  /**
   * Toggle thinking section expansion.
   */
  const toggleThinking = useCallback(
    (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      const expanding = msg ? !msg.thinkingExpanded : true;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, thinkingExpanded: !m.thinkingExpanded }
            : m
        )
      );

      if (expanding) {
        void enrichMessageTrace(messageId);
      }
    },
    [setMessages, enrichMessageTrace]
  );

  /**
   * Clear all messages in the active session.
   * Calls backend DELETE endpoint and clears local state.
   */
  const clearSessionMessages = useCallback(async () => {
    if (!activeSessionId) return;

    console.info('[useChat] Clearing messages:', { sessionId: activeSessionId });
    try {
      await chatService.clearMessages(activeSessionId);
      setMessages([]);
      messagesLoadedForSessionRef.current = null;
      toast.success(t('chatPage.toasts.clearMessagesSuccess'));
      console.info('[useChat] Messages cleared:', { sessionId: activeSessionId });
    } catch (error: unknown) {
      console.error('[useChat] Failed to clear messages:', error);
      toast.error(t('chatPage.toasts.clearMessagesFailed'));
    }
  }, [activeSessionId, setMessages, t]);

  // ==========================================
  // Canvas Actions
  // ==========================================

  /**
   * Open content in the canvas panel.
   */
  const openCanvas = useCallback(
    (content: CanvasContent) => {
      setCanvasContent(content);
    },
    [setCanvasContent]
  );

  /**
   * Close the canvas panel.
   */
  const closeCanvas = useCallback(() => {
    setCanvasContent(null);
  }, [setCanvasContent]);

  // ==========================================
  // Side Effects
  // ==========================================

  // Bootstrap once per visit to /ai-chat (layout shell stays mounted across session URLs).
  useEffect(() => {
    if (chatBootstrapDoneRef.current) return;
    chatBootstrapDoneRef.current = true;
    void loadSessions();
    void loadModels();
  }, [loadSessions, loadModels]);

  // Reload session list when archived filter toggles (after initial bootstrap).
  useEffect(() => {
    if (!chatBootstrapDoneRef.current) return;
    void loadSessions();
  }, [showArchived, loadSessions]);

  // ==========================================
  // Computed Values
  // ==========================================

  /** Sessions filtered by search query — memoized to avoid re-computation */
  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) => {
        if (searchQuery) {
          return s.title.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      }),
    [sessions, searchQuery]
  );

  /** Pinned sessions (active only) */
  const pinnedSessions = useMemo(
    () => filteredSessions.filter((s) => s.is_pinned && !s.is_archived),
    [filteredSessions]
  );

  /** Recent sessions (non-pinned, non-archived) */
  const regularSessions = useMemo(
    () => filteredSessions.filter((s) => !s.is_pinned && !s.is_archived),
    [filteredSessions]
  );

  /** Archived sessions — shown in a separate group when include_archived is on */
  const archivedSessions = useMemo(
    () => filteredSessions.filter((s) => s.is_archived),
    [filteredSessions]
  );

  /** Upload progress for the active session only */
  const uploadProgress = useMemo(
    () => (activeSessionId ? uploadProgressMap[activeSessionId] ?? [] : []),
    [activeSessionId, uploadProgressMap]
  );

  /** Whether the active session has files uploading */
  const isUploading = useMemo(
    () => (activeSessionId ? isUploadingMap[activeSessionId] ?? false : false),
    [activeSessionId, isUploadingMap]
  );

  return {
    // State
    activeSessionId,
    sessions: filteredSessions,
    pinnedSessions,
    regularSessions,
    archivedSessions,
    messages,
    isStreaming,
    isLoadingSessions,
    isLoadingMessages,
    isSidebarOpen,
    canvasContent,
    selectedModel,
    searchQuery,
    showArchived,
    availableModels,
    isLoadingModels,
    uploadProgress,
    isUploading,

    // Session actions
    loadSessions,
    setSessionListFilters,
    createNewSession,
    selectSession,
    renameSession,
    deleteSession,
    deleteSessionsBulk,
    toggleArchiveSession,
    archiveSessionsBulk,
    togglePinSession,

    // Message actions
    sendMessage,
    stopStreaming,
    cancelUpload,
    resendLastMessage,
    editMessage,
    forkSessionFromMessage,
    setMessageFeedback,
    toggleThinking,
    isTraceEnriching,
    clearSessionMessages,

    // Canvas actions
    openCanvas,
    closeCanvas,

    // UI actions
    setIsSidebarOpen,
    setSelectedModel,
    setSearchQuery,
    setShowArchived,
    loadModels,
  };
}
