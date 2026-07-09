// ============================================
// Holand Chat Types
// TypeScript types for AI Chat API (Gateway :8000)
// Based on: API_JSON/AI Platform - API Gateway.json
//           API_JSON/AI Orchestrator Service.json
// ============================================

// ==========================================
// Artifact & File Types
// ==========================================

/**
 * File/artifact attached to a chat message.
 * Used when user uploads files or AI references documents.
 */
export interface ArtifactInput {
  /** Storage artifact ID */
  id?: string | null;
  /** File path in storage (minio:// URI or relative path) */
  path: string;
  /** Display file name */
  name?: string | null;
  /** MIME type (e.g. "image/png", "application/pdf") */
  mime_type?: string | null;
  /** File size in bytes */
  size?: number | null;
  /**
   * File type category â€” required by backend for tool selection.
   * Derived from MIME type: "image", "video", "audio", "document", "file".
   */
  type?: string | null;
  /**
   * Local blob URL for previewing the file in the current browser session.
   * Created via URL.createObjectURL(file) after upload.
   * Only valid during the current page session â€” NOT persisted.
   * Falls back to getArtifactUrl() when absent (e.g. history messages).
   * âš ï¸ This field is stripped before sending to backend â€” frontend-only.
   */
  localPreviewUrl?: string;
}

/**
 * File context returned by AI when processing file-related queries.
 */
export interface FileContext {
  /** File type: image, audio, video, document */
  type: string;
  /** File display name */
  name: string;
  /** Storage file path */
  path: string;
  /** MIME type */
  mime_type?: string | null;
  /** File size in bytes */
  size?: number | null;
  /** Suggested tools for processing this file */
  suggested_tools?: string[];
}

// ==========================================
// Tool Execution Types
// ==========================================

/**
 * Information about a tool execution during AI processing.
 * Returned in ChatResponse.tool_runs.
 */
export interface ToolRunInfo {
  /** Tool identifier (e.g. "web_search", "code_interpreter") */
  tool_id: string;
  /** Arguments passed to the tool */
  args?: Record<string, unknown>;
  /**
   * Tool execution result. Can be an object (most tools) or a string
   * (some tools return plain text). String results from SSE tool_end events
   * are kept as-is; stored results from backend may have been wrapped
   * in { text: "..." } by normalizeStorageToolRun.
   */
  result?: Record<string, unknown> | string;
  /** Step number in multi-step execution */
  step?: number;
  /** Execution status */
  status?: ToolStatus;
  /** Execution time in seconds */
  execution_time?: number;
  /** Error message if failed */
  error?: string | null;
  /** When execution started */
  started_at?: string | null;
  /** When execution completed */
  completed_at?: string | null;
  /**
   * Live progress 0-1 from `tool_progress` SSE events (frontend-only).
   * Only meaningful while the tool is actively running.
   */
  progress?: number | null;
  /**
   * Latest progress message from `tool_progress` SSE events (frontend-only).
   * E.g. "Downloading chunk 3/10" or "Parsing rowsâ€¦".
   */
  progressMessage?: string | null;
}

/** Tool execution status */
export type ToolStatus = 'success' | 'error' | 'timeout' | 'skipped';

// ==========================================
// Tool Call & Tool Result Types (from MessageResponse)
// Backend stores these separately per assistant message.
// ==========================================

/**
 * A tool call made by the LLM during processing.
 * Returned in MessageResponse.tool_calls.
 *
 * @endpoint GET /chat/sessions/{id}/messages â†’ MessageResponse.tool_calls
 */
export interface ToolCallItem {
  /** Call identifier (e.g. "call_abc") */
  id?: string;
  /** Tool name (e.g. "image.meta", "ocr.extract") */
  name: string;
  /** Step number in the agent graph */
  step?: number | null;
  /** Input arguments for the tool */
  arguments?: Record<string, unknown> | null;
}

/**
 * Result channels from tool execution.
 * Backend provides multi-channel output for different consumers.
 */
export interface ToolResultChannels {
  /** LLM-readable text summary */
  llm?: string | null;
  /** Data for embedding */
  embed?: Record<string, unknown> | null;
  /** Raw data */
  rawdata?: Record<string, unknown> | null;
}

/**
 * Inner result structure from tool execution.
 */
export interface ToolResultInner {
  /** Whether execution succeeded */
  ok?: boolean | null;
  /** Result data */
  data?: Record<string, unknown> | null;
  /** Multi-channel output */
  channels?: ToolResultChannels | null;
}

/**
 * Full result data from tool execution.
 */
export interface ToolResultData {
  /** Whether execution succeeded */
  ok?: boolean | null;
  /** Error message if failed */
  error?: string | null;
  /** Inner result with channels */
  result?: ToolResultInner | null;
  /** Tool identifier */
  tool_id?: string | null;
}

/**
 * A tool execution result stored in the message.
 * Returned in MessageResponse.tool_results.
 *
 * Contains nested structure: data.result.channels.llm for LLM summary.
 *
 * @endpoint GET /chat/sessions/{id}/messages â†’ MessageResponse.tool_results
 */
export interface ToolResultItem {
  /** Result identifier */
  id?: string;
  /** Tool name */
  name?: string | null;
  /** Whether execution succeeded */
  ok: boolean;
  /** Full result data including channels.llm */
  data?: ToolResultData | null;
  /** Error message on failure */
  error?: string | null;
  /** Execution time in seconds */
  execution_time?: number | null;
  /** Step number in the agent graph */
  step?: number | null;
}

// ==========================================
// Orchestrator Node & Plan Types
// ==========================================

/**
 * Node names in the Planning Agent flow.
 * Each represents a processing stage in the orchestrator graph.
 */
export type OrchestratorNodeName =
  | 'assess_complexity'
  | 'planner'
  | 'executor'
  | 'critic'
  | 'replanner'
  | 'synthesizer'
  | 'simple_response';

