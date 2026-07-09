// ============================================
// TracePanel — Agent Planning & Execution Timeline
// Collapsible debug panel showing the Planning Agent's trace:
// assess_complexity → planner → executor → critic → synthesizer
// ============================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCaretDown,
  PiCaretRight,
  PiSpinner,
  PiCheckCircle,
  PiXCircle,
  PiLightningBold,
  PiClockCountdown,
  PiBrain,
  PiListBullets,
  PiMagnifyingGlass,
  PiArrowsClockwise,
  PiSparkle,
  PiChatCircle,
  PiTarget,
  PiWrench,
  PiGear,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { getCachedTrace } from '@/utils/trace-cache';
import type {
  TraceDetail,
  TraceStep,
  TraceToolExecution,
  TraceNodeName,
} from '@/types/chat.types';

// ==========================================
// Node config — icons, labels, colors
// ==========================================

/**
 * Configuration for each Planning Agent node type.
 * Icons and labels from FRONTEND_TRACE_API.md specification.
 */
const NODE_CONFIG: Record<
  TraceNodeName,
  {
    labelKey: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
  assess_complexity: {
    labelKey: 'tracePanel.nodes.assessment',
    icon: <PiTarget className="h-3.5 w-3.5" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
  },
  planner: {
    labelKey: 'tracePanel.nodes.planning',
    icon: <PiListBullets className="h-3.5 w-3.5" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  executor: {
    labelKey: 'tracePanel.nodes.execution',
    icon: <PiLightningBold className="h-3.5 w-3.5" />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  critic: {
    labelKey: 'tracePanel.nodes.review',
    icon: <PiMagnifyingGlass className="h-3.5 w-3.5" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  replanner: {
    labelKey: 'tracePanel.nodes.replanning',
    icon: <PiArrowsClockwise className="h-3.5 w-3.5" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
  },
  synthesizer: {
    labelKey: 'tracePanel.nodes.synthesis',
    icon: <PiSparkle className="h-3.5 w-3.5" />,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
  },
  simple_response: {
    labelKey: 'tracePanel.nodes.direct',
    icon: <PiChatCircle className="h-3.5 w-3.5" />,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-100',
  },
};

/**
 * Format milliseconds to a human-readable duration string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Trace APIs may return `llm_response` / `result_sent_to_llm` as a string or as
 * structured objects (e.g. `{ content: "..." }` or OpenAI-style message parts).
 * React cannot render raw objects — normalize to plain text for `<pre>` blocks.
 */
function formatTraceDisplayPayload(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('content' in o && o.content != null) {
      const c = o.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        return c
          .map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object' && 'text' in part) {
              return String((part as { text?: unknown }).text ?? '');
            }
            try {
              return JSON.stringify(part);
            } catch {
              return '';
            }
          })
          .filter(Boolean)
          .join('');
      }
      try {
        return JSON.stringify(c, null, 2);
      } catch {
        return String(c);
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ==========================================
// Sub-components
// ==========================================

/**
 * StepBadge — Compact step indicator used in summary mode.
 */
function StepBadge({ step }: { step: TraceStep }) {
  const { t } = useTranslation();
  const config = NODE_CONFIG[step.node_name] ?? NODE_CONFIG.simple_response;
  const isRunning = step.status === 'running';
  const isFailed = step.status === 'failed';

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isFailed
          ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
          : config.bgColor,
        isFailed ? '' : config.color
      )}
      title={`${t(config.labelKey)} — ${formatDuration(step.duration_ms ?? 0)}`}
    >
      {isRunning ? (
        <PiSpinner className="h-3 w-3 animate-spin" />
      ) : isFailed ? (
        <PiXCircle className="h-3 w-3" />
      ) : (
        <span className="flex-shrink-0">{config.icon}</span>
      )}
      <span>{t(config.labelKey)}</span>
    </div>
  );
}

/**
 * StepDetail — Full step row in detailed timeline mode.
 */
