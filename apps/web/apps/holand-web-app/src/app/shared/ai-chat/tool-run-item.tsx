// ============================================
// ToolRunItem — Single tool execution display
// Shows tool name, args, result, and status
// ============================================

'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiCaretDown,
  PiCaretRight,
  PiCheckCircle,
  PiXCircle,
  PiMagnifyingGlass,
  PiCode,
  PiDatabase,
  PiGlobe,
  PiFileText,
  PiGear,
  PiChartBar,
  PiTranslate,
  PiTerminalWindow,
  PiClockCountdown,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { ToolRunInfo } from '@/types/chat.types';

// ==========================================
// Tool icon mapping by tool_id keywords
// ==========================================

/**
 * Returns an appropriate icon for a tool based on its ID.
 * Matches common tool naming conventions.
 */
function getToolIcon(toolId: string): React.ReactNode {
  const id = toolId.toLowerCase();
  if (id.includes('search') || id.includes('web'))
    return <PiMagnifyingGlass className="h-3.5 w-3.5" />;
  if (id.includes('code') || id.includes('python') || id.includes('interpreter'))
    return <PiCode className="h-3.5 w-3.5" />;
  if (id.includes('sql') || id.includes('db') || id.includes('database') || id.includes('query'))
    return <PiDatabase className="h-3.5 w-3.5" />;
  if (id.includes('http') || id.includes('api') || id.includes('request') || id.includes('fetch'))
    return <PiGlobe className="h-3.5 w-3.5" />;
  if (id.includes('file') || id.includes('read') || id.includes('write') || id.includes('document'))
    return <PiFileText className="h-3.5 w-3.5" />;
  if (id.includes('chart') || id.includes('plot') || id.includes('visual'))
    return <PiChartBar className="h-3.5 w-3.5" />;
  if (id.includes('translate') || id.includes('lang'))
    return <PiTranslate className="h-3.5 w-3.5" />;
  if (id.includes('run') || id.includes('exec') || id.includes('shell') || id.includes('terminal'))
    return <PiTerminalWindow className="h-3.5 w-3.5" />;
  return <PiGear className="h-3.5 w-3.5" />;
}

/**
 * Formats a tool_id string to a readable label.
 * e.g. "search_documents" → "Search Documents"
 */