/**
 * A single task in the orchestrator's execution plan.
 * Created by the Planner node.
 */
export interface PlanTask {
  /** Task identifier */
  id: string;
  /** Human-readable task description */
  description: string;
  /** Tool assigned for this task */
  tool?: string;
  /** Current task status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Dependencies on other task IDs */
  depends_on?: string[];
}

/**
 * Execution plan from the Planner node.
 * Received via `plan` SSE event during streaming.
 */
export interface ExecutionPlan {
  /** Ordered list of tasks (may be empty or undefined during partial updates) */
  tasks?: PlanTask[];
  /** Request complexity classification */
  complexity?: 'simple' | 'moderate' | 'complex';
  /** Estimated tools to be used */
  estimated_tools?: string[];
}

/**
 * Critic evaluation result.
 * Received via `evaluation` SSE event.
 *
 * The backend spreads these fields directly into event_data,
 * so `overall_confidence` is a top-level field alongside the others.
 */
export interface CriticEvaluation {
  /**
   * Overall quality confidence (0-1).
   * Top-level field in the SSE evaluation event_data.
   */
  overall_confidence?: number;
  /** Per-task evaluations */
  task_evaluations: Array<{
    task_id: string;
    success: boolean;
    confidence: number;
    reasoning: string;
  }>;
  /** Identified gaps in results */
  gaps_identified: string[];
  /** Whether replanning is needed */
  needs_replan: boolean;
  /** Reason for replanning */
  replan_reason?: string;
}

// ==========================================
// Suggestion & Warning Types
// ==========================================

/**
 * Follow-up suggestion shown to user after AI response.
 */
export interface SuggestionItem {
  /** Suggestion display text */
  text: string;
  /** Action type: query (ask again), tool (run tool), info (display) */
  action_type?: 'query' | 'tool' | 'info';
  /** Additional data for the action */
  data?: Record<string, unknown> | null;
}

/**
 * Warning/notification from AI processing.
 */
export interface WarningItem {
  /** Warning message text */
  message: string;
  /** Severity level */
  level?: 'info' | 'warning' | 'error';
  /** Warning code for programmatic handling */
  code?: string | null;
}

// ==========================================
// Chat Request & Response (POST /chat, POST /chat/stream)
// ==========================================

/**
 * Request payload for sending a chat message.
 * @endpoint POST /chat (non-streaming) or POST /chat/stream (streaming)
 */
export interface ChatRequest {
  /** User's message text */
  message: string;
  /** Session ID to continue a conversation (omit for new session) */
  session_id?: string | null;
  /** Attached files/artifacts */
  artifacts?: ArtifactInput[];
  /** Enable streaming response (Gateway) */
  stream?: boolean;
  /** LLM model override (default: "qwen3-14b") */
  model?: string | null;
  /** Maximum processing steps (Orchestrator) */
  max_steps?: number | null;
  /** Use conversation memory (Orchestrator, default: true) */
  use_memory?: boolean;
  /** Enable streaming (Orchestrator) */
  streaming?: boolean;
  /** Show thinking/reasoning process (default: true) */
  show_thinking?: boolean;
  /** Include follow-up suggestions (default: true) */
  include_suggestions?: boolean;
  /** Additional context object */
  context?: Record<string, unknown> | null;
}

/**
 * Response from AI chat.
 * @endpoint POST /chat â€” full response
 * @endpoint POST /chat/stream â€” streamed as SSE events
 */
export interface ChatResponse {
  /** AI's answer text (may be partial in streaming) */
  answer: string;
  /** Session ID (auto-created if not provided in request) */
  session_id?: string | null;
  /** Trace ID for debugging/logging */
  trace_id?: string | null;
  /** Tools that were used during processing */
  tools_used?: unknown[];
  /** Detailed tool execution info */
  tool_runs?: ToolRunInfo[];
  /** Response artifacts (generated files, etc.) */
  artifacts?: unknown[];
  /** Follow-up suggestions for the user */
  suggestions?: SuggestionItem[];
  /** Warnings from processing */
  warnings?: WarningItem[];
  /** AI's thinking/reasoning process text */
  thinking?: string | null;
  /** Number of processing steps taken */
  steps?: number;
  /** Whether this is the final response chunk (streaming) */
  final?: boolean;
  /** File context if file was processed */
  file_context?: FileContext | null;
  /** Model used for the response */
  model?: string | null;
  /** Total tokens consumed */
  total_tokens?: number | null;
  /** Processing time in seconds */
  processing_time?: number | null;
  /** Response creation timestamp */
  created_at?: string;
}

// ==========================================
// Session Types (POST/GET/PATCH/DELETE /chat/sessions)
// ==========================================

/**
 * Request to create a new chat session.
 * @endpoint POST /chat/sessions
 */
export interface SessionCreateRequest {
  /** Session title (default: "Ú†Øª Ø¬Ø¯ÛŒØ¯") */
  title?: string;
  /** LLM model for this session (default: "qwen3-14b") */
  model?: string;
  /** Custom system prompt */
  system_prompt?: string | null;
  /** Explicit folder assignment (hub/surface auto-assign when omitted) */
  folder_id?: string | null;
  project_id?: string | null;
  /** hub = /ai-chat; surface = native dock / page chat */
  chat_mode?: 'hub' | 'surface';
  surface?: string | null;
  anchor_key?: string | null;
  is_dock_session?: boolean;
}

/**
 * Request to update an existing session.
 * @endpoint PATCH /chat/sessions/{session_id}
 */
export interface SessionUpdateRequest {
  /** New title */
  title?: string | null;
  /** Archive/unarchive */
  is_archived?: boolean | null;
  /** Pin/unpin */
  is_pinned?: boolean | null;
  /** Move session to folder */
  folder_id?: string | null;
  project_id?: string | null;
}

