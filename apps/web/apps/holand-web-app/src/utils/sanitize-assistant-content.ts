// ============================================
// sanitize-assistant-content — keep orchestration artifacts out of the
// main answer bubble. Models sometimes emit tool_calls JSON, XML tool tags,
// or English pre-tool narration in the answer/token stream instead of (or
// before) the user-facing reply.
// ============================================

/** Patterns that indicate orchestration payload, not user-facing answer text. */
const TOOL_CALLS_JSON_RE = /"tool_calls"\s*:/;
const XML_TOOL_CALL_RE = /<\s*tool_call[\s>]/i;
const ORCHESTRATOR_PREAMBLE_RE =
  /^(?:I'll help you|Let me (?:start by|search|check|analyze)|I will (?:help|search|analyze)|Searching (?:the|for)|Analyzing (?:the|your))/i;

/**
 * Remove fenced/unfenced tool_calls JSON blocks from assistant answer text.
 */
export function stripToolCallsFromAnswer(content: string): string {
  if (!content) return '';

  let s = content;

  // ```json ... "tool_calls" ... ```
  s = s.replace(/```(?:json|JSON)?\s*\n[\s\S]*?"tool_calls"[\s\S]*?\n```/gi, '');

  // Bare JSON objects containing tool_calls (greedy but bounded by common closers)
  s = s.replace(/\{[^{}]*"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/g, '');
  // Nested objects (one level deeper for args)
  s = s.replace(/\{[\s\S]*?"tool_calls"\s*:\s*\[[\s\S]*?\]\s*,?\s*"[\s\S]*?\}/g, '');

  // XML-style tool_call blocks some models emit in text
  s = s.replace(/<\s*tool_call[\s\S]*?<\s*\/\s*tool_call\s*>/gi, '');
  s = s.replace(/<\s*tool_call[\s\S]*$/gi, '');

  return s;
}

/**
 * Normalize whitespace after stripping orchestration artifacts.
 */
export function normalizeAnswerWhitespace(content: string): string {
  return content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * Full sanitize pipeline for assistant message body shown to the user.
 */
export function sanitizeAssistantAnswerContent(content: string): string {
  if (!content?.trim()) return '';
  let s = stripToolCallsFromAnswer(content);
  s = normalizeAnswerWhitespace(s);
  return s;
}

/**
 * Whether raw content still contains orchestration artifacts (tool JSON/XML).
 */
export function containsOrchestrationArtifacts(content: string): boolean {
  if (!content) return false;
  return TOOL_CALLS_JSON_RE.test(content) || XML_TOOL_CALL_RE.test(content);
}

/**
 * Whether a line looks like English orchestrator narration before tools run.
 * Used only as a weak signal — never strip Persian/user content.
 */
export function isOrchestratorPreambleLine(line: string): boolean {
  const t = line.trim();
  if (!t || /[\u0600-\u06FF]/.test(t)) return false;
  return ORCHESTRATOR_PREAMBLE_RE.test(t);
}

/**
 * Decide if the main answer bubble should render during an active stream.
 *
 * - Before `answer_start`: hide body (Thought Process shows activity).
 * - After `answer_start`: show only sanitized, artifact-free text.
 * - Fallback when backend omits `answer_start`: show once tools idle and text is clean.
 */
export function shouldShowStreamingAnswerBody(options: {
  isStreaming: boolean;
  answerPhaseStarted: boolean;
  activeToolName: string | null | undefined;
  rawContent: string;
  hasActiveTimelineTools?: boolean;
}): boolean {
  const { isStreaming, answerPhaseStarted, activeToolName, rawContent, hasActiveTimelineTools } =
    options;

  if (!isStreaming) return true;

  if (activeToolName || hasActiveTimelineTools) return false;

  const sanitized = sanitizeAssistantAnswerContent(rawContent);
  if (!sanitized) return false;

  if (containsOrchestrationArtifacts(rawContent)) return false;

  if (answerPhaseStarted) return true;

  // Backend omitted answer_start — show only when clearly user-facing
  if (sanitized.length < 24) return false;
  if (isOrchestratorPreambleLine(sanitized.split('\n')[0] ?? '')) return false;

  return true;
}

/**
 * Pick the best user-facing answer from raw stream buffer and optional final payload.
 */
export function resolveFinalAssistantContent(
  rawStream: string,
  finalAnswer?: string | null
): string {
  const fromFinal = finalAnswer ? sanitizeAssistantAnswerContent(finalAnswer.trim()) : '';
  const fromStream = sanitizeAssistantAnswerContent(rawStream);

  if (fromFinal) {
    // Backend final is authoritative when the stream buffer still has tool JSON / preamble
    if (
      !fromStream ||
      containsOrchestrationArtifacts(rawStream) ||
      fromFinal.length >= fromStream.length * 0.4
    ) {
      return fromFinal;
    }
  }

  return fromStream || fromFinal;
}
