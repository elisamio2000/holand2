// ============================================
// MessageBubble — Chat message display component
// Renders user and assistant messages with all features
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCopySimple,
  PiCheck,
  PiThumbsUp,
  PiThumbsUpFill,
  PiThumbsDown,
  PiThumbsDownFill,
  PiArrowClockwise,
  PiWarningCircle,
  PiSparkle,
  PiUser,
  PiClock,
  PiLightning,
  PiGear,
  PiPencilSimple,
  PiBrowsers,
  PiArrowBendDownRight,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import MarkdownRenderer from './markdown-renderer';
import MarkdownErrorBoundary from './markdown-error-boundary';
import ThinkingSteps from './thinking-steps';
import FilePreviewInline from './file-preview-inline';
import MessageArtifactCards from './message-artifact-cards';
import AssistantReferenceFloat from './assistant-reference-float';
import { debugLog } from '@/utils/debug-logger';
import { getLastParagraphDirection } from '@/utils/detect-direction';
import { truncateMarkdownForPreview } from '@/utils/markdown-safe-truncate';
import { normalizeAssistantMessageForCopy } from '@/utils/markdown-fence-unwrap';
import {
  sanitizeAssistantAnswerContent,
  shouldShowStreamingAnswerBody,
} from '@/utils/sanitize-assistant-content';
import type { UIMessage, CanvasContent, MessageFeedback } from '@/types/chat.types';
import HighlightedText from '@/app/shared/ai-chat/search/components/highlighted-text';

interface MessageBubbleProps {
  /** Message data */
  message: UIMessage;
  /** Set feedback callback */
  onFeedback: (messageId: string, feedback: MessageFeedback) => void;
  /** Toggle thinking expansion callback */
  onToggleThinking: (messageId: string) => void;
  /** Whether trace steps are being lazy-loaded on expand */
  isLoadingTrace?: boolean;
  /** Open content in canvas */
  onOpenCanvas: (content: CanvasContent) => void;
  /** Edit a user message and re-send */
  onEditMessage?: (messageId: string, newContent: string) => void;
  /** Resend message callback (for error retry) */
  onResend?: () => void;
  /** Click on a suggestion */
  onSuggestionClick?: (text: string) => void;
  /** Fork session from this message */
  onFork?: (messageId: string) => void;
  /** Search highlight query for jump-to-message */
  highlightQuery?: string;
  /** Brief ring flash after search jump */
  isFlashHighlight?: boolean;
}

/**
 * MessageBubble — Renders a single chat message (user or assistant).
 *
 * Features:
 * - User messages: right-aligned, primary color
 * - Assistant messages: left-aligned with avatar, markdown rendering
 * - Streaming animation (typing cursor)
 * - Thinking steps (collapsible)
 * - Copy, feedback (like/dislike), resend actions
 * - Suggestions display
 * - Error state with retry
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={msg}
 *   onFeedback={setMessageFeedback}
 *   onToggleThinking={toggleThinking}
 *   onOpenCanvas={openCanvas}
 *   onResend={resendLastMessage}
 * />
 * ```
 */
// File icon utility is imported from @/utils/file-icons
// Shared document-style SVG icons for consistent design