/**
 * Chat session object returned from API.
 * Inferred from session endpoints â€” actual response shape
 * determined by backend (no explicit schema in API spec).
 */
export interface ChatSession {
  /** Unique session ID */
  id: string;
  /** Session display title */
  title: string;
  /** LLM model used */
  model?: string;
  /** Whether session is archived */
  is_archived?: boolean;
  /** Whether session is pinned */
  is_pinned?: boolean;
  /** Session creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
  /** Messages (included when include_messages=true) */
  messages?: ChatMessage[];
  /** Message count */
  message_count?: number;
  /** Optional folder for sidebar grouping */
  folder_id?: string | null;
  /** Optional project grouping */
  project_id?: string | null;
  /** hub | surface */
  chat_mode?: 'hub' | 'surface';
  /** Native surface id when chat_mode=surface */
  surface?: string | null;
  /** Dock anchor key e.g. offline_map:case-42 */
  anchor_key?: string | null;
  is_dock_session?: boolean;
  parent_session_id?: string | null;
  forked_at_message_id?: string | null;
}

// ==========================================
// Message Types (GET /chat/sessions/{id}/messages)
// ==========================================

/**
 * Chat message in a session.
 * Inferred from endpoint responses â€” no explicit
 * MessageResponse schema in the API spec.
 */
export interface ChatMessage {
  /** Message ID */
  id: string;
  /** Session this message belongs to */
  session_id: string;
  /** Message sender role */
  role: 'user' | 'assistant' | 'system';
  /** Message text content */
  content: string;
  /** AI thinking/reasoning (assistant messages only) */
  thinking?: string | null;
  /**
   * Structured reasoning segments from backend `reasoning` array.
   * Each element represents a distinct phase of thinking (e.g., before/after tool calls).
   * Preserved to enable accurate interleaved timeline reconstruction in history.
   *
   * WHY: Backend may send `reasoning` as an array of `{content, text}` objects.
   * We keep the structure so `buildStepsFromHistory` can create separate thinking
   * steps and interleave them with tool_runs, matching the original streaming order.
   */
  reasoningSegments?: string[];
  /**
   * Tool calls made by the LLM during processing.
   * Parsed from backend MessageResponse.tool_calls.
   * Contains tool name + arguments (what the LLM requested).
   */
  tool_calls?: ToolCallItem[] | null;
  /**
   * Tool execution results.
   * Parsed from backend MessageResponse.tool_results.
   * Contains ok/error + data.result.channels.llm summary.
   */
  tool_results?: ToolResultItem[] | null;
  /** Tool runs during this message (legacy / streaming accumulation) */
  tool_runs?: ToolRunInfo[];
  /** Tools used during this message (name list â€” lighter than tool_runs) */
  tools_used?: string[];
  /** Suggestions (assistant messages only) */
  suggestions?: SuggestionItem[];
  /** Warnings */
  warnings?: WarningItem[];
  /** Attached artifacts/files */
  artifacts?: ArtifactInput[];
  /** Model used (assistant messages) */
  model?: string | null;
  /** Processing steps count */
  steps?: number;
  /** Prompt tokens used */
  tokens_prompt?: number | null;
  /** Completion tokens used */
  tokens_completion?: number | null;
  /** Total tokens used (computed: tokens_prompt + tokens_completion) */
  total_tokens?: number | null;
  /** Processing time in seconds */
  processing_time?: number | null;
  /** Additional metadata from backend */
  metadata?: Record<string, unknown> | null;
  /** Message timestamp */
  created_at?: string;
  /** Agent trace ID â€” stable link to GET /traces/{trace_id} */
  trace_id?: string | null;
}

// ==========================================
// Stream Event Types (SSE from /chat/stream)
// ==========================================

/**
 * Normalized event types used in the frontend.
 * Maps 1:1 to backend SSE event types from orchestrator guide v2.1.
 *
 * Backend events: status, node, plan, progress, thinking, tool_start,
 * tool_progress, tool_result, evaluation, answer, suggestion, warning,
 * final, done, error.
 */
export type StreamEventType =
  | 'status'
  | 'node'
  | 'plan'
  | 'progress'
  | 'thinking'
  | 'token'
  | 'tool_start'
  | 'tool_progress'
  | 'tool_result'
  | 'evaluation'
  | 'suggestion'
  | 'warning'
  | 'final'
  | 'done'
  | 'error';

/**
 * A single normalized streaming event from POST /chat/stream.
 * The service layer maps raw backend SSE events into this shape.
 *
 * Event payload varies by type:
 * - status: { message, trace_id }
 * - node: { node: OrchestratorNodeName, trace_id, timestamp }
 * - plan: { plan: ExecutionPlan, trace_id }
 * - progress: { message, task_id?, progress?, status? }
 * - thinking: string (streaming content token)
 * - token: string (answer content token)
 * - tool_start: { tool_name, tool_id, args, step }
 * - tool_progress: { tool_id, progress: 0-1, message }
 * - tool_result: { tool_id, tool_name, ok, data?, error?, execution_time }
 * - evaluation: { overall_confidence: 0-1, evaluation: CriticEvaluation }
 * - suggestion: SuggestionItem
 * - warning: WarningItem
 * - final: { answer, tool_runs[], suggestions[], trace_id, steps, processing_time }
 * - done: { trace_id, elapsed }
 * - error: { message, code }
 */
export interface StreamEvent {
  /** Normalized event type */
  type: StreamEventType;
  /** Event payload â€” structure depends on type */
  data:
    | string
    | ToolRunInfo
    | SuggestionItem
    | WarningItem
    | ChatResponse
    | Record<string, unknown>;
}

// ==========================================
// Thinking Timeline Types (Frontend-only)
// ==========================================

