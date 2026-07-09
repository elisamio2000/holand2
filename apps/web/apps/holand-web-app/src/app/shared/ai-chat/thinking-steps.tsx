// ============================================
// ThinkingSteps — AI Reasoning Timeline Component
// Displays the AI's step-by-step reasoning process as an
// interactive vertical timeline: thinking → tool → answer.
// Supports per-message Summary/Detailed view toggle.
//
// Information model (Copilot/v0-style): Summary = stable milestones + state
// via icon/color (no duplicate “status paragraphs”). Detailed = full timeline
// + plan task checklist + nested tool rows; transient progress updates the
// plan row in-place (fed by useChat) instead of spamming new lines.
// ============================================

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCaretDown,
  PiBrain,
  PiWrench,
  PiSpinner,
  PiListBullets,
  PiArticle,
  PiCheckCircle,
  PiXCircle,
  PiFileText,
  PiLightningBold,
  PiArrowRight,
  PiClockCountdown,
  PiCaretRight,
  PiGitBranch,
  PiListChecks,
  PiShieldCheck,
  PiArrowCircleRight,
  PiWarning,
  PiTarget,
  PiCircle,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import ToolRunItem from './tool-run-item';
import TracePanel from './trace-panel';
import type { ToolRunInfo, ThinkingStep, ExecutionPlan, CriticEvaluation } from '@/types/chat.types';
import { buildStepsFromHistory } from '@/hooks/use-chat';
import { debugLog } from '@/utils/debug-logger';

// ==========================================
// Utility helpers
// ==========================================

/**
 * Extracts a concise summary from thinking text.
 * Takes the first 2-3 meaningful sentences.
 *
 * @param text - Full thinking content
 * @returns Shortened summary string
 */