function formatToolName(toolId: string): string {
  return toolId
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a JSON value to a compact readable string.
 * Objects are pretty-printed, strings shown as-is.
 */
function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

/**
 * Extract a one-line text preview from a tool result.
 * Handles both string results and object results.
 *
 * @param result - Tool result (string or object)
 * @returns Single-line preview string (max ~120 chars)
 */
function getResultPreview(result: Record<string, unknown> | string): string {
  // String result — return directly
  if (typeof result === 'string') {
    const text = result.replace(/\n/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 117) + '...' : text;
  }

  // Object result — try common text-bearing keys first
  const textKeys = ['text', 'content', 'output', 'result', 'message', 'summary', 'description'];
  for (const key of textKeys) {
    if (key in result && typeof result[key] === 'string' && (result[key] as string).length > 0) {
      const text = (result[key] as string).replace(/\n/g, ' ').trim();
      return text.length > 120 ? text.slice(0, 117) + '...' : text;
    }
  }
  // Try first string value from any key
  for (const val of Object.values(result)) {
    if (typeof val === 'string' && val.length > 0) {
      const text = val.replace(/\n/g, ' ').trim();
      return text.length > 120 ? text.slice(0, 117) + '...' : text;
    }
  }
  // Fallback: compact JSON
  try {
    const json = JSON.stringify(result);
    return json.length > 120 ? json.slice(0, 117) + '...' : json;
  } catch {
    return `${Object.keys(result).length} field(s)`;
  }
}

interface ToolRunItemProps {
  /** Tool run data */
  tool: ToolRunInfo;
  /** Sequential step number (1-based) */
  stepNumber: number;
  /** Whether this tool is currently running (streaming indicator) */
  isActive?: boolean;
}

/**
 * ToolRunItem — Displays a single tool execution in the thinking panel.
 *
 * Features:
 * - Collapsible args + result sections
 * - Status indicator (success / error / running)
 * - Tool-specific icon based on tool_id
 * - Compact by default, expandable for details
 *
 * @example
 * ```tsx
 * <ToolRunItem tool={toolRun} stepNumber={1} />
 * ```
 */
export default function ToolRunItem({
  tool,
  stepNumber,
  isActive = false,
}: ToolRunItemProps) {
  const { t } = useTranslation();
  const isSuccess = isActive || tool.status !== 'error';
  const hasArgs = tool.args && Object.keys(tool.args).length > 0;
  // WHY: Backend may send result in different formats/fields:
  // - tool.result (object or string) — standard field after normalization
  // - (tool as any).output — raw backend field before normalization
  // We check all variants to ensure tool results are always displayed.
  const rawResult: Record<string, unknown> | string | undefined =
    tool.result ?? (tool as unknown as Record<string, unknown>).output as Record<string, unknown> | string | undefined;
  const hasResult = rawResult != null && (
    typeof rawResult === 'string'
      ? rawResult.length > 0
      : typeof rawResult === 'object' && Object.keys(rawResult).length > 0
  );
  // Use the resolved result for display
  const displayResult = hasResult ? rawResult : undefined;
  const hasDetails = hasArgs || hasResult || tool.error;

  // WHY: Auto-expand completed tools that have results so users can see
  // the tool output text without clicking. This addresses the UX complaint
  // that "tool results are not shown in the thinking section".
  const [isExpanded, setIsExpanded] = useState(!isActive && !!hasResult);

  return (
    <div
      className={cn(
        'group/tool rounded-lg border transition-colors',
        isActive
          ? 'border-primary/30 bg-primary/5 dark:bg-primary/5'
          : isSuccess
            ? 'border-gray-100 bg-gray-0 dark:border-gray-200/20 dark:bg-gray-100/20'
            : 'border-red-200/60 bg-red-50/50 dark:border-red-800/20 dark:bg-red-950/10'
      )}
    >
      {/* Header row */}
      <button
        onClick={() => hasDetails && setIsExpanded((e) => !e)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-start',
          hasDetails && 'cursor-pointer',
          !hasDetails && 'cursor-default'
        )}
        aria-expanded={isExpanded}
        disabled={!hasDetails}
      >
        {/* Step indicator */}
        <span
          className={cn(
            'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
            isActive
              ? 'bg-primary text-primary-foreground'
              : isSuccess
                ? 'bg-gray-100 text-gray-500 dark:bg-gray-200/30 dark:text-gray-400'
                : 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'
          )}
        >
          {stepNumber}
        </span>

        {/* Tool icon */}
        <span
          className={cn(
            'flex-shrink-0',
            isActive
              ? 'animate-pulse text-primary'
              : isSuccess
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-red-400'
          )}
        >
          {getToolIcon(tool.tool_id)}
        </span>

        {/* Tool name */}
        <span
          className={cn(
            'flex-1 text-xs font-medium',
            isActive
              ? 'text-primary'
              : 'text-gray-700 dark:text-gray-300'
          )}
        >
          {formatToolName(tool.tool_id)}
        </span>

        {/* Execution time — shown when available and tool is not actively running */}
        {!isActive && tool.execution_time != null && (
          <span className="flex-shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            {tool.execution_time < 1
              ? `${Math.round(tool.execution_time * 1000)}ms`
              : `${tool.execution_time.toFixed(1)}s`}
          </span>
        )}

        {/* Status icon */}
        <span className="ms-auto flex-shrink-0">
          {isActive ? (
            <PiClockCountdown className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : isSuccess ? (
            <PiCheckCircle className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
          ) : (
            <PiXCircle className="h-3.5 w-3.5 text-red-500" />
          )}
        </span>

        {/* Chevron — only if has details */}
        {hasDetails && (
          <PiCaretDown
            className={cn(
              'h-3 w-3 flex-shrink-0 text-gray-400 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        )}
        {!hasDetails && (
          <PiCaretRight className="h-3 w-3 flex-shrink-0 text-gray-300 dark:text-gray-600" />
        )}
      </button>

      {/* Live progress while tool is running */}
      {isActive && tool.progress != null && tool.progress > 0 && (
        <div className="space-y-1 border-t border-primary/10 px-3 py-2">
          <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-200/30">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.min(tool.progress * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="truncate">
              {tool.progressMessage || t('toolRunItem.running')}
            </span>
            <span className="flex-shrink-0 tabular-nums">
              {Math.round(tool.progress * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Compact result preview — visible when collapsed, shows first line of output */}
      {hasResult && !isExpanded && !isActive && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full cursor-pointer border-t border-gray-100 px-3 py-1.5 text-start dark:border-gray-200/10"
        >
          <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
            <span className="font-semibold uppercase tracking-wide">{t('toolRunItem.outputLabel')}</span>{' '}
            {getResultPreview(displayResult!)}
          </p>
        </button>
      )}

      {/* Expandable detail panel */}
      {hasDetails && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 ease-in-out',
            isExpanded ? 'max-h-[400px]' : 'max-h-0'
          )}
        >
          <div className="space-y-2 border-t border-gray-100 px-3 pb-3 pt-2 dark:border-gray-200/10">
            {/* Args section */}
            {hasArgs && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('toolRunItem.input')}
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-600 dark:bg-gray-100/20 dark:text-gray-400">
                  {formatValue(tool.args)}
                </pre>
              </div>
            )}

            {/* Result section */}
            {hasResult && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('toolRunItem.output')}
                </p>
                <pre className="max-h-[150px] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-600 dark:bg-gray-100/20 dark:text-gray-400">
                  {formatValue(displayResult)}
                </pre>
              </div>
            )}

            {/* Error section */}
            {tool.error && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                  {t('toolRunItem.error')}
                </p>
                <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 text-[10px] leading-relaxed text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {tool.error}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