function StepDetail({
  step,
  tools,
}: {
  step: TraceStep;
  tools: TraceToolExecution[];
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const config = NODE_CONFIG[step.node_name] ?? NODE_CONFIG.simple_response;
  const isRunning = step.status === 'running';
  const isFailed = step.status === 'failed';
  const relatedTools = tools.filter((t) => t.step_number === step.step_number);
  const llmDisplayText = formatTraceDisplayPayload(step.llm_response);
  const hasLlmText = llmDisplayText.trim().length > 0;
  const hasOutput =
    !!step.output_data && Object.keys(step.output_data).length > 0;
  const hasDetail = hasLlmText || hasOutput || relatedTools.length > 0;

  return (
    <div className="relative ps-6">
      {/* Timeline line */}
      <div className="absolute start-2.5 top-0 -bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

      {/* Timeline dot */}
      <div
        className={cn(
          'absolute start-0.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white dark:border-gray-800',
          isFailed
            ? 'bg-red-100 dark:bg-red-900/50'
            : isRunning
              ? 'bg-primary/20'
              : 'bg-gray-100 dark:bg-gray-700'
        )}
      >
        {isRunning ? (
          <PiSpinner className="h-2.5 w-2.5 animate-spin text-primary" />
        ) : isFailed ? (
          <PiXCircle className="h-2.5 w-2.5 text-red-500" />
        ) : (
          <PiCheckCircle className="h-2.5 w-2.5 text-green-500 dark:text-green-400" />
        )}
      </div>

      {/* Step content */}
      <div className="pb-3">
        <button
          onClick={() => hasDetail && setExpanded(!expanded)}
          className={cn(
            'flex w-full items-center gap-2 text-start text-xs',
            hasDetail && 'cursor-pointer hover:text-primary'
          )}
          disabled={!hasDetail}
        >
          <span className={cn('flex-shrink-0', config.color)}>
            {config.icon}
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {t(config.labelKey)}
          </span>
          <span className="ms-auto flex items-center gap-1 text-gray-400">
            <PiClockCountdown className="h-3 w-3" />
            {formatDuration(step.duration_ms ?? 0)}
          </span>
          {hasDetail && (
            expanded ? (
              <PiCaretDown className="h-3 w-3 text-gray-400" />
            ) : (
              <PiCaretRight className="h-3 w-3 text-gray-400" />
            )
          )}
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-1.5 space-y-2 rounded-lg border border-muted bg-gray-50 p-2 dark:bg-gray-100">
            {/* LLM response */}
            {hasLlmText && (
              <div>
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('tracePanel.llmResponse')}
                </div>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-gray-600 dark:text-gray-400">
                  {llmDisplayText}
                </pre>
              </div>
            )}

            {/* Output data (e.g. plan from planner) */}
            {step.output_data && Object.keys(step.output_data).length > 0 && (
              <div>
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('tracePanel.output')}
                </div>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-gray-600 dark:text-gray-400">
                  {JSON.stringify(step.output_data, null, 2)}
                </pre>
              </div>
            )}

            {/* Tools executed in this step */}
            {relatedTools.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('tracePanel.toolsCount', { count: relatedTools.length })}
                </div>
                <div className="space-y-1">
                  {relatedTools.map((tool) => (
                    <ToolDetail key={tool.tool_id} tool={tool} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ToolDetail — Shows a single tool execution within a trace step.
 */
function ToolDetail({ tool }: { tool: TraceToolExecution }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const isFailed = tool.status === 'failed';
  const resultToLlmText = formatTraceDisplayPayload(tool.result_sent_to_llm);

  return (
    <div className="rounded border border-muted bg-white px-2 py-1 dark:bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 text-start text-[11px]"
      >
        <PiWrench className="h-3 w-3 flex-shrink-0 text-gray-400" />
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {tool.tool_name}
        </span>
        {isFailed ? (
          <PiXCircle className="h-3 w-3 text-red-500" />
        ) : (
          <PiCheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />
        )}
        <span className="ms-auto text-gray-400">
          {formatDuration(tool.duration_ms)}
        </span>
        {expanded ? (
          <PiCaretDown className="h-2.5 w-2.5 text-gray-400" />
        ) : (
          <PiCaretRight className="h-2.5 w-2.5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1.5 border-t border-muted pt-1.5">
          {/* Arguments */}
          {tool.arguments && Object.keys(tool.arguments).length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase text-gray-400">
                {t('tracePanel.toolInput')}
              </div>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-gray-500">
                {JSON.stringify(tool.arguments, null, 2)}
              </pre>
            </div>
          )}
          {/* Result sent to LLM */}
          {resultToLlmText.trim().length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase text-gray-400">
                {t('tracePanel.toolResult')}
              </div>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-gray-500">
                {resultToLlmText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main TracePanel Component
// ==========================================

interface TracePanelProps {
  /** Trace ID from the message's done event */
  traceId: string;
  /** Whether the trace is still running */
  isStreaming?: boolean;
}

/**
 * TracePanel — Collapsible Agent trace timeline panel.
 *
 * Fetches trace data from the Trace API and displays:
 * - Summary: compact horizontal flow of step badges with total duration
 * - Detail: vertical timeline with expandable steps and tool details
 *
 * Shows under assistant messages that have a trace_id.
 * Lazy-loads trace data only when panel is first expanded.
 *
 * @requires traceService — for API calls to /traces endpoints
 *
 * @example
 * ```tsx
 * {message.trace_id && (
 *   <TracePanel traceId={message.trace_id} />
 * )}
 * ```
 */
export default function TracePanel({ traceId, isStreaming }: TracePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailedMode, setIsDetailedMode] = useState(false);
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  // Track whether we've already fetched so we don't re-fetch on every toggle
  const [fetched, setFetched] = useState(false);
  // WHY: Prevents infinite retry loops when backend returns persistent errors (e.g. 500).
  // Without this, error → re-render → !fetched && !loading → fetchTrace() → error → ∞
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  /**
   * Lazily fetch trace detail when panel is first opened.
   * Stops auto-retrying after MAX_RETRIES failures to prevent infinite loops.
   * Handles 404 (trace not found) and 500 (server error) differently.
   */
  const fetchTrace = useCallback(async () => {
    if (fetched || loading) return;
    console.info('[TracePanel] Fetching trace detail:', { traceId, attempt: retryCountRef.current + 1 });
    setLoading(true);
    setError(null);
    try {
      const data = await getCachedTrace(traceId, true);
      setTrace(data);
      setFetched(true);
      retryCountRef.current = 0;
      console.info('[TracePanel] Trace loaded:', {
        traceId,
        status: data.status,
        steps: data.steps?.length ?? 0,
        tools: data.tool_executions?.length ?? 0,
        durationMs: data.total_duration_ms,
      });
    } catch (err: unknown) {
      retryCountRef.current += 1;
      // WHY: Extract HTTP status to provide user-friendly error messages.
      // 404 = trace not found (backend may not store traces for simple queries).
      // 500 = server error (trace API is broken or unavailable).
      const axiosError = err as { response?: { status?: number }; message?: string };
      const httpStatus = axiosError?.response?.status;
      let msg: string;
      if (httpStatus === 404) {
        msg = t('tracePanel.error404');
      } else if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503) {
        msg = t('tracePanel.error5xx');
      } else {
        msg = axiosError?.message ?? t('tracePanel.errorGeneral');
      }
      setError(msg);
      // WHY: Mark as fetched (give up) after MAX_RETRIES or immediately for 404
      // to break the useEffect re-trigger cycle. User can still retry manually.
      if (retryCountRef.current >= MAX_RETRIES || httpStatus === 404) {
        setFetched(true);
        console.warn('[TracePanel] Stopping auto-retry:', {
          traceId,
          attempts: retryCountRef.current,
          httpStatus,
          reason: httpStatus === 404 ? 'not found' : 'max retries',
        });
      }
      console.error('[TracePanel] Failed to fetch trace:', { traceId, httpStatus, err, attempt: retryCountRef.current });
    } finally {
      setLoading(false);
    }
  }, [fetched, loading, traceId, t]);

  // Fetch when opened for the first time
  useEffect(() => {
    if (isOpen && !fetched && !loading) {
      fetchTrace();
    }
  }, [isOpen, fetched, loading, fetchTrace]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const steps = trace?.steps ?? [];
  const tools = trace?.tool_executions ?? [];
  const hasReplan = steps.some((s) => s.node_name === 'replanner');
  const complexity = trace?.complexity ?? 'simple';

  return (
    <div className="mt-1 mb-1">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-100 dark:hover:text-gray-300"
        aria-expanded={isOpen}
      >
        <PiGear className="h-3 w-3 flex-shrink-0" />
        <span>{t('tracePanel.title')}</span>
        {trace && (
          <span className="text-gray-400">
            — {steps.length} {steps.length !== 1 ? t('tracePanel.stepPlural') : t('tracePanel.stepSingular')},{' '}
            {tools.length} {tools.length !== 1 ? t('tracePanel.toolPlural') : t('tracePanel.toolSingular')},{' '}
            {formatDuration(trace.total_duration_ms ?? 0)}
          </span>
        )}
        {hasReplan && (
          <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
          {t('tracePanel.replanned')}
          </span>
        )}
        {loading && <PiSpinner className="h-3 w-3 animate-spin text-primary" />}
        <PiCaretDown
          className={cn(
            'ms-auto h-3 w-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Panel content */}
      {isOpen && (
        <div className="mt-1 rounded-lg border border-muted bg-gray-0 p-2 dark:bg-gray-50">
          {/* Loading state */}
          {loading && !trace && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400">
              <PiSpinner className="h-4 w-4 animate-spin" />
              {t('tracePanel.loading')}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-500 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-400">
              <PiXCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
              <button
                onClick={() => {
                  retryCountRef.current = 0;
                  setFetched(false);
                  setError(null);
                }}
                className="ms-auto text-red-600 hover:underline dark:text-red-400"
              >
                {t('tracePanel.retry')}
              </button>
            </div>
          )}

          {/* Trace data */}
          {trace && (
            <>
              {/* Header with complexity + toggle */}
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    complexity === 'complex'
                      ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-200 dark:text-gray-400'
                  )}
                >
                  {complexity}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    trace.status === 'completed'
                      ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'
                      : trace.status === 'failed'
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                  )}
                >
                  {trace.status}
                </span>
                <div className="ms-auto flex items-center gap-1 rounded-md border border-muted p-0.5">
                  <button
                    onClick={() => setIsDetailedMode(false)}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                      !isDetailedMode
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-400 hover:text-gray-600'
                    )}
                    title={t('tracePanel.viewSummaryTitle')}
                  >
                    {t('tracePanel.viewSummary')}
                  </button>
                  <button
                    onClick={() => setIsDetailedMode(true)}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                      isDetailedMode
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-400 hover:text-gray-600'
                    )}
                    title={t('tracePanel.viewDetailTitle')}
                  >
                    {t('tracePanel.viewDetail')}
                  </button>
                </div>
              </div>

              {/* Execution plan (if complex) */}
              {trace.execution_plan && (() => {
                // WHY: execution_plan is opaque (additionalProperties: true) in the API.
                // We cast it to our known TracePlan shape and handle both `tasks`
                // (current SSE format) and legacy `subtasks` (older backend versions).
                const plan = trace.execution_plan as {
                  goal?: string;
                  tasks?: Array<{ id: string; description: string; tool?: string; depends_on?: string[] }>;
                  subtasks?: Array<{ id: number; description: string; tools?: string[] }>;
                };
                const taskItems = plan.tasks ?? plan.subtasks ?? [];
                return (
                  <div className="mb-2 rounded border border-blue-200 bg-blue-50/50 px-2 py-1.5 dark:border-blue-800/30 dark:bg-blue-950/20">
                    {plan.goal && (
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                        {t('tracePanel.planPrefix')} {String(plan.goal)}
                      </div>
                    )}
                    <ol className="space-y-0.5 text-[11px] text-blue-700 dark:text-blue-300">
                      {taskItems.map((task) => (
                        <li key={task.id} className="flex items-start gap-1">
                          <span className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-[9px] font-bold text-blue-700 dark:bg-blue-800 dark:text-blue-200">
                            {task.id}
                          </span>
                          <span>{task.description}</span>
                          {'tools' in task && Array.isArray(task.tools) && task.tools.length > 0 && (
                            <span className="ms-auto text-[10px] text-blue-400">
                              {task.tools.join(', ')}
                            </span>
                          )}
                          {'tool' in task && task.tool && (
                            <span className="ms-auto text-[10px] text-blue-400">
                              {String(task.tool)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()}

              {/* Summary mode — compact horizontal step badges */}
              {!isDetailedMode && (
                <div className="flex flex-wrap items-center gap-1">
                  {steps.map((step, idx) => (
                    <div key={step.step_number} className="flex items-center gap-1">
                      <StepBadge step={step} />
                      {idx < steps.length - 1 && (
                        <PiCaretRight className="h-2.5 w-2.5 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Detailed mode — vertical timeline */}
              {isDetailedMode && (
                <div className="mt-1">
                  {steps.map((step) => (
                    <StepDetail
                      key={step.step_number}
                      step={step}
                      tools={tools}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