/** Step type in the AI reasoning timeline */
export type ThinkingStepType = 'thinking' | 'tool' | 'answer' | 'node' | 'plan' | 'evaluation' | 'progress';

/**
 * A single step in the AI's reasoning timeline.
 * Built from SSE events during streaming, or reconstructed
 * from thinking + tool_runs for historical messages.
 *
 * The timeline captures the order: thinking â†’ tool â†’ thinking â†’ tool â†’ answer
 * similar to how LangChain/LangGraph processes a request.
 */
export interface ThinkingStep {
  /** Step type: thinking, tool, answer, node, plan, evaluation, progress */
  type: ThinkingStepType;
  /** Text content (thinking text, status message, node name, etc.) */
  content: string;
  /** Tool run info (for 'tool' type only) */
  tool?: ToolRunInfo;
  /** Orchestrator node name (for 'node' type) */
  nodeName?: OrchestratorNodeName;
  /** Execution plan (for 'plan' type) */
  plan?: ExecutionPlan;
  /** Critic confidence score 0-1 (for 'evaluation' type) */
  confidence?: number;
  /** Critic evaluation detail (for 'evaluation' type) */
  evaluation?: CriticEvaluation;
  /**
   * Progress step metadata (for 'progress' type).
   * Contains full backend data that can be shown in expandable detail section.
   */
  progressData?: {
    /** Full status message from backend (may include emojis, Persian text) */
    message: string;
    /** Progress percentage 0-1 (optional) */
    progress?: number;
    /** Task or step ID */
    taskId?: string;
    /** Current state: pending, running, completed, failed */
    state?: 'pending' | 'running' | 'completed' | 'failed';
  };
  /** Whether this step is currently in progress (streaming) */
  isActive: boolean;
  /** Sequential step number (1-based) */
  stepNumber: number;
  /** Client-side timestamp (epoch ms) */
  timestamp: number;
  /**
   * Task list for plan-centric execution (Executor / planner output).
   * Updated in-place from progress events â€” checklist + progress bar in UI.
   */
  tasks?: Array<{
    /** Stable task id from backend plan/progress events */
    taskId?: string;
    description: string;
    state: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  /**
   * Total task count (e.g. from "Execution plan ready (N steps)").
   * Used for accurate progress before all task rows exist.
   */
  totalTaskCount?: number;
  /**
   * Sub-events for `node` steps: tool_start / tool_end (and optional progress).
   * Keeps tools nested under the orchestrator node instead of duplicate top-level rows.
   */
  subEvents?: Array<{
    type: 'progress' | 'tool_start' | 'tool_end' | 'thinking';
    label: string;
    message?: string;
    state: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    tool?: ToolRunInfo;
    timestamp: number;
  }>;
}

// ==========================================
// UI State Types (Frontend-only)
// ==========================================

/** User feedback on an AI message */
export type MessageFeedback = 'like' | 'dislike' | null;

/**
 * Extended message type for UI state.
 * Adds client-side properties to ChatMessage.
 */
export interface UIMessage extends ChatMessage {
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  /** Partial content being streamed */
  streamContent?: string;
  /** Partial thinking being streamed */
  streamThinking?: string;
  /** User feedback (like/dislike) */
  feedback?: MessageFeedback;
  /** Whether thinking section is expanded */
  thinkingExpanded?: boolean;
  /** Client-side error for this message */
  error?: string | null;
  /** Duration of AI thinking phase in seconds (client-measured) */
  thinkingDuration?: number;
  /** Timestamp when streaming started (client-side, ISO string) */
  streamStartedAt?: string;
  /** Whether the backend signaled the final answer phase (`status:answer_start`) */
  answerPhaseStarted?: boolean;
  /**
   * Name of the tool currently executing during streaming.
   * Set on tool_start, cleared on tool_end. Used for real-time UI indicator.
   */
  activeToolName?: string | null;
  /**
   * Tool runs being accumulated during streaming (before 'final' event).
   * These are live/partial â€” replaced by tool_runs from 'final' event on finalize.
   */
  streamToolRuns?: ToolRunInfo[];
  /**
   * Reasoning timeline steps accumulated during streaming.
   * Captures the interleaved order: node â†’ plan â†’ thinking â†’ tool â†’ evaluation â†’ answer.
   * Built from SSE events (node, plan, thinking, tool_start, tool_result, evaluation, answer).
   */
  streamSteps?: ThinkingStep[];
  /**
   * Finalized reasoning timeline (after streaming completes or from history).
   * Used for displaying the step-by-step process view.
   */
  thinkingSteps?: ThinkingStep[];
  /**
   * Current orchestrator node during streaming.
   * Updated from 'node' SSE events.
   */
  currentNode?: OrchestratorNodeName | null;
  /**
   * Execution plan received from 'plan' SSE event.
   */
  executionPlan?: ExecutionPlan | null;
  /**
   * Overall confidence score from critic evaluation (0-1).
   * Set from 'evaluation' SSE event or trace data.
   */
  overallConfidence?: number | null;
  /**
   * Number of replanning iterations.
   * From trace data.
   */
  replanCount?: number | null;
}

/**
 * Chat page UI state managed by Jotai atoms.
 */
export interface ChatUIState {
  /** Currently active session ID */
  activeSessionId: string | null;
  /** List of sessions */
  sessions: ChatSession[];
  /** Messages for the active session */
  messages: UIMessage[];
  /** Whether a response is being streamed */
  isStreaming: boolean;
  /** Whether sessions are loading */
  isLoadingSessions: boolean;
  /** Whether messages are loading */
  isLoadingMessages: boolean;
  /** Sidebar expanded state */
  isSidebarOpen: boolean;
  /** Canvas panel state */
  canvasContent: CanvasContent | null;
  /** Current model selection */
  selectedModel: string;
  /** Search query for filtering sessions */
  searchQuery: string;
  /** Whether to show archived sessions */
  showArchived: boolean;
}

/**
 * Content displayed in the canvas/side panel.
 */
export interface CanvasContent {
  /** Content type */
  type: 'code' | 'markdown' | 'table' | 'chart' | 'diagram' | 'html' | 'json' | 'pdf';
  /** Display title */
  title: string;
  /** Raw content string (or URL for PDF) */
  content: string;
  /** Programming language (for code type) */
  language?: string;
  /** Chart data (for chart type) - array of objects or CSV string */
  chartData?: unknown[] | string;
  /** Chart type - bar, line, pie, area, etc. */
  chartType?: 'bar' | 'line' | 'pie' | 'area' | 'composed';
}

// ==========================================
// Model Types (GET /v1/models â€” LLM Proxy)
// ==========================================

/**
 * Model info returned from LLM Proxy's GET /v1/models endpoint.
 * Shape follows OpenAI `/v1/models` response convention.
 */
export interface ModelInfo {
  /** Model identifier (e.g. "qwen3-14b") â€” sent to chat API */
  id: string;
  /** Human-readable label from admin LLM settings / roles */
  display_name?: string;
  /** Object type â€” always "model" */
  object?: string;
  /** Model owner/creator */
  owned_by?: string;
  /** Creation timestamp (unix) */
  created?: number;
  /** Additional permissions or metadata */
  [key: string]: unknown;
}

/** Chat plugin model binding from gateway admin */
export interface ChatModelsSnapshot {
  models: ModelInfo[];
  defaultModel: string;
  /** false when service.orchestrator.chat route is missing/inactive */
  resolved: boolean;
}

/**
 * Response from POST /upload endpoint.
 * Backend may return different shapes:
 * - `{ artifacts: [...] }` â€” expected standard shape
 * - `{ saved: [...], count: N }` â€” actual current backend shape
 * - `{ id, path, name, mime_type }` â€” single artifact shape
 *
 * The `saved` array items typically contain:
 * `{ id, storage_path, media_type, original_filename, file_size_bytes, ... }`
 */
export interface UploadResponse {
  /** Uploaded artifact details (standard shape) */
  artifacts?: ArtifactInput[];
  /** Saved artifacts from backend (actual current shape) */
  saved?: SavedArtifact[];
  /** Number of files saved */
  count?: number;
  /** Alternative: single artifact */
  id?: string;
  path?: string;
  name?: string;
  mime_type?: string;
  /** Any additional fields from backend */
  [key: string]: unknown;
}

/**
 * Artifact object as returned by the Storage Service in the `saved` array.
 * Maps from backend DB schema (snake_case) to frontend artifact model.
 */
export interface SavedArtifact {
  /** Artifact UUID from database */
  id?: string;
  /** Full storage path (e.g. /data/uploads/session_abc/file.pdf) */
  storage_path?: string;
  /** Media type category (e.g. "image", "document", "audio") */
  media_type?: string;
  /** Original filename as uploaded */
  original_filename?: string;
  /** MIME type (e.g. "image/png", "application/pdf") */
  mime_type?: string;
  /** File size in bytes */
  file_size_bytes?: number;
  /** File checksum */
  checksum?: string;
  /** Folder ID if organized */
  folder_id?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Any additional metadata */
  [key: string]: unknown;
}

// ==========================================
// Upload Progress Types
// ==========================================

/** Upload status for a single file */
export type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'failed';

/**
 * Tracks upload progress of a single file attachment.
 * Used to display per-file progress bars in ChatInput.
 */
export interface FileUploadProgress {
  /** File reference */
  file: File;
  /** Current upload status */
  status: FileUploadStatus;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Error message if status is 'failed' */
  error?: string;
  /** Resulting artifact if upload succeeded */
  artifact?: ArtifactInput;
}

/**
 * Request payload for POST /feedback endpoint.
 * @endpoint POST /feedback (Storage Service)
 */
export interface FeedbackRequest {
  /** Session ID for the feedback */
  session_id: string;
  /** Message ID this feedback is for */
  message_id?: string;
  /** Rating (1-5, where 5=like, 1=dislike) */
  rating: number;
  /** Optional user comment */
  comment?: string;
  /** Message text for context */
  message_text?: string;
}

/** @deprecated No hardcoded model â€” resolved from admin chat.default + /admin/llm/models */
export const FALLBACK_MODELS: ModelInfo[] = [];

/** Initial atom value before gateway resolves chat.default */
export const DEFAULT_MODEL = '';

// ==========================================
// Tool Types (GET /tools â€” Gateway)
// ==========================================

/**
 * Tool information returned from GET /tools endpoint.
 * Used to display available AI capabilities in the chat UI.
 */
export interface ToolInfo {
  /** Tool identifier (e.g. "web_search", "code_interpreter") */
  id: string;
  /** Tool display name */
  name?: string;
  /** Tool description */
  description?: string;
  /** Category (e.g. "text", "image", "audio", "analysis") */
  category?: string;
  /** List of capabilities this tool provides */
  capabilities?: string[];
  /** Argument schema for the tool */
  args?: Record<string, unknown>;
  /** Full parameters schema */
  parameters?: Record<string, unknown>;
  /** Whether the tool is enabled */
  enabled?: boolean;
  /** Tool version */
  version?: string | null;
  /** Timeout in seconds */
  timeout_sec?: number | null;
  /** Whether tool supports persistence */
  supports_persist?: boolean;
  /** Whether tool has a UI component */
  has_ui?: boolean;
  /** Any additional fields from backend */
  [key: string]: unknown;
}

// ==========================================
// Memory Types (Orchestrator â€” /memory)
// ==========================================

/**
 * A single memory entry from the Orchestrator's memory system.
 * Shape is inferred â€” backend returns generic JSON.
 */
export interface MemoryEntry {
  /** Memory entry ID */
  id?: string;
  /** Memory content text */
  content: string;
  /** User ID this memory belongs to */
  user_id?: string;
  /** Session ID this memory is associated with */
  session_id?: string;
  /** Memory category (e.g. "context", "preference", "fact") */
  category?: string;
  /** Whether this is a long-term memory */
  is_long_term?: boolean;
  /** Creation timestamp */
  created_at?: string;
  /** Relevance score (for search results) */
  score?: number;
  /** Any additional fields */
  [key: string]: unknown;
}

// ==========================================
// Storage Artifact Types (Gateway â€” /storage/artifacts)
// ==========================================

/**
 * A storage artifact (uploaded file) from the Storage Service.
 * Returned from GET /storage/artifacts and related endpoints.
 */
export interface StorageArtifact {
  /** Artifact unique ID */
  id: string;
  /** Storage path on disk */
  storage_path?: string;
  /** Media type category (e.g. "image", "document", "audio") */
  media_type?: string;
  /** Original uploaded filename */
  original_filename?: string;
  /** MIME type */
  mime_type?: string;
  /** File size in bytes */
  file_size_bytes?: number;
  /** Folder ID if organized */
  folder_id?: string | null;
  /** File checksum */
  checksum?: string | null;
  /** Associated user ID */
  user_id?: string;
  /** Associated session ID */
  session_id?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  created_at?: string;
  /** Any additional fields */
  [key: string]: unknown;
}

// ==========================================
// Export & Share Types
// ==========================================

/** Supported export formats for chat sessions */
export type ExportFormat = 'json' | 'markdown' | 'txt' | 'pdf';

/**
 * Response from POST /chat/sessions/{id}/share
 * @endpoint POST /chat/sessions/{session_id}/share
 */
export interface ShareSessionResponse {
  /** Shareable link URL */
  share_url: string;
  /** Share token/ID */
  share_id: string;
  /** When the share link expires â€” null/omitted means no expiration */
  expires_at?: string | null;
}

/** Expiry for public share: positive hours, 0 or null = never expires */
export type ShareExpiryHours = number | 0 | null;

export type SessionSharePermission = 'read';

/** A user the session has been shared with */
export interface SessionShareRecipient {
  user_id: string;
  display_name?: string;
  email?: string;
  permission: SessionSharePermission;
  shared_at: string;
}

export interface ShareSessionWithUsersRequest {
  recipient_user_ids: string[];
  permission: SessionSharePermission;
}

export interface ShareSessionWithUsersFailedEntry {
  user_id: string;
  reason: string;
}

export interface ShareSessionWithUsersResponse {
  shared: SessionShareRecipient[];
  failed: ShareSessionWithUsersFailedEntry[];
}

export interface SharedWithMeSession {
  session_id: string;
  title: string;
  shared_by: { id: string; name?: string };
  shared_at: string;
  permission: SessionSharePermission;
}

export interface PublicShareResolveResponse {
  session_id: string;
  title: string;
  expires_at?: string | null;
  owner_display_name?: string;
  message_count?: number;
}

/** Read-only message shape for public share viewer */
export interface PublicShareMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface ChatSessionFolder {
  id: string;
  name: string;
  color?: string;
  kind?: 'system' | 'user';
  slug?: string | null;
  is_system?: boolean;
  session_count?: number;
  created_at?: string;
}

/** Response from POST /chat/sessions/folders/bootstrap */
export interface BootstrapFoldersResponse {
  default_public_folder_id: string | null;
  folders: ChatSessionFolder[];
}

/** Native chat surface registry entry from GET /chat/surfaces */
export interface ChatSurfaceDefinition {
  id: string;
  folder_slug?: string | null;
  label_key?: string | null;
  allowed_tools?: string[] | null;
}

export interface DockSessionRequest {
  surface: string;
  anchor_key: string;
  title?: string;
}

export interface ChatSearchRequest {
  query: string;
  scope?: 'all' | 'titles' | 'messages' | 'files';
  session_ids?: string[];
  limit?: number;
}

export interface ChatSearchHit {
  session_id: string;
  message_id?: string;
  snippet: string;
  score?: number;
  type: 'session' | 'message' | 'file';
}

export interface ForkSessionResponse {
  session_id: string;
  parent_session_id: string;
  forked_at_message_id: string;
}

export interface ChatProject {
  id: string;
  name: string;
  description?: string;
  system_rules?: string;
  default_model?: string;
  created_at?: string;
}

export interface ChatImportResult {
  imported_sessions: Array<{ id: string; title: string }>;
  failed: Array<{ title?: string; reason: string }>;
}

// ==========================================
// Storage Quota Types
// ==========================================

/**
 * Storage quota info for the current user.
 * @endpoint GET /storage/quota
 */
export interface StorageQuota {
  /** Total storage in bytes */
  total_bytes: number;
  /** Used storage in bytes */
  used_bytes: number;
  /** Remaining storage in bytes */
  remaining_bytes: number;
  /** Usage percentage (0-100) */
  usage_percent: number;
  /** Max file size allowed in bytes */
  max_file_size?: number;
}

// ==========================================
// File Analysis Types
// ==========================================

/**
 * Detailed metadata for a file/artifact.
 * @endpoint GET /storage/artifacts/{id}/metadata
 */
export interface FileMetadata {
  /** Artifact ID */
  id: string;
  /** Original filename */
  original_filename: string;
  /** MIME type */
  mime_type: string;
  /** File size in bytes */
  file_size_bytes: number;
  /** Media type category */
  media_type?: string;
  /** Image/video dimensions */
  dimensions?: { width: number; height: number };
  /** Duration for audio/video files (seconds) */
  duration?: number;
  /** File checksum */
  checksum?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Analysis result for a file.
 * @endpoint PUT /storage/artifacts/{id}/analyze
 */
export interface FileAnalysisResult {
  /** Artifact ID */
  id: string;
  /** Analysis status */
  status: 'completed' | 'failed' | 'pending';
  /** Extracted text (for documents) */
  extracted_text?: string;
  /** Detected objects/entities (for images) */
  detections?: Record<string, unknown>[];
  /** Summary */
  summary?: string;
  /** Any additional analysis data */
  [key: string]: unknown;
}

/**
 * Preview data for a file.
 * @endpoint GET /storage/artifacts/{id}/preview
 */
export interface FilePreviewData {
  /** Preview type */
  type: 'image' | 'text' | 'html' | 'pdf';
  /** Preview content (base64 for images, text for documents) */
  content: string;
  /** MIME type of the preview */
  mime_type: string;
  /** Whether full preview is available or truncated */
  is_truncated?: boolean;
}

// ==========================================
// Pre-signed URL Types
// ==========================================

/**
 * Response from GET /storage/files/{id}/presigned-url.
 * Provides a temporary direct URL to the underlying MinIO storage
 * for video/audio streaming with Range request support.
 */
export interface PresignedUrlResponse {
  /** Direct MinIO URL (pre-authenticated, no JWT needed) */
  url: string;
  /** URL validity duration in seconds */
  expires_in: number;
  /** HTTP method to use (typically "GET") */
  method: string;
}

// ==========================================
// Chunked Upload Types
// ==========================================

/**
 * Request body for POST /storage/upload/init.
 * Initiates a resumable chunked upload session.
 */
export interface ChunkedUploadInitRequest {
  /** Original filename */
  filename: string;
  /** Total file size in bytes */
  total_size: number;
  /** Total number of chunks (required by backend) */
  total_chunks: number;
  /** MIME type (backend field name is mime_type, NOT content_type) */
  mime_type?: string | null;
  /** Associated chat session ID */
  session_id?: string;
}

/**
 * Response from POST /storage/upload/init.
 * Contains the upload_id needed for subsequent chunk uploads.
 */
export interface ChunkedUploadInitResponse {
  /** Unique upload session identifier */
  upload_id: string;
  /** Chunk size that the server expects (bytes) */
  chunk_size: number;
  /** Total number of chunks expected */
  total_chunks: number;
}

/**
 * Response from PUT /storage/upload/{id}/chunk/{index}.
 * Confirms receipt of a single chunk.
 */
export interface ChunkedUploadChunkResponse {
  /** Chunk index that was received */
  chunk_index: number;
  /** Server-verified chunk size */
  received_bytes: number;
}

/**
 * Response from POST /storage/upload/{id}/complete.
 * Final artifact info after all chunks are assembled.
 */
export interface ChunkedUploadCompleteResponse {
  /** Artifact ID of the assembled file */
  artifact_id: string;
  /** Storage path */
  storage_path: string;
  /** Original filename */
  filename: string;
  /** Total file size */
  total_size: number;
  /** MIME type */
  content_type: string;
}

/**
 * Response from GET /storage/upload/{id}/status.
 * Shows progress of a chunked upload.
 */
export interface ChunkedUploadStatusResponse {
  /** Upload session ID */
  upload_id: string;
  /** Upload state */
  status: 'uploading' | 'completed' | 'failed' | 'cancelled';
  /** Chunks received so far */
  chunks_received: number;
  /** Total chunks expected */
  total_chunks: number;
  /** Bytes uploaded so far */
  bytes_uploaded: number;
  /** Total file size */
  total_size: number;
}

/**
 * Persisted tool run record from Storage Service.
 * Different from ToolRunInfo (which is the in-flight SSE format).
 *
 * @endpoint GET /storage/tool-runs?session_id={id}
 */
export interface StorageToolRun {
  /** Unique tool run ID */
  id: string;
  /** Chat session ID */
  session_id: string;
  /** Message ID this run belongs to */
  message_id?: string;
  /** Tool identifier */
  tool_id: string;
  /** Tool input arguments */
  inputs: Record<string, unknown>;
  /** Tool output */
  output: Record<string, unknown> | string | null;
  /** Trace/correlation ID */
  trace_id?: string;
  /** Step number in multi-tool execution */
  step?: number;
  /** Execution time in milliseconds */
  elapsed_ms?: number;
  /** When the run was created */
  created_at: string;
}

/**
 * Response from GET /chat/sessions/{id}/messages?include_tool_runs=true
 * Backend returns object with messages and tool_runs arrays.
 * Backward compatible: without include_tool_runs, returns plain array.
 *
 * @endpoint GET /chat/sessions/{id}/messages?include_tool_runs=true
 */
export interface MessagesWithToolRunsResponse {
  /** Chat messages */
  messages: ChatMessage[];
  /** Tool runs executed during this session */
  tool_runs: StorageToolRun[];
}

// ==========================================
// Agent Tracing & Planning Types
// GET /traces, /traces/{id}, /traces/{id}/steps, etc.
// ==========================================

/** Trace execution status */
export type TraceStatus = 'running' | 'completed' | 'failed';

/** Request complexity level determined by assess_complexity step */
export type TraceComplexity = 'simple' | 'complex';

/**
 * Node names in the Planning Agent flow.
 * Each represents a processing stage.
 */
export type TraceNodeName =
  | 'assess_complexity'
  | 'planner'
  | 'executor'
  | 'critic'
  | 'replanner'
  | 'synthesizer'
  | 'simple_response';

/**
 * Summary info for a trace (from list endpoint).
 *
 * @endpoint GET /traces?session_id={id}&status={status}&limit=50&offset=0
 */
export interface TraceSummary {
  /** Unique trace ID */
  trace_id: string;
  /**
   * When the gateway links a trace to the persisted assistant message,
   * this matches `ChatMessage.id` â€” enables exact history replay without
   * positional heuristics. Optional until backend exposes it.
   */
  message_id?: string | null;
  /** Session this trace belongs to */
  session_id: string;
  /** Execution status */
  status: TraceStatus;
  /** Complexity classification */
  complexity: TraceComplexity | null;
  /** When processing started */
  started_at: string;
  /** When processing completed (null if running) */
  completed_at: string | null;
  /** Total duration in milliseconds */
  total_duration_ms: number | null;
  /** Total number of processing steps */
  total_steps: number | null;
  /**
   * Total number of tool calls executed.
   * NOTE: API field is `total_tool_calls` (not `total_tools`).
   */
  total_tool_calls: number | null;
}

/**
 * Execution plan stored in TraceDetail.
 * The API returns this as an opaque object (additionalProperties: true).
 * Structure mirrors the ExecutionPlan from SSE events.
 */
export interface TracePlan {
  /** Ordered tasks */
  tasks?: Array<{
    id: string;
    description: string;
    tool?: string;
    status: string;
    depends_on?: string[];
  }>;
  /** Complexity classification */
  complexity?: 'simple' | 'moderate' | 'complex';
  /** Estimated tools */
  estimated_tools?: string[];
  /** Allow additional backend fields */
  [key: string]: unknown;
}

/**
 * Full trace detail (with ?full=true).
 *
 * @endpoint GET /traces/{trace_id}?full=true
 */
export interface TraceDetail extends TraceSummary {
  /** Original user message that triggered this trace */
  user_message: string | null;
  /** User ID who initiated the trace */
  user_id: string | null;
  /** Execution plan (for complex requests) */
  execution_plan: TracePlan | null;
  /** Final synthesized answer */
  final_answer: string | null;
  /** Number of times the agent replanned */
  replan_count: number | null;
  /** Overall quality confidence (0-1) â€” from critic evaluation */
  overall_confidence: number | null;
  /** Error type if trace failed */
  error: string | null;
  /** Error message if trace failed */
  error_message: string | null;
  /** Additional metadata */
  metadata: Record<string, unknown> | null;
  /** User feedback rating (-1=thumbs down, 0=neutral, 1=thumbs up) */
  user_feedback_rating: number | null;
  /** User feedback text comment */
  user_feedback_comment: string | null;
  /** When feedback was recorded */
  user_feedback_at: string | null;
  /** Processing steps */
  steps: TraceStep[];
  /** Tool executions */
  tool_executions: TraceToolExecution[];
  /** Stream events (for replay) */
  stream_events: TraceEvent[];
}

/**
 * A single processing step in the agent pipeline.
 *
 * @endpoint GET /traces/{trace_id}/steps
 */
export interface TraceStep {
  /** Step sequence number */
  step_number: number;
  /** Agent node that executed this step */
  node_name: TraceNodeName;
  /** Step execution status */
  status: 'completed' | 'running' | 'failed';
  /** When this step started */
  started_at: string;
  /** When this step completed (null if running) */
  completed_at: string | null;
  /** Duration in milliseconds */
  duration_ms: number | null;
  /** Structured input data for this step */
  input_data: Record<string, unknown> | null;
  /** Structured output data (e.g. plan from planner) */
  output_data: Record<string, unknown> | null;
  /** LLM messages sent during this step */
  llm_messages_sent?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /** Raw LLM response â€” string or structured payload (e.g. `{ content: "..." }`) */
  llm_response?: string | Record<string, unknown> | null;
  /** Error message if step failed */
  error_message: string | null;
}

/**
 * Tool execution detail within a trace.
 *
 * @endpoint GET /traces/{trace_id}/tools
 */
export interface TraceToolExecution {
  /** Unique tool execution ID */
  tool_id: string;
  /** Which step this tool was executed in */
  step_number: number;
  /** Tool name (e.g. "search_files", "analyze_document") */
  tool_name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
  /** Raw result from tool */
  result: Record<string, unknown> | string | null;
  /** Formatted result text sent to LLM (string or structured JSON from backend) */
  result_sent_to_llm?: string | Record<string, unknown> | null;
  /** Execution status */
  status: 'completed' | 'running' | 'failed';
  /** Execution duration in milliseconds */
  duration_ms: number;
}

/** Event types emitted during trace processing */
export type TraceEventType =
  | 'step_started'
  | 'step_completed'
  | 'thinking'
  | 'tool_started'
  | 'tool_completed'
  | 'token'
  | 'error';

/**
 * A single event from the trace stream.
 *
 * @endpoint GET /traces/{trace_id}/events
 */
export interface TraceEvent {
  /** Type of event */
  event_type: TraceEventType;
  /** Event-specific data */
  event_data: Record<string, unknown>;
  /** Ordering sequence number */
  sequence_number: number;
  /** When this event occurred */
  timestamp: string;
}

// ==========================================
// Trace Feedback Types
// ==========================================

/**
 * Request body for submitting trace feedback.
 *
 * @endpoint PUT /traces/{trace_id}/feedback
 */
export interface TraceFeedbackRequest {
  /**
   * Rating value:
   * - 1  = thumbs up (excellent response)
   * - -1 = thumbs down (poor response)
   * - 0  = neutral / reset
   */
  rating: -1 | 0 | 1;
  /** Optional text comment (max 2000 chars) */
  comment?: string | null;
}

/**
 * Response from trace feedback endpoints.
 *
 * @endpoint GET /traces/{trace_id}/feedback
 * @endpoint PUT /traces/{trace_id}/feedback
 */
/**
 * Response from feedback endpoints â€” field names match the API response exactly.
 */
export interface TraceFeedbackResponse {
  /** Trace this feedback belongs to */
  trace_id: string;
  /** Rating (-1, 0, or 1) */
  user_feedback_rating: number;
  /** Optional text comment */
  user_feedback_comment: string | null;
  /** When feedback was recorded */
  user_feedback_at: string;
}