function summarizeThinking(text: string): string {
  if (!text) return '';
  const sentences = text
    .split(/(?<=[.!?؟۔])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (sentences.length === 0) return text.slice(0, 150);
  const summary = sentences.slice(0, 2).join(' ');
  return summary.length > 200 ? summary.slice(0, 200) + '…' : summary;
}

/**
 * Formats a tool_id to a human-readable label.
 * e.g. "search_documents" → "Search Documents"
 */
function formatToolLabel(toolId: string): string {
  return toolId
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the appropriate icon for a step type.
 */
function getStepIcon(step: ThinkingStep, isActive: boolean): React.ReactNode {
  if (step.type === 'thinking') {
    return (
      <PiBrain
        className={cn(
          'h-3.5 w-3.5',
          isActive
            ? 'animate-pulse text-primary'
            : 'text-gray-400 dark:text-gray-500'
        )}
      />
    );
  }
  if (step.type === 'tool') {
    if (isActive) {
      return <PiSpinner className="h-3.5 w-3.5 animate-spin text-primary" />;
    }
    const status = step.tool?.status;
    if (status === 'error') {
      return <PiXCircle className="h-3.5 w-3.5 text-red-500" />;
    }
    return (
      <PiWrench className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
    );
  }
  if (step.type === 'answer') {
    return isActive ? (
      <PiSpinner className="h-3.5 w-3.5 animate-spin text-primary" />
    ) : (
      <PiFileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
    );
  }
  // ── Orchestrator step types ──
  if (step.type === 'node') {
    return (
      <PiGitBranch
        className={cn(
          'h-3.5 w-3.5',
          isActive ? 'animate-pulse text-violet-500' : 'text-violet-400 dark:text-violet-300'
        )}
      />
    );
  }
  if (step.type === 'plan') {
    return <PiListChecks className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />;
  }
  if (step.type === 'evaluation') {
    const needsReplan = step.evaluation?.needs_replan;
    if (needsReplan) {
      return <PiWarning className="h-3.5 w-3.5 text-orange-500" />;
    }
    return <PiShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />;
  }
  if (step.type === 'progress') {
    return isActive ? (
      <PiSpinner className="h-3.5 w-3.5 animate-spin text-primary" />
    ) : (
      <PiArrowCircleRight className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
    );
  }
  return <PiLightningBold className="h-3.5 w-3.5 text-gray-400" />;
}

/**
 * Returns a human-readable label for a step.
 * Accepts `t` from useTranslation to produce translated labels.
 */
function getStepLabel(step: ThinkingStep, t: (key: string) => string): string {
  if (step.type === 'thinking')
    return step.isActive ? t('thinkingSteps.thinkingActive') : t('thinkingSteps.thinkingDone');
  if (step.type === 'tool')
    return formatToolLabel(step.tool?.tool_id ?? 'Tool');
  if (step.type === 'answer')
    return step.isActive ? t('thinkingSteps.answerActive') : t('thinkingSteps.answerDone');
  // ── Orchestrator step types ──
  if (step.type === 'node')
    return formatToolLabel(step.nodeName ?? 'Node');
  if (step.type === 'plan')
    return t('thinkingSteps.planLabel');
  if (step.type === 'evaluation') {
    const needsReplan = step.evaluation?.needs_replan;
    if (needsReplan) return t('thinkingSteps.evaluationRejected');
    return t('thinkingSteps.evaluationApproved');
  }
  if (step.type === 'progress') {
    // WHY: Use a short label for title, not the full message
    // The full message is in progressData and shown in the expandable section
    const state = step.progressData?.state;
    if (state === 'completed') return t('thinkingSteps.progressCompleted');
    if (state === 'failed') return t('thinkingSteps.progressFailed');
    if (state === 'running') return t('thinkingSteps.progressRunning');
    return t('thinkingSteps.progressLabel');
  }
  return t('thinkingSteps.stepFallback');
}

// ==========================================
// Component Props
// ==========================================

interface ThinkingStepsProps {
  /** Thinking text content (full accumulated text) */
  content: string;
  /** Whether the section is expanded */
  isExpanded: boolean;
  /** Toggle expansion callback */
  onToggle: () => void;
  /** Whether content is still streaming */
  isStreaming?: boolean;
  /** Number of processing steps (from backend done event) */
  steps?: number;
  /** Duration of thinking phase in seconds */
  thinkingDuration?: number;
  /** Tool runs (finalized or streaming) */
  toolRuns?: ToolRunInfo[];
  /** Name of the tool currently executing (streaming only) */
  activeToolName?: string | null;
  /**
   * Finalized reasoning timeline (after streaming or from history).
   * Built by use-chat during streaming and finalized on done.
   */
  thinkingSteps?: ThinkingStep[];
  /**
   * Live reasoning timeline steps (during streaming).
   * Updated in real-time as SSE events arrive.
   */
  streamSteps?: ThinkingStep[];
  /**
   * Structured reasoning segments from backend's `reasoning` array.
   * Each element = a thinking phase text. Used by buildStepsFromHistory
   * to interleave thinking with tool_runs for accurate timeline reconstruction.
   */
  reasoningSegments?: string[];
  /**
   * Trace ID for agent planning & execution timeline.
   * When provided (and not streaming), renders TracePanel inside the expandable area.
   */
  traceId?: string | null;
  /** True while lazy-loading trace steps on expand */
  isLoadingTrace?: boolean;
}

/**
 * ThinkingSteps — Displays AI's step-by-step reasoning timeline.
 *
 * Features:
 * - Collapsible panel with smooth animation
 * - Per-message Summary/Detailed toggle
 * - Summary mode: compact horizontal flow of step badges
 * - Detailed mode: vertical timeline with expandable thinking + tool details
 * - Real-time step progression during streaming
 * - Automatic fallback to legacy view when no steps data available
 *
 * @requires ToolRunItem — for rendering individual tool executions in detailed mode
 * @requires ThinkingStep — from chat.types, the step data structure
 * @requires buildStepsFromHistory — from use-chat, reconstructs steps from history
 *
 * @example
 * ```tsx
 * <ThinkingSteps
 *   content={message.thinking}
 *   isExpanded={message.thinkingExpanded}
 *   onToggle={() => toggleThinking(message.id)}
 *   isStreaming={message.isStreaming}
 *   thinkingSteps={message.thinkingSteps}
 *   streamSteps={message.streamSteps}
 *   toolRuns={message.tool_runs}
 * />
 * ```
 */
export default function ThinkingSteps({
  content,
  isExpanded,
  onToggle,
  isStreaming = false,
  steps,
  thinkingDuration,
  toolRuns,
  activeToolName,
  thinkingSteps,
  streamSteps,
  reasoningSegments,
  traceId,
  isLoadingTrace = false,
}: ThinkingStepsProps) {
  // Per-message view toggle: summary (false) vs detailed (true)
  const [isDetailedMode, setIsDetailedMode] = useState(false);
  const { t } = useTranslation();

  // ── Resolve which steps to display ──
  // Priority: streamSteps (live) > thinkingSteps (finalized) > buildFromHistory
  // WHY: Steps from backend might be empty/invalid. We validate that at least some
  // steps have meaningful content before using them, otherwise fall back to reconstruction.
  const displaySteps = useMemo(() => {
    let source = 'none';
    let steps: ThinkingStep[] = [];

    /**
     * Checks if a steps array has meaningful data (not just empty shells).
     * A valid step should have either content, tool, plan, or evaluation data.
     */
    const hasValidSteps = (stepsArray: ThinkingStep[] | undefined): boolean => {
      if (!stepsArray || stepsArray.length === 0) return false;
      // At least one step should have meaningful content
      return stepsArray.some((s) => {
        if (s.type === 'thinking' && s.content && s.content.length > 10) return true;
        if (s.type === 'tool' && s.tool) return true;
        if (s.type === 'plan' && s.plan) return true;
        if (s.type === 'evaluation' && s.evaluation) return true;
        if (s.type === 'answer' && s.content) return true;
        // Node and progress steps might have minimal content, check length
        if ((s.type === 'node' || s.type === 'progress') && s.content && s.content.length > 3) return true;
        return false;
      });
    };

    if (isStreaming && streamSteps && streamSteps.length > 0) {
      source = 'streamSteps (live)';
      steps = streamSteps;
    } else if (hasValidSteps(thinkingSteps)) {
      source = 'thinkingSteps (finalized)';
      steps = thinkingSteps!;
    } else if (content || (toolRuns && toolRuns.length > 0)) {
      source = 'buildFromHistory (reconstructed)';
      steps = buildStepsFromHistory(content || null, toolRuns, reasoningSegments);
    } else if (thinkingSteps && thinkingSteps.length > 0) {
      // WHY: Fallback to thinkingSteps even if content is sparse (orchestrator steps
      // from backend might only have type info but TracePanel will fetch full details).
      source = 'thinkingSteps (sparse fallback)';
      steps = thinkingSteps;
    }

    debugLog.thinking('ThinkingSteps displaySteps resolved', {
      source,
      stepCount: steps.length,
      isStreaming,
      hasStreamSteps: !!(streamSteps && streamSteps.length > 0),
      hasThinkingSteps: !!(thinkingSteps && thinkingSteps.length > 0),
      hasContent: !!content,
      hasToolRuns: !!(toolRuns && toolRuns.length > 0),
      toolRunsCount: toolRuns?.length ?? 0,
      stepsBreakdown: steps.map((s) => ({
        type: s.type,
        isActive: s.isActive,
        stepNumber: s.stepNumber,
        contentLength: typeof s.content === 'string' ? s.content.length : 0,
      })),
    });

    return steps;
  }, [isStreaming, streamSteps, thinkingSteps, content, toolRuns, reasoningSegments]);

  const hasThinking = !!(content || isStreaming);
  const hasTools = !!(toolRuns && toolRuns.length > 0);
  const isToolRunning = !!activeToolName;
  const hasSteps = displaySteps.length > 0;

  if (!hasThinking && !hasTools && !isToolRunning && !hasSteps) return null;

  const totalToolCount = toolRuns?.length ?? 0;
  const toolStepCount = displaySteps.filter((s) => s.type === 'tool').length;

  // During streaming, always show detailed view
  const showDetailed = isStreaming || isDetailedMode;

  return (
    <div className="mb-2">
      {/* ── Header toggle button ── */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-100 dark:hover:text-gray-300"
        aria-expanded={isExpanded}
        aria-controls="thinking-content"
      >
        <PiBrain
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0',
            isStreaming && 'animate-chat-glow text-primary'
          )}
        />
        <span>{isStreaming ? t('thinkingSteps.headerStreaming') : t('thinkingSteps.headerDone')}</span>

        {/* Steps count badge */}
        {displaySteps.length > 0 && !isStreaming && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-50">
            {displaySteps.length} {t('thinkingSteps.stepsBadge')}
          </span>
        )}

        {/* Thinking duration badge */}
        {thinkingDuration != null && !isStreaming && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
            {thinkingDuration.toFixed(1)}s
          </span>
        )}

        {/* Tool count badge */}
        {(toolStepCount > 0 || totalToolCount > 0) && !isToolRunning && (
          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-50">
            <PiWrench className="h-2.5 w-2.5" />
            {toolStepCount || totalToolCount} {(toolStepCount || totalToolCount) > 1 ? t('thinkingSteps.toolPlural') : t('thinkingSteps.toolSingular')}
          </span>
        )}

        {/* Active tool running badge */}
        {isToolRunning && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
            <PiSpinner className="h-2.5 w-2.5 animate-spin" />
            {t('thinkingSteps.runningTool', { toolName: activeToolName })}
          </span>
        )}

        <PiCaretDown
          className={cn(
            'ms-auto h-3 w-3 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* ── Expandable content ── */}
      <div
        id="thinking-content"
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="mt-1 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 dark:border-gray-200/30 dark:bg-gray-100/30">
          {isLoadingTrace && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
              <PiSpinner className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>{t('thinkingSteps.loadingTrace')}</span>
            </div>
          )}

          {/* ── Summary / Detailed toggle — only after streaming is done ── */}
          {!isLoadingTrace && !isStreaming && hasSteps && (
            <div className="flex items-center justify-end gap-1 px-3 pt-2">
              <button
                onClick={() => setIsDetailedMode(false)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  !showDetailed
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                )}
                title={t('thinkingSteps.viewSummaryTitle')}
              >
                <PiArticle className="h-3 w-3" />
                {t('thinkingSteps.viewSummary')}
              </button>
              <button
                onClick={() => setIsDetailedMode(true)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  showDetailed
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                )}
                title={t('thinkingSteps.viewDetailedTitle')}
              >
                <PiListBullets className="h-3 w-3" />
                {t('thinkingSteps.viewDetailed')}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════ */}
          {/* ── SUMMARY VIEW — compact horizontal flow ── */}
          {/* ══════════════════════════════════════════════ */}
          {!showDetailed && !isStreaming && hasSteps && (
            <SummaryView
              steps={displaySteps}
              thinkingDuration={thinkingDuration}
              thinkingContent={content}
            />
          )}

          {/* ══════════════════════════════════════════════ */}
          {/* ── DETAILED VIEW — vertical timeline ──       */}
          {/* ══════════════════════════════════════════════ */}
          {showDetailed && hasSteps && (
            <DetailedView
              steps={displaySteps}
              isStreaming={isStreaming}
              content={content}
            />
          )}

          {/* ── Fallback: no steps but has content (legacy compat) ── */}
          {!hasSteps && hasThinking && (
            <div className="max-h-[300px] overflow-y-auto p-3">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {content}
                {isStreaming && (
                  <span className="inline-block h-3 w-1.5 animate-pulse bg-primary/60" />
                )}
              </pre>
            </div>
          )}

          {/* ── Agent Trace — inside collapsible area ── */}
          {traceId && !isStreaming && (
            <div className="border-t border-dashed border-gray-200 dark:border-gray-200/30">
              <TracePanel traceId={traceId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SummaryView — compact horizontal step flow
// ==========================================

/**
 * SummaryView — Renders a compact horizontal flow of step badges.
 *
 * Shows the reasoning timeline as a series of connected badges:
 * 🧠 Analyzed → 🔧 Search Documents ✅ → 🧠 Analyzed → 📝 Answer
 *
 * @param steps - Finalized ThinkingStep array
 * @param thinkingDuration - Optional thinking duration in seconds
 */
/**
 * SummaryView — Shows a concise text-based summary of what the AI did.
 *
 * Replaces the old badge/pill grid with a clean prose summary:
 * - One line per major orchestrator node (node, plan, evaluation, answer)
 * - Tool calls aggregated as a single count line
 * - Thinking summary as an italic excerpt
 *
 * Design: same colors/icons as timeline, but compact single-line rows
 * without collapsible detail — that's what Detailed view is for.
 */
function SummaryView({
  steps,
  thinkingDuration,
  thinkingContent,
}: {
  steps: ThinkingStep[];
  thinkingDuration?: number;
  thinkingContent?: string;
}) {
  const { t } = useTranslation();

  // ── Build summary lines from steps ──
  // Only keep "landmark" steps: node, plan, evaluation, answer.
  // Tool calls are aggregated into a count. Thinking condensed to one excerpt.
  const nodeSteps = steps.filter((s) => s.type === 'node');
  const toolSteps = steps.filter((s) => s.type === 'tool');
  const failedTools = toolSteps.filter((s) => s.tool?.status === 'error');
  const planStep = steps.find((s) => s.type === 'plan');
  const evalStep = steps.find((s) => s.type === 'evaluation');
  const hasAnswer = steps.some((s) => s.type === 'answer');

  const lastThinkingStep = [...steps].reverse().find((s) => s.type === 'thinking' && s.content);
  const excerpt = lastThinkingStep
    ? summarizeThinking(lastThinkingStep.content)
    : thinkingContent
      ? summarizeThinking(thinkingContent)
      : '';

  // Helper: status icon for a completed step
  const DoneIcon = () => <PiCheckCircle className="h-3 w-3 flex-shrink-0 text-green-500 dark:text-green-400" />;

  const hasMilestones =
    nodeSteps.length > 0 ||
    !!planStep ||
    toolSteps.length > 0 ||
    !!evalStep ||
    hasAnswer;

  return (
    <div className="p-3 space-y-1.5">
      {/* Thinking excerpt — narrative layer (Copilot-style “context” line) */}
      {excerpt && (
        <p className="text-xs leading-relaxed text-gray-500 italic dark:text-gray-400 border-s-2 border-primary/30 ps-2">
          {excerpt}
        </p>
      )}

      {/* Milestones — single vertical spine; state = icon + weight, not repeated labels */}
      {hasMilestones && (
        <div className="space-y-1 border-s-2 border-gray-200 ps-3 dark:border-gray-600/80">
          {nodeSteps.map((step) => (
            <div key={step.stepNumber} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <DoneIcon />
              <span className="font-medium">{getStepLabel(step, t)}</span>
            </div>
          ))}

          {planStep && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <DoneIcon />
              <span className="font-medium">{getStepLabel(planStep, t)}</span>
              {planStep.plan?.tasks?.length ? (
                <span className="text-gray-400 dark:text-gray-500">
                  — {planStep.plan.tasks.length} {t('thinkingSteps.stepsBadge')}
                </span>
              ) : null}
            </div>
          )}

          {toolSteps.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              {failedTools.length > 0 ? (
                <PiXCircle className="h-3 w-3 flex-shrink-0 text-red-500" />
              ) : (
                <DoneIcon />
              )}
              <span>
                {toolSteps.length}{' '}
                {toolSteps.length > 1 ? t('thinkingSteps.toolPlural') : t('thinkingSteps.toolSingular')}
                {failedTools.length > 0 && (
                  <span className="ms-1 text-red-500">
                    ({failedTools.length} {t('thinkingSteps.statusFailed')})
                  </span>
                )}
              </span>
              {thinkingDuration != null && (
                <span className="text-gray-400 dark:text-gray-500">· {thinkingDuration.toFixed(1)}s</span>
              )}
            </div>
          )}

          {evalStep && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              {evalStep.evaluation?.needs_replan ? (
                <PiWarning className="h-3 w-3 flex-shrink-0 text-orange-500" />
              ) : (
                <PiShieldCheck className="h-3 w-3 flex-shrink-0 text-emerald-500" />
              )}
              <span className="font-medium">{getStepLabel(evalStep, t)}</span>
              {(evalStep.confidence ?? evalStep.evaluation?.overall_confidence) != null && (
                <span className="text-gray-400 dark:text-gray-500">
                  · {(((evalStep.confidence ?? evalStep.evaluation?.overall_confidence) as number) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          )}

          {hasAnswer && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <PiFileText className="h-3 w-3 flex-shrink-0 text-blue-500" />
              <span className="font-medium">{t('thinkingSteps.answerDone')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// DetailedView — vertical timeline
// ==========================================

/**
 * DetailedView — Renders a full vertical timeline of reasoning steps.
 *
 * Shows each step with:
 * - Step number + icon on a vertical line
 * - Step type label + status
 * - Expandable content (thinking text, tool args/result)
 *
 * @param steps - ThinkingStep array (live or finalized)
 * @param isStreaming - Whether the message is still streaming
 * @param content - Full thinking text (for live display of active thinking step)
 */
function DetailedView({
  steps,
  isStreaming,
  content,
}: {
  steps: ThinkingStep[];
  isStreaming: boolean;
  content: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps arrive during streaming
  // so the user always sees the latest step without manual scrolling.
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length, isStreaming]);

  // Extract progress from latest plan step for bottom progress bar
  const latestPlan = [...steps].reverse().find((s) => s.type === 'plan' && s.tasks);
  const planTasks = latestPlan?.tasks ?? [];
  const completedCount = planTasks.filter((t) => t.state === 'completed' || t.state === 'failed').length;
  const total = latestPlan?.totalTaskCount ?? planTasks.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const showProgress = total > 1 && latestPlan != null;

  return (
    <div className="relative flex flex-col">
      <div
        ref={scrollRef}
        className={cn(
          'p-3',
          // Internal scroll: limit height when many steps accumulate,
          // so the thinking box doesn't push chat content out of view.
          // Scrollbar is styled inline to match the design system without plugins.
          'max-h-[680px] overflow-y-auto',
          // Styled scrollbar — webkit (Chrome/Safari/Edge) and Firefox
          '[&::-webkit-scrollbar]:w-1.5',
          '[&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200/80',
          'dark:[&::-webkit-scrollbar-thumb]:bg-gray-700/60',
          '[&::-webkit-scrollbar-thumb:hover]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb:hover]:bg-gray-600',
          'scroll-smooth'
        )}
      >
        <div className="relative">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <TimelineStep
                key={step.stepNumber}
                step={step}
                isLast={isLast}
                isStreaming={isStreaming}
                fullThinkingContent={content}
              />
            );
          })}
        </div>
      </div>

      {/* ── Bottom progress bar (sticky) ── */}
      {showProgress && (
        <div className="border-t border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
            <span>
              {completedCount}/{total} tasks
            </span>
            <span className={cn(
              'font-medium tabular-nums',
              pct === 100
                ? 'text-emerald-500'
                : isStreaming
                  ? 'text-sky-500'
                  : 'text-gray-400'
            )}>
              {pct}%
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/50">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                pct === 100
                  ? 'bg-emerald-500'
                  : 'bg-primary'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// TimelineStep — individual step in timeline
// ==========================================

/**
 * TimelineStep — Renders a single step in the vertical timeline.
 *
 * Layout:
 * ```
 * ┃  🧠  Analyzing...
 * ┃      [expandable thinking text]
 * ┃
 * ```
 *
 * @param step - The ThinkingStep data
 * @param isLast - Whether this is the last step (no trailing line)
 * @param isStreaming - Whether the parent message is still streaming
 * @param fullThinkingContent - Full thinking text for showing live content
 */
function TimelineStep({
  step,
  isLast,
  isStreaming,
  fullThinkingContent,
}: {
  step: ThinkingStep;
  isLast: boolean;
  isStreaming: boolean;
  fullThinkingContent: string;
}) {
  const { t } = useTranslation();
  const isActive = step.isActive && isStreaming;

  // Plan steps with tasks use the TaskListView pattern (auto-expand during streaming)
  const hasPlanTasks = step.type === 'plan' && (step.tasks?.length ?? 0) > 0;
  // Tool sub-events (tool_start/tool_end) only — for legacy node display
  const hasToolSubEvents = step.type === 'node' && (step.subEvents?.filter(s => s.type === 'tool_start' || s.type === 'tool_end').length ?? 0) > 0;

  const [isExpanded, setIsExpanded] = useState(false);
  const showExpanded = (isActive && (hasPlanTasks || hasToolSubEvents)) || isExpanded;

  // For thinking steps: show live content if active, otherwise step.content
  const thinkingText =
    step.type === 'thinking'
      ? isActive
        ? step.content || fullThinkingContent
        : step.content
      : '';

  const hasExpandableContent =
    (step.type === 'thinking' && thinkingText.length > 0) ||
    (step.type === 'tool' && step.tool != null) ||
    (step.type === 'plan' && step.plan != null) ||
    (step.type === 'evaluation' && step.evaluation != null) ||
    (step.type === 'progress' && step.progressData != null);

  // Auto-expand active steps during streaming (excludes node — node is always compact 1-line)
  const showContent = (isActive && step.type !== 'node' && step.type !== 'plan') || (step.type !== 'node' && step.type !== 'plan' && (isActive || (hasExpandableContent && isExpanded)));

  return (
    <div className="relative flex gap-3">
      {/* ── Vertical timeline line ── */}
      {!isLast && (
        <div
          className={cn(
            'absolute start-[11px] top-6 w-px',
            isActive
              ? 'bg-gradient-to-b from-primary/40 to-primary/10'
              : 'bg-gray-200 dark:bg-gray-200/30'
          )}
          style={{ bottom: 0 }}
        />
      )}

      {/* ── Step icon node ── */}
      <div
        className={cn(
          'relative z-10 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border',
          isActive
            ? 'border-primary/30 bg-primary/10'
            : step.type === 'tool'
              ? step.tool?.status === 'error'
                ? 'border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/20'
                : 'border-green-200 bg-green-50 dark:border-green-800/30 dark:bg-green-900/20'
              : step.type === 'answer'
                ? 'border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/20'
                : step.type === 'node'
                  ? 'border-violet-200 bg-violet-50 dark:border-violet-800/30 dark:bg-violet-900/20'
                  : step.type === 'plan'
                    ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800/30 dark:bg-indigo-900/20'
                    : step.type === 'evaluation'
                      ? step.evaluation?.needs_replan
                        ? 'border-orange-200 bg-orange-50 dark:border-orange-800/30 dark:bg-orange-900/20'
                        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/30 dark:bg-emerald-900/20'
                      : step.type === 'progress'
                        ? 'border-sky-200 bg-sky-50 dark:border-sky-800/30 dark:bg-sky-900/20'
                        : 'border-gray-200 bg-gray-50 dark:border-gray-200/30 dark:bg-gray-100/50'
        )}
      >
        {getStepIcon(step, isActive)}
      </div>

      {/* ── Step content ── */}
      <div className={cn('flex-1 pb-3', isLast && 'pb-0')}>
        {/* Step header — label + metadata */}
        <button
          onClick={() =>
            hasExpandableContent &&
            setIsExpanded(!isExpanded)
          }
          className={cn(
            'flex w-full items-center gap-1.5 text-start text-xs',
            hasExpandableContent && 'cursor-pointer',
            !hasExpandableContent && 'cursor-default'
          )}
          disabled={!hasExpandableContent}
        >
          <span
            className={cn(
              'font-medium',
              isActive
                ? 'text-primary'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {getStepLabel(step, t)}
          </span>

          {/* Active indicator dot */}
          {isActive && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          )}

          {/* Tool status badge */}
          {step.type === 'tool' && !isActive && step.tool && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                step.tool.status === 'error'
                  ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
              )}
            >
              {step.tool.status === 'error' ? t('thinkingSteps.statusFailed') : t('thinkingSteps.statusDone')}
            </span>
          )}

          {/* Tool execution time */}
          {step.type === 'tool' && step.tool?.execution_time != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500">
              <PiClockCountdown className="h-2.5 w-2.5" />
              {step.tool.execution_time.toFixed(1)}s
            </span>
          )}

          {/* Plan task count badge */}
          {step.type === 'plan' && hasPlanTasks && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
              isActive
                ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
            )}>
              {step.tasks!.filter(t => t.state === 'completed' || t.state === 'failed').length}/{step.tasks!.length}
            </span>
          )}

          {/* Tool sub-event count for node */}
          {step.type === 'node' && hasToolSubEvents && (
            <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
              {step.subEvents!.filter(s => s.type === 'tool_start' || s.type === 'tool_end').length}
            </span>
          )}

          {/* Expand indicator */}
          {hasExpandableContent && (
            <PiCaretRight
              className={cn(
                'ms-auto h-2.5 w-2.5 text-gray-300 transition-transform duration-200 dark:text-gray-600',
                (showExpanded || (!isActive && isExpanded)) && 'rotate-90'
              )}
            />
          )}
        </button>

        {/* ── NODE: Compact 1-line — sub-events only when expanded ── */}
        {/* WHY: Plan-Centric design — node rows are now status indicators only.
             Tasks live in the plan step below. Tool sub-events still expand. */}
        {step.type === 'node' && hasToolSubEvents && (
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-in-out',
              isExpanded ? 'mt-1 max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="rounded-md border border-violet-200/50 bg-violet-50/20 dark:border-violet-800/20 dark:bg-violet-900/10">
              <div className="p-1.5 space-y-0.5">
                {step.subEvents!
                  .filter(s => s.type === 'tool_start' || s.type === 'tool_end')
                  .map((sub, subIdx) => (
                    <SubEventRow key={subIdx} subEvent={sub} />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PLAN: Task-list card ── */}
        {step.type === 'plan' && hasPlanTasks && (
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-in-out',
              showExpanded || isExpanded
                ? 'mt-1.5 max-h-[800px] opacity-100'
                : 'max-h-0 opacity-0'
            )}
          >
            <div className="rounded-md border border-indigo-200/50 bg-indigo-50/20 dark:border-indigo-800/20 dark:bg-indigo-900/10">
              {/* Plan strategy header */}
              {step.plan?.complexity && (
                <div className="border-b border-indigo-200/30 px-2.5 py-1.5 dark:border-indigo-800/20">
                  <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400" dir="auto">
                    <span className="opacity-70">{t('thinkingSteps.planStrategy')}:</span>{' '}
                    {step.plan.complexity}
                  </p>
                </div>
              )}
              {/* Task checklist with progress bar */}
              <TaskListView
                tasks={step.tasks!}
                totalTaskCount={step.totalTaskCount}
                isActive={isActive}
              />
            </div>
          </div>
        )}

        {/* ── Other step types: existing expandable content ── */}
        {step.type !== 'node' && step.type !== 'plan' && (
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-in-out',
              showContent
                ? 'mt-1.5 max-h-[600px] opacity-100'
                : 'max-h-0 opacity-0'
            )}
          >
            {/* ── Thinking step content ── */}
            {step.type === 'thinking' && thinkingText && (
              <div className="max-h-[400px] overflow-y-auto rounded-md border border-gray-200/50 bg-white/50 p-2 dark:border-gray-200/20 dark:bg-gray-100/20">
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-500 dark:text-gray-400" dir="auto">
                  {thinkingText}
                  {isActive && (
                    <span className="inline-block h-3 w-1.5 animate-pulse bg-primary/60" />
                  )}
                </pre>
              </div>
            )}

            {/* ── Tool step content — uses ToolRunItem ── */}
            {step.type === 'tool' && step.tool && (
              <div className="rounded-md border border-gray-200/50 bg-white/50 dark:border-gray-200/20 dark:bg-gray-100/20">
                <ToolRunItem
                  tool={step.tool}
                  stepNumber={step.stepNumber}
                  isActive={isActive}
                />
              </div>
            )}

            {/* ── Evaluation step content — critic result ── */}
            {step.type === 'evaluation' && step.evaluation && (
              <EvaluationStepContent evaluation={step.evaluation} confidence={step.confidence} />
            )}

            {/* ── Progress step content ── */}
            {step.type === 'progress' && step.progressData && (
              <ProgressStepContent progressData={step.progressData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// TaskListView — todo-list checklist for node cards
// ==========================================

/**
 * TaskListView — Renders a progress-tracked task checklist inside a node card.
 *
 * Each task row changes state in-place: pending → running → completed/failed.
 * Shows an overall progress bar + percentage at the top.
 *
 * Design: same violet/green/sky color palette as the rest of the timeline.
 * No extra rows added — the same task description changes icon and color.
 */
function TaskListView({
  tasks,
  totalTaskCount,
  isActive,
}: {
  tasks: NonNullable<ThinkingStep['tasks']>;
  totalTaskCount?: number;
  isActive: boolean;
}) {
  return (
    <div className="p-2">
      {/* Task rows */}
      <div className="space-y-0.5">
        {tasks.map((task, idx) => {
          const isRunning = task.state === 'running';
          const isCompleted = task.state === 'completed';
          const isFailed = task.state === 'failed';
          const isPending = task.state === 'pending';

          return (
            <div
              key={idx}
              className="flex items-start gap-2 rounded px-1 py-1 text-[11px]"
            >
              {/* State icon — changes in-place */}
              <div className="mt-px flex-shrink-0">
                {isPending && (
                  <PiCircle className="h-3 w-3 text-gray-300 dark:text-gray-600" />
                )}
                {isRunning && (
                  <PiSpinner className="h-3 w-3 animate-spin text-sky-500" />
                )}
                {isCompleted && (
                  <PiCheckCircle className="h-3 w-3 text-emerald-500" />
                )}
                {isFailed && (
                  <PiXCircle className="h-3 w-3 text-red-500" />
                )}
              </div>

              {/* Task description — unchanged, only color changes */}
              <span
                className={cn(
                  'leading-relaxed',
                  isPending && 'text-gray-400 dark:text-gray-500',
                  isRunning && 'font-medium text-sky-600 dark:text-sky-400',
                  isCompleted && 'text-emerald-700 dark:text-emerald-400',
                  isFailed && 'text-red-600 dark:text-red-400'
                )}
                dir="auto"
              >
                {task.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// SubEventRow — single sub-event inside a node card
// ==========================================

/**
 * SubEventRow — Renders one sub-event (progress/tool call) inside a node card.
 *
 * Uses the same icon/color system as the parent timeline but at a smaller scale.
 * State transitions: running (spinner) → completed (checkmark) / failed (X)
 */
function SubEventRow({
  subEvent,
}: {
  subEvent: NonNullable<ThinkingStep['subEvents']>[number];
}) {
  const isRunning = subEvent.state === 'running';
  const isCompleted = subEvent.state === 'completed';
  const isFailed = subEvent.state === 'failed';

  const isTool = subEvent.type === 'tool_start' || subEvent.type === 'tool_end';

  return (
    <div className="flex items-start gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-violet-50/30 dark:hover:bg-violet-900/10">
      {/* State icon */}
      <div className="mt-px flex-shrink-0">
        {isRunning && (
          <PiSpinner className="h-3 w-3 animate-spin text-sky-500" />
        )}
        {isCompleted && (
          <PiCheckCircle className={cn('h-3 w-3', isTool ? 'text-green-500' : 'text-emerald-500')} />
        )}
        {isFailed && (
          <PiXCircle className="h-3 w-3 text-red-500" />
        )}
        {subEvent.state === 'pending' && (
          <PiClockCountdown className="h-3 w-3 text-gray-400" />
        )}
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            isRunning && 'text-sky-600 dark:text-sky-400',
            isCompleted && (isTool ? 'text-green-600 dark:text-green-400' : 'text-emerald-600 dark:text-emerald-400'),
            isFailed && 'text-red-600 dark:text-red-400',
            subEvent.state === 'pending' && 'text-gray-500 dark:text-gray-400'
          )}
          dir="auto"
        >
          {isTool ? (
            <span>
              <span className="font-medium">{subEvent.label}</span>
              {subEvent.tool?.tool_id && subEvent.tool.tool_id !== subEvent.label && (
                <span className="opacity-60"> · {subEvent.tool.tool_id}</span>
              )}
            </span>
          ) : (
            subEvent.label
          )}
        </span>

        {/* Progress bar */}
        {subEvent.progress != null && subEvent.progress > 0 && isRunning && (
          <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(subEvent.progress * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}


// ==========================================
// PlanStepContent — renders execution plan tasks
// ==========================================

/**
 * PlanStepContent — Renders an execution plan as a list of tasks with tools.
 *
 * @param plan - ExecutionPlan from orchestrator
 */
function PlanStepContent({ plan }: { plan: ExecutionPlan }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-indigo-200/50 bg-indigo-50/30 p-2 dark:border-indigo-800/20 dark:bg-indigo-900/10">
      {/* Complexity badge */}
      {plan.complexity && (
        <p className="mb-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400" dir="auto">
          <span className="opacity-70">{t('thinkingSteps.planStrategy')}:</span>{' '}
          {plan.complexity}
        </p>
      )}
      {/* Task list */}
      <div className="space-y-1">
        {plan.tasks?.map((task, idx) => (
          <div
            key={task.id || idx}
            className="flex items-start gap-1.5 text-[10px] text-indigo-700 dark:text-indigo-300"
          >
            <span className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-200/50 text-[8px] font-bold dark:bg-indigo-800/30">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed" dir="auto">{task.description}</p>
              {task.tool && (
                <span className="mt-0.5 inline-block rounded bg-indigo-100 px-1 py-px text-[9px] dark:bg-indigo-800/30">
                  {formatToolLabel(task.tool)}
                </span>
              )}
            </div>
          </div>
        ))}
        {(!plan.tasks || plan.tasks.length === 0) && (
          <p className="text-[11px] italic text-indigo-500/70 dark:text-indigo-400/70" dir="auto">
            {t('thinkingSteps.planPending', 'Planning in progress...')}
          </p>
        )}
      </div>
    </div>
  );
}

// ==========================================
// EvaluationStepContent — renders critic evaluation
// ==========================================

/**
 * EvaluationStepContent — Renders critic evaluation with score, feedback, and suggestions.
 *
 * @param evaluation - CriticEvaluation from orchestrator
 * @param confidence - Overall confidence score (0-1)
 */
function EvaluationStepContent({
  evaluation,
  confidence,
}: {
  evaluation: CriticEvaluation;
  confidence?: number;
}) {
  const { t } = useTranslation();
  const needsReplan = evaluation.needs_replan;
  // Use explicit prop first, then fall back to the field embedded in evaluation
  const displayConfidence = confidence ?? evaluation.overall_confidence;
  const borderCls = needsReplan
    ? 'border-orange-200/50 bg-orange-50/30 dark:border-orange-800/20 dark:bg-orange-900/10'
    : 'border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-800/20 dark:bg-emerald-900/10';
  const textCls = needsReplan
    ? 'text-orange-700 dark:text-orange-300'
    : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className={cn('rounded-md border p-2', borderCls)}>
      {/* Status + confidence */}
      <div className="flex items-center gap-2 text-[11px]">
        {displayConfidence != null && (
          <span className={cn('font-medium', textCls)}>
            {t('thinkingSteps.evalScore')}: {(displayConfidence * 100).toFixed(0)}%
          </span>
        )}
        {needsReplan ? (
          <PiWarning className="h-3 w-3 text-orange-500" />
        ) : (
          <PiCheckCircle className="h-3 w-3 text-emerald-500" />
        )}
      </div>

      {/* Task evaluations */}
      {evaluation.task_evaluations && evaluation.task_evaluations.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {evaluation.task_evaluations.map((te) => (
            <div key={te.task_id} className="flex items-start gap-1 text-[10px]">
              {te.success ? (
                <PiCheckCircle className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-emerald-500" />
              ) : (
                <PiXCircle className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-red-500" />
              )}
              <span className={textCls} dir="auto">{te.reasoning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Replan reason */}
      {evaluation.replan_reason && (
        <p className={cn('mt-1 text-[10px] leading-relaxed italic', textCls)} dir="auto">
          {evaluation.replan_reason}
        </p>
      )}

      {/* Gaps */}
      {evaluation.gaps_identified && evaluation.gaps_identified.length > 0 && (
        <div className="mt-1.5">
          <p className={cn('text-[9px] font-medium opacity-70', textCls)}>
            {t('thinkingSteps.evalSuggestions')}:
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {evaluation.gaps_identified.map((g, i) => (
              <li key={i} className={cn('text-[10px] leading-relaxed', textCls)} dir="auto">
                • {g}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ProgressStepContent — renders progress step detail
// ==========================================

/**
 * ProgressStepContent — Displays progress step details in expandable section.
 *
 * Shows the full message from backend (cleaned of emojis) with proper styling.
 * Different visual states for: running, completed, failed.
 *
 * @param progressData - Progress metadata from ThinkingStep
 */
function ProgressStepContent({
  progressData,
}: {
  progressData: NonNullable<ThinkingStep['progressData']>;
}) {
  const { t } = useTranslation();
  const state = progressData.state ?? 'running';
  
  // Border and background colors based on state
  const containerCls = cn(
    'rounded-md border p-2',
    state === 'completed' && 'border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-800/20 dark:bg-emerald-900/10',
    state === 'failed' && 'border-red-200/50 bg-red-50/30 dark:border-red-800/20 dark:bg-red-900/10',
    state === 'running' && 'border-sky-200/50 bg-sky-50/30 dark:border-sky-800/20 dark:bg-sky-900/10',
    state === 'pending' && 'border-gray-200/50 bg-gray-50/30 dark:border-gray-700/20 dark:bg-gray-900/10'
  );
  
  const textCls = cn(
    'text-[11px]',
    state === 'completed' && 'text-emerald-700 dark:text-emerald-400',
    state === 'failed' && 'text-red-700 dark:text-red-400',
    state === 'running' && 'text-sky-700 dark:text-sky-400',
    state === 'pending' && 'text-gray-600 dark:text-gray-400'
  );
  
  const iconCls = 'h-3.5 w-3.5 flex-shrink-0';
  
  return (
    <div className={containerCls}>
      <div className="flex items-start gap-2">
        {/* State icon */}
        {state === 'completed' && <PiCheckCircle className={cn(iconCls, 'text-emerald-500')} />}
        {state === 'failed' && <PiXCircle className={cn(iconCls, 'text-red-500')} />}
        {state === 'running' && <PiSpinner className={cn(iconCls, 'animate-spin text-sky-500')} />}
        {state === 'pending' && <PiClockCountdown className={cn(iconCls, 'text-gray-400')} />}
        
        {/* Message */}
        <p className={cn(textCls, 'flex-1 leading-relaxed')} dir="auto">
          {progressData.message || t('thinkingSteps.progressLabel')}
        </p>
      </div>
      
      {/* Progress bar (if progress percentage available) */}
      {progressData.progress != null && progressData.progress > 0 && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div 
              className={cn(
                'h-full rounded-full transition-all duration-300',
                state === 'completed' && 'bg-emerald-500',
                state === 'failed' && 'bg-red-500',
                (state === 'running' || state === 'pending') && 'bg-sky-500'
              )}
              style={{ width: `${Math.min(progressData.progress * 100, 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[9px] text-gray-400">
            {Math.round(progressData.progress * 100)}%
          </p>
        </div>
      )}
      
      {/* Task ID (if available) */}
      {progressData.taskId && (
        <p className="mt-1 text-[9px] text-gray-400">
          Task: {progressData.taskId}
        </p>
      )}
    </div>
  );
}