export default function MessageBubble({
  message,
  onFeedback,
  onToggleThinking,
  isLoadingTrace = false,
  onOpenCanvas,
  onEditMessage,
  onResend,
  onSuggestionClick,
  onFork,
  highlightQuery,
  isFlashHighlight = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    src: string;
    name: string;
    mimeType?: string | null;
    fileSize?: number | null;
    localPreviewUrl?: string;
    artifactId?: string;
  } | null>(null);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [referenceOpen, setReferenceOpen] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const rawContent =
    message.isStreaming && message.streamContent != null
      ? message.streamContent
      : message.content;
  const displayContent = sanitizeAssistantAnswerContent(rawContent);
  const showAnswerBody = shouldShowStreamingAnswerBody({
    isStreaming: !!message.isStreaming,
    answerPhaseStarted: !!message.answerPhaseStarted,
    activeToolName: message.activeToolName,
    rawContent,
    hasActiveTimelineTools: !!message.activeToolName,
  });
  const displayThinking =
    message.isStreaming && message.streamThinking
      ? message.streamThinking
      : message.thinking;
  const hasThoughtProcessVisible =
    !!displayThinking ||
    !!message.activeToolName ||
    !!(message.streamToolRuns?.length || message.tool_runs?.length) ||
    !!(message.thinkingSteps?.length || message.streamSteps?.length);
  // Defer markdown re-renders during streaming for better performance
  // This allows React to prioritize user interactions over content updates
  const deferredContent = useDeferredValue(displayContent);

  // Check if content is very long (>3000 chars)
  const isLongContent = deferredContent.length > 3000;
  const shouldTruncate = isLongContent && !isContentExpanded;
  const truncatedContent = shouldTruncate
    ? truncateMarkdownForPreview(deferredContent, 3000)
    : deferredContent;

  const handleCopy = useCallback(async () => {
    console.info('[MessageBubble] Copying message content');
    try {
      const text = isAssistant
        ? normalizeAssistantMessageForCopy(displayContent)
        : displayContent;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('[MessageBubble] Failed to copy');
    }
  }, [displayContent, isAssistant]);

  // ---- User Message ----
  if (isUser) {
    /**
     * Start inline editing — pre-fill textarea with current content.
     * Uses effect-based autofocus via editTextareaRef.
     */
    const startEditing = () => {
      setEditContent(message.content);
      setIsEditing(true);
      // Focus after render
      requestAnimationFrame(() => {
        editTextareaRef.current?.focus();
        // Move cursor to end
        const len = message.content.length;
        editTextareaRef.current?.setSelectionRange(len, len);
      });
    };

    const handleEditSubmit = () => {
      if (editContent.trim() && editContent !== message.content) {
        console.info('[MessageBubble] Submitting edited message:', { messageId: message.id });
        onEditMessage?.(message.id, editContent.trim());
      }
      setIsEditing(false);
    };

    const handleEditCancel = () => {
      setEditContent('');
      setIsEditing(false);
    };

    return (
      <>
        {/* dir="ltr" ensures user messages always align to RIGHT side in both LTR and RTL layouts.
            Text content inside bubbles uses dir="auto" to render Persian/Arabic correctly. */}
        <div className="flex flex-col items-end gap-1" dir="ltr">
          {/* File attachments — Session-files style cards above message text */}
          {message.artifacts && message.artifacts.length > 0 && (
            <MessageArtifactCards
              artifacts={message.artifacts}
              variant="user"
              onOpenPreview={setPreviewFile}
            />
          )}

          {/* Inline edit mode */}
          {isEditing ? (
            <div className="w-full max-w-[75%] rounded-xl border border-gray-200/95 bg-gray-50/90 p-2 shadow-sm dark:border-gray-600/45 dark:bg-gray-100/20">
              <textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEditSubmit();
                  }
                  if (e.key === 'Escape') {
                    handleEditCancel();
                  }
                }}
                className="min-h-[60px] w-full resize-none rounded-md border-0 bg-white/95 p-2 text-sm text-gray-900 shadow-none outline-none ring-0 ring-offset-0 transition-colors placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 dark:bg-gray-0/55 dark:text-gray-100 dark:placeholder:text-gray-500"
                dir="auto"
                rows={3}
              />
              <div className="mt-1 flex justify-end gap-2">
                <button
                  onClick={handleEditCancel}
                  className="rounded-lg px-3 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  disabled={!editContent.trim() || editContent === message.content}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                    editContent.trim() && editContent !== message.content
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-gray-200 text-gray-400 dark:bg-gray-200/40 dark:text-gray-500'
                  )}
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="group/user relative max-w-[75%]">
              <div
                className={cn(
                  'rounded-xl rounded-ee-sm bg-primary px-4 py-2.5 text-primary-foreground',
                  isFlashHighlight && 'ring-2 ring-primary/40 ring-offset-2'
                )}
              >
                <p className="bidi-user-text whitespace-pre-wrap text-sm leading-relaxed font-vazirmatn" dir="auto">
                  {highlightQuery ? (
                    <HighlightedText text={message.content} query={highlightQuery} />
                  ) : (
                    message.content
                  )}
                </p>
              </div>
              {/* Edit button — appears on hover */}
              {onEditMessage && (
                <div className="absolute -start-8 bottom-1 opacity-0 transition-opacity group-hover/user:opacity-100">
                  <Tooltip content={t('chatPage.messageBubble.edit')} placement="left">
                    <button
                      onClick={startEditing}
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/20"
                      aria-label={t('chatPage.messageBubble.editMessage')}
                    >
                      <PiPencilSimple className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          )}

          {!isEditing && message.created_at && (
            <span className="px-1 text-xs text-gray-400 dark:text-gray-500">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Inline file preview — ThinkingSteps-style collapsible box */}
        {previewFile && (
          <FilePreviewInline
            src={previewFile.src}
            name={previewFile.name}
            mimeType={previewFile.mimeType}
            fileSize={previewFile.fileSize}
            localPreviewUrl={previewFile.localPreviewUrl}
            artifactId={previewFile.artifactId}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </>
    );
  }

  // ---- Assistant Message ----
  return (
    <>
      <div className="flex gap-3">
      {/* Avatar */}
      <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
        <PiSparkle className="h-4 w-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Thinking steps — with tool runs integrated */}
        {(displayThinking || message.activeToolName || message.streamToolRuns?.length || message.tool_runs?.length || message.thinkingSteps?.length || message.streamSteps?.length) && (
          <>
          {debugLog.thinking('Rendering ThinkingSteps', {
              hasThinking: !!displayThinking,
              activeToolName: message.activeToolName,
              streamToolRunsCount: message.streamToolRuns?.length ?? 0,
              toolRunsCount: message.tool_runs?.length ?? 0,
              thinkingStepsCount: message.thinkingSteps?.length ?? 0,
              streamStepsCount: message.streamSteps?.length ?? 0,
              isStreaming: message.isStreaming,
              traceId: (message as unknown as Record<string, unknown>).trace_id,
            }) as unknown as null}
          <ThinkingSteps
            content={displayThinking ?? ''}
            isExpanded={message.thinkingExpanded ?? false}
            onToggle={() => onToggleThinking(message.id)}
            isStreaming={message.isStreaming}
            steps={message.steps}
            thinkingDuration={message.thinkingDuration}
            // During streaming: show streamToolRuns + active tool indicator
            // After done: show final tool_runs from backend
            toolRuns={message.isStreaming ? message.streamToolRuns : message.tool_runs}
            activeToolName={message.activeToolName}
            // ── Reasoning timeline steps ──
            thinkingSteps={message.thinkingSteps}
            streamSteps={message.streamSteps}
            // ── Structured reasoning segments for history interleaving ──
            reasoningSegments={message.reasoningSegments}
            // ── Agent trace (inside collapsible area) ──
            traceId={message.trace_id}
            isLoadingTrace={isLoadingTrace}
          />
          </>
        )}

        {message.artifacts && message.artifacts.length > 0 && (
          <div className="mb-3">
            <MessageArtifactCards
              artifacts={message.artifacts}
              variant="assistant"
              onOpenPreview={setPreviewFile}
            />
          </div>
        )}

        {message.warnings && message.warnings.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {message.warnings.map((warning, idx) => (
              <div
                key={`${warning.code ?? 'warn'}-${idx}`}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  warning.level === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-400'
                    : warning.level === 'info'
                      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/30 dark:bg-blue-950/20 dark:text-blue-300'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-300'
                )}
              >
                <PiWarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error state — full failure or partial response with stream error */}
        {message.error && (
          <div
            className={cn(
              'mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              displayContent
                ? 'border-red-200/80 bg-red-50/80 text-red-700 dark:border-red-800/25 dark:bg-red-950/15 dark:text-red-400'
                : 'border-red-200 bg-red-50 text-red-600 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-400'
            )}
          >
            <PiWarningCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              {displayContent
                ? t('messageBubble.streamErrorPartial', { error: message.error })
                : message.error}
            </span>
            {onResend && (
              <button
                onClick={onResend}
                className="ms-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <PiArrowClockwise className="h-3 w-3" />
                {t('messageBubble.retry')}
              </button>
            )}
          </div>
        )}

        {/* Message content — orchestration stays in Thought Process only */}
        {showAnswerBody && displayContent && (
          <div
            className={cn(
              'prose-sm max-w-none font-vazirmatn',
              isFlashHighlight && 'rounded-lg ring-2 ring-primary/40 ring-offset-2'
            )}
          >
            <MarkdownErrorBoundary fallbackContent={truncatedContent}>
              <MarkdownRenderer
                content={truncatedContent}
                fullSource={displayContent}
                onOpenCanvas={onOpenCanvas}
              />
            </MarkdownErrorBoundary>
            {isLongContent && !message.isStreaming && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setIsContentExpanded(!isContentExpanded)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {isContentExpanded
                    ? t('chatPage.messageBubble.showLess')
                    : t('chatPage.messageBubble.showMore')}
                </button>
              </div>
            )}
            {/* Streaming cursor — positioned after last paragraph's text direction */}
            {message.isStreaming && showAnswerBody && (
              <span
                className="ms-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary/60 align-text-bottom"
                dir={getLastParagraphDirection(deferredContent) === 'rtl' ? 'rtl' : undefined}
              />
            )}
          </div>
        )}

        {/* Generating answer — visible during thinking/tools before answer body */}
        {message.isStreaming && !showAnswerBody && hasThoughtProcessVisible && (
          <p className="py-1 text-xs text-gray-500 dark:text-gray-400">
            {t('chatPage.generatingAnswer')}
          </p>
        )}

        {/* Loading state — streaming but answer body not ready yet (tools/thinking in Thought Process) */}
        {message.isStreaming && !showAnswerBody && !hasThoughtProcessVisible && (
          <div className="flex items-center gap-1.5 py-2">
            <span className="animate-chat-dot-wave h-2 w-2 rounded-full bg-primary/60" style={{ animationDelay: '0ms' }} />
            <span className="animate-chat-dot-wave h-2 w-2 rounded-full bg-primary/60" style={{ animationDelay: '150ms' }} />
            <span className="animate-chat-dot-wave h-2 w-2 rounded-full bg-primary/60" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && !message.isStreaming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion.text)}
                className="rounded-full border border-muted bg-gray-0 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:bg-gray-100 dark:text-gray-400 dark:hover:text-primary"
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        )}

        {/* Action bar — copy, feedback */}
        {isAssistant && !message.isStreaming && displayContent && (
          <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 [.flex:hover_&]:opacity-100">
            <Tooltip content={t('chatPage.referenceFloatTitle')} placement="top">
              <button
                type="button"
                onClick={() => setReferenceOpen(true)}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100"
                aria-label={t('chatPage.referenceFloatTitle')}
              >
                <PiBrowsers className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            {/* Copy */}
            <Tooltip
              content={
                copied
                  ? t('chatPage.messageBubble.copied')
                  : t('chatPage.messageBubble.copy')
              }
              placement="top"
            >
              <button
                onClick={handleCopy}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100"
                aria-label={
                  copied
                    ? t('chatPage.messageBubble.copied')
                    : t('chatPage.messageBubble.copyMessage')
                }
              >
                {copied ? (
                  <PiCheck className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <PiCopySimple className="h-3.5 w-3.5" />
                )}
              </button>
            </Tooltip>

            {onFork && (
              <Tooltip content={t('chatPage.fork.action')} placement="top">
                <button
                  type="button"
                  onClick={() => onFork(message.id)}
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100"
                  aria-label={t('chatPage.fork.action')}
                >
                  <PiArrowBendDownRight className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}

            {/* Like */}
            <Tooltip content={t('chatPage.messageBubble.like')} placement="top">
              <button
                onClick={() =>
                  onFeedback(
                    message.id,
                    message.feedback === 'like' ? null : 'like'
                  )
                }
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100"
                aria-label={t('chatPage.messageBubble.likeResponse')}
              >
                {message.feedback === 'like' ? (
                  <PiThumbsUpFill className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <PiThumbsUp className="h-3.5 w-3.5" />
                )}
              </button>
            </Tooltip>

            {/* Dislike */}
            <Tooltip content={t('chatPage.messageBubble.dislike')} placement="top">
              <button
                onClick={() =>
                  onFeedback(
                    message.id,
                    message.feedback === 'dislike' ? null : 'dislike'
                  )
                }
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100"
                aria-label={t('chatPage.messageBubble.dislikeResponse')}
              >
                {message.feedback === 'dislike' ? (
                  <PiThumbsDownFill className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <PiThumbsDown className="h-3.5 w-3.5" />
                )}
              </button>
            </Tooltip>

            {/* Resend */}
            {onResend && (
              <Tooltip content={t('chatPage.messageBubble.resend')} placement="top">
                <button
                  onClick={onResend}
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100"
                  aria-label={t('chatPage.messageBubble.resendMessage')}
                >
                  <PiArrowClockwise className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}

            {/* Token/time info */}
            {(message.processing_time != null ||
              message.total_tokens != null ||
              message.tool_runs?.length ||
              message.tools_used?.length ||
              message.created_at) && (
              <div className="ms-2 flex items-center gap-2 text-xs text-gray-400">
                {/* Processing time */}
                {message.processing_time != null && (
                  <span
                    className="flex items-center gap-0.5"
                    title={t('chatPage.messageBubble.processingTime')}
                  >
                    <PiLightning className="h-2.5 w-2.5" />
                    {message.processing_time.toFixed(1)}s
                  </span>
                )}
                {/* Token count */}
                {message.total_tokens != null && (
                  <span title={t('chatPage.messageBubble.totalTokens')}>
                    {message.total_tokens} tokens
                  </span>
                )}
                {/* Tool calls count — detailed tool_runs available */}
                {message.tool_runs && message.tool_runs.length > 0 && (
                  <button
                    onClick={() => onToggleThinking(message.id)}
                    className="flex items-center gap-0.5 transition-colors hover:text-primary"
                    title={`Tools: ${message.tool_runs.map((t) => t.tool_id).join(', ')}`}
                  >
                    <PiGear className="h-2.5 w-2.5" />
                    {message.tool_runs.length} tool{message.tool_runs.length > 1 ? 's' : ''}
                  </button>
                )}
                {/* Fallback: tools_used (name list) when tool_runs is not persisted */}
                {!message.tool_runs?.length && message.tools_used && message.tools_used.length > 0 && (
                  <span
                    className="flex items-center gap-0.5"
                    title={`Tools used: ${message.tools_used.join(', ')}`}
                  >
                    <PiGear className="h-2.5 w-2.5" />
                    {message.tools_used.length} tool{message.tools_used.length > 1 ? 's' : ''}
                  </span>
                )}
                {/* Timestamp */}
                {message.created_at && (
                  <span className="flex items-center gap-0.5" title={new Date(message.created_at).toLocaleString()}>
                    <PiClock className="h-2.5 w-2.5" />
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Inline file preview — ThinkingSteps-style collapsible box */}
      {previewFile && (
        <FilePreviewInline
          src={previewFile.src}
          name={previewFile.name}
          mimeType={previewFile.mimeType}
          fileSize={previewFile.fileSize}
          localPreviewUrl={previewFile.localPreviewUrl}
          artifactId={previewFile.artifactId}
          onClose={() => setPreviewFile(null)}
        />
      )}
      {referenceOpen && displayContent && (
        <AssistantReferenceFloat
          content={displayContent}
          title={t('chatPage.referenceFloatTitle')}
          messageId={message.id}
          onClose={() => setReferenceOpen(false)}
          onOpenCanvas={onOpenCanvas}
        />
      )}
    </>
  );
}
