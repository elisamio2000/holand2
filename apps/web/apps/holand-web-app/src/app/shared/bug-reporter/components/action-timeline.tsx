'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import {
  PiXBold,
  PiCheckBold,
  PiNotePencilBold,
  PiCaretDownBold,
  PiCaretRightBold,
  PiCopyBold,
  PiLinkBold,
  PiWarningBold,
  PiCheckCircleBold,
  PiXCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { BugReportAction, ClickAction, ApiCallAction, ErrorAction } from '../types';

type ActionTimelineProps = {
  actions: BugReportAction[];
  startTime: number;
  editable?: boolean;
  onUpdate?: (actions: BugReportAction[]) => void;
  className?: string;
};

function formatTime(ts: number, startTime: number) {
  const offset = Math.max(0, Math.round((ts - startTime) / 1000));
  return `+${offset}s`;
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatJson(str?: string): string {
  if (!str) return '';
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function getStatusColor(status?: number): string {
  if (!status) return 'text-gray-500';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 400 && status < 500) return 'text-orange-600 dark:text-orange-400';
  if (status >= 500) return 'text-red-600 dark:text-red-400';
  return 'text-blue-600 dark:text-blue-400';
}

function ClickActionItem({
  action,
  startTime,
  allActions,
  expanded,
  onToggle,
}: {
  action: ClickAction;
  startTime: number;
  allActions: BugReportAction[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasTriggeredCalls = action.triggeredApiCalls && action.triggeredApiCalls.length > 0;
  const triggeredApis = hasTriggeredCalls
    ? allActions.filter(
        (a) => a.type === 'api_call' && action.triggeredApiCalls!.includes((a as ApiCallAction).id)
      ) as ApiCallAction[]
    : [];

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
          'border-blue-200 bg-blue-50 text-blue-800',
          'dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300',
          'hover:border-blue-300 dark:hover:border-blue-800'
        )}
        onClick={onToggle}
      >
        <span className="mt-0.5 shrink-0">
          {expanded ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
        </span>
        <span className="shrink-0 font-mono opacity-70">{formatTime(action.timestamp, startTime)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">🖱 Click</span>
            <span className="text-blue-600 dark:text-blue-400">{action.target}</span>
            {hasTriggeredCalls && (
              <span className="flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <PiLinkBold className="h-2.5 w-2.5" />
                {triggeredApis.length} API
              </span>
            )}
          </div>
          {!expanded && action.selector && (
            <div className="mt-0.5 truncate font-mono text-[10px] opacity-60">{action.selector}</div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ml-5 space-y-1.5 rounded-md border border-blue-100 bg-blue-50/50 p-2 text-[11px] dark:border-blue-900/20 dark:bg-blue-950/20">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="font-medium text-blue-700 dark:text-blue-400">Element:</span>
            <span className="font-mono">{action.tagName || 'unknown'}</span>

            {action.selector && (
              <>
                <span className="font-medium text-blue-700 dark:text-blue-400">Selector:</span>
                <div className="flex items-center gap-1">
                  <code className="flex-1 truncate rounded bg-white px-1 py-0.5 font-mono dark:bg-gray-800">
                    {action.selector}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(action.selector!); }}
                    className="shrink-0 opacity-50 hover:opacity-100"
                    title="Copy selector"
                  >
                    <PiCopyBold className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}

            {action.testId && (
              <>
                <span className="font-medium text-blue-700 dark:text-blue-400">Test ID:</span>
                <code className="rounded bg-white px-1 py-0.5 font-mono dark:bg-gray-800">{action.testId}</code>
              </>
            )}

            {action.role && (
              <>
                <span className="font-medium text-blue-700 dark:text-blue-400">Role:</span>
                <span>{action.role}</span>
              </>
            )}

            {action.href && (
              <>
                <span className="font-medium text-blue-700 dark:text-blue-400">Link:</span>
                <span className="truncate">{action.href}</span>
              </>
            )}

            {action.coordinates && (
              <>
                <span className="font-medium text-blue-700 dark:text-blue-400">Position:</span>
                <span>x={action.coordinates.x}, y={action.coordinates.y}</span>
              </>
            )}
          </div>

          {triggeredApis.length > 0 && (
            <div className="mt-2 border-t border-blue-200 pt-2 dark:border-blue-800">
              <div className="mb-1 flex items-center gap-1 font-medium text-violet-700 dark:text-violet-400">
                <PiLinkBold className="h-3 w-3" />
                Triggered API Calls:
              </div>
              {triggeredApis.map((api) => (
                <div
                  key={api.id}
                  className="mt-1 rounded border border-violet-200 bg-violet-50/50 p-1.5 dark:border-violet-800/40 dark:bg-violet-950/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-200 px-1 py-0.5 font-mono font-bold text-violet-800 dark:bg-violet-800 dark:text-violet-200">
                      {api.method}
                    </span>
                    <span className={cn('font-medium', getStatusColor(api.status))}>
                      {api.status || 'pending'}
                    </span>
                    <span className="flex-1 truncate font-mono text-[10px]">{api.endpoint}</span>
                    {api.duration !== undefined && (
                      <span className="text-gray-500">{formatDuration(api.duration)}</span>
                    )}
                  </div>
                  {api.error && (
                    <div className="mt-1 flex items-start gap-1 text-red-600 dark:text-red-400">
                      <PiWarningBold className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{api.error}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApiCallActionItem({
  action,
  startTime,
  expanded,
  onToggle,
  isTriggeredByClick,
}: {
  action: ApiCallAction;
  startTime: number;
  expanded: boolean;
  onToggle: () => void;
  isTriggeredByClick: boolean;
}) {
  const [showRequestBody, setShowRequestBody] = useState(false);
  const [showResponseBody, setShowResponseBody] = useState(false);

  const isSuccess = action.status && action.status >= 200 && action.status < 300;
  const isError = action.status && action.status >= 400;
  const hasError = action.error || isError;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
          hasError
            ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
            : 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300',
          'hover:border-violet-300 dark:hover:border-violet-800'
        )}
        onClick={onToggle}
      >
        <span className="mt-0.5 shrink-0">
          {expanded ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
        </span>
        <span className="shrink-0 font-mono opacity-70">{formatTime(action.timestamp, startTime)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-violet-200 px-1.5 py-0.5 font-mono font-bold text-violet-800 dark:bg-violet-800 dark:text-violet-200">
              {action.method}
            </span>
            <span className={cn('flex items-center gap-1 font-medium', getStatusColor(action.status))}>
              {isSuccess && <PiCheckCircleBold className="h-3 w-3" />}
              {hasError && <PiXCircleBold className="h-3 w-3" />}
              {action.status || (action.error ? 'ERROR' : 'pending')}
            </span>
            <span className="flex-1 truncate font-mono">{action.endpoint}</span>
            {action.duration !== undefined && (
              <span className="shrink-0 text-gray-500">{formatDuration(action.duration)}</span>
            )}
            {isTriggeredByClick && (
              <span className="shrink-0 rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                ← click
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="ml-5 space-y-2 rounded-md border border-violet-100 bg-violet-50/50 p-2 text-[11px] dark:border-violet-900/20 dark:bg-violet-950/20">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="font-medium text-violet-700 dark:text-violet-400">URL:</span>
            <div className="flex items-center gap-1">
              <code className="flex-1 break-all rounded bg-white px-1 py-0.5 font-mono dark:bg-gray-800">
                {action.url}
              </code>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(action.url); }}
                className="shrink-0 opacity-50 hover:opacity-100"
                title="Copy URL"
              >
                <PiCopyBold className="h-3 w-3" />
              </button>
            </div>

            <span className="font-medium text-violet-700 dark:text-violet-400">Status:</span>
            <span className={getStatusColor(action.status)}>
              {action.status} {action.statusText}
            </span>

            {action.duration !== undefined && (
              <>
                <span className="font-medium text-violet-700 dark:text-violet-400">Duration:</span>
                <span>{formatDuration(action.duration)}</span>
              </>
            )}

            {action.error && (
              <>
                <span className="font-medium text-red-700 dark:text-red-400">Error:</span>
                <span className="text-red-600 dark:text-red-400">{action.error}</span>
              </>
            )}
          </div>

          {action.requestBody && (
            <div className="border-t border-violet-200 pt-2 dark:border-violet-800">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowRequestBody(!showRequestBody); }}
                className="flex items-center gap-1 font-medium text-violet-700 hover:text-violet-900 dark:text-violet-400"
              >
                {showRequestBody ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
                Request Body
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(action.requestBody!); }}
                  className="ml-2 opacity-50 hover:opacity-100"
                  title="Copy request body"
                >
                  <PiCopyBold className="h-3 w-3" />
                </button>
              </button>
              {showRequestBody && (
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-white p-2 font-mono text-[10px] dark:bg-gray-800">
                  {formatJson(action.requestBody)}
                </pre>
              )}
            </div>
          )}

          {action.responseBody && (
            <div className="border-t border-violet-200 pt-2 dark:border-violet-800">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowResponseBody(!showResponseBody); }}
                className="flex items-center gap-1 font-medium text-violet-700 hover:text-violet-900 dark:text-violet-400"
              >
                {showResponseBody ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
                Response Body
                <span className={cn('ml-1 text-[10px]', getStatusColor(action.status))}>
                  ({truncateText(action.responseBody, 50)})
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(action.responseBody!); }}
                  className="ml-2 opacity-50 hover:opacity-100"
                  title="Copy response body"
                >
                  <PiCopyBold className="h-3 w-3" />
                </button>
              </button>
              {showResponseBody && (
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-white p-2 font-mono text-[10px] dark:bg-gray-800">
                  {formatJson(action.responseBody)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorActionItem({
  action,
  startTime,
  expanded,
  onToggle,
}: {
  action: ErrorAction;
  startTime: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
          'border-red-200 bg-red-50 text-red-800',
          'dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300',
          'hover:border-red-300 dark:hover:border-red-800'
        )}
        onClick={onToggle}
      >
        <span className="mt-0.5 shrink-0">
          {expanded ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
        </span>
        <span className="shrink-0 font-mono opacity-70">{formatTime(action.timestamp, startTime)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PiWarningBold className="h-4 w-4 shrink-0 text-red-600" />
            <span className="font-medium">Error</span>
            {action.relatedApiCall && (
              <span className="rounded bg-violet-100 px-1 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                API Error
              </span>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2">{action.message}</div>
        </div>
      </div>

      {expanded && (
        <div className="ml-5 space-y-2 rounded-md border border-red-100 bg-red-50/50 p-2 text-[11px] dark:border-red-900/20 dark:bg-red-950/20">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="font-medium text-red-700 dark:text-red-400">Message:</span>
            <div className="flex items-center gap-1">
              <span className="flex-1">{action.message}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(action.message); }}
                className="shrink-0 opacity-50 hover:opacity-100"
                title="Copy message"
              >
                <PiCopyBold className="h-3 w-3" />
              </button>
            </div>

            {action.source && (
              <>
                <span className="font-medium text-red-700 dark:text-red-400">Source:</span>
                <span className="font-mono">{action.source}</span>
              </>
            )}

            {(action.lineno || action.colno) && (
              <>
                <span className="font-medium text-red-700 dark:text-red-400">Location:</span>
                <span>Line {action.lineno}, Column {action.colno}</span>
              </>
            )}
          </div>

          {action.stack && (
            <div className="border-t border-red-200 pt-2 dark:border-red-800">
              <div className="mb-1 flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
                Stack Trace:
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(action.stack!); }}
                  className="ml-2 opacity-50 hover:opacity-100"
                  title="Copy stack trace"
                >
                  <PiCopyBold className="h-3 w-3" />
                </button>
              </div>
              <pre className="max-h-40 overflow-auto rounded bg-white p-2 font-mono text-[10px] text-red-600 dark:bg-gray-800 dark:text-red-400">
                {action.stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SimpleActionItem({
  action,
  startTime,
}: {
  action: BugReportAction;
  startTime: number;
}) {
  const { t } = useTranslation();

  const getLabel = () => {
    switch (action.type) {
      case 'navigation':
        return `→ Navigate: ${action.from} → ${action.to}`;
      case 'state_change':
        return `⚡ State: ${action.component} - ${action.change}`;
      case 'note':
        return `📝 ${action.text}`;
      case 'keyboard': {
        const combo = action.modifiers ? `${action.modifiers}+${action.key}` : action.key;
        return `⌨ Keyboard: ${combo}${action.target ? ` in ${action.target}` : ''}`;
      }
      case 'focus':
        return `🎯 Focus: ${action.label || action.target}${action.fieldType ? ` (${action.fieldType})` : ''}`;
      case 'input':
        return `✏ Input: ${action.label || action.target}${action.valueLength !== undefined ? ` (${action.valueLength} chars)` : ''}`;
      case 'scroll':
        return `↕ Scroll ${action.direction} to y=${action.scrollY}px`;
      default:
        return '•';
    }
  };

  const getColor = () => {
    switch (action.type) {
      case 'navigation':
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300';
      case 'note':
        return 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300';
      case 'keyboard':
        return 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300';
      case 'focus':
        return 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-300';
      case 'input':
        return 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-300';
      case 'scroll':
        return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-100/10 dark:text-gray-300';
    }
  };

  return (
    <div className={cn('flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs', getColor())}>
      <span className="shrink-0 font-mono opacity-70">{formatTime(action.timestamp, startTime)}</span>
      <span className="min-w-0 flex-1 break-words">{getLabel()}</span>
    </div>
  );
}

export default function ActionTimeline({
  actions,
  startTime,
  editable = false,
  onUpdate,
  className,
}: ActionTimelineProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  const sorted = useMemo(() => [...actions].sort((a, b) => a.timestamp - b.timestamp), [actions]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback((idx: number) => {
    if (!onUpdate) return;
    const updated = sorted.filter((_, i) => i !== idx);
    onUpdate(updated);
  }, [onUpdate, sorted]);

  const handleAddNote = useCallback(() => {
    if (!noteText.trim() || !onUpdate) return;
    const note: BugReportAction = {
      type: 'note',
      text: noteText.trim(),
      timestamp: Date.now(),
    };
    onUpdate([...actions, note]);
    setNoteText('');
    setAddingNote(false);
  }, [noteText, onUpdate, actions]);

  const getActionId = (action: BugReportAction, idx: number): string => {
    if (action.type === 'api_call') return `${(action as ApiCallAction).id}-${idx}`;
    return `${action.type}-${action.timestamp}-${idx}`;
  };

  if (sorted.length === 0 && !editable) {
    return (
      <Text className={cn('text-sm text-gray-500', className)}>
        {t('messages.bugReport.timeline.empty')}
      </Text>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-lg border border-muted p-2">
        {sorted.length === 0 && (
          <Text className="text-sm text-gray-500">{t('messages.bugReport.timeline.empty')}</Text>
        )}
        {sorted.map((action, idx) => {
          const actionId = getActionId(action, idx);
          const isExpanded = expandedIds.has(actionId);

          return (
            <div key={actionId} className="relative">
              {action.type === 'click' && (
                <ClickActionItem
                  action={action as ClickAction}
                  startTime={startTime}
                  allActions={sorted}
                  expanded={isExpanded}
                  onToggle={() => toggleExpanded(actionId)}
                />
              )}
              {action.type === 'api_call' && (
                <ApiCallActionItem
                  action={action as ApiCallAction}
                  startTime={startTime}
                  expanded={isExpanded}
                  onToggle={() => toggleExpanded(actionId)}
                  isTriggeredByClick={!!(action as ApiCallAction).triggeredByClick}
                />
              )}
              {action.type === 'error' && (
                <ErrorActionItem
                  action={action as ErrorAction}
                  startTime={startTime}
                  expanded={isExpanded}
                  onToggle={() => toggleExpanded(actionId)}
                />
              )}
              {!['click', 'api_call', 'error'].includes(action.type) && (
                <SimpleActionItem action={action} startTime={startTime} />
              )}

              {editable && (
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="absolute right-1 top-1 rounded p-0.5 opacity-30 hover:bg-red-100 hover:opacity-100 hover:text-red-600"
                  title={t('messages.bugReport.timeline.deleteAction', 'Remove')}
                >
                  <PiXBold className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <div>
          {addingNote ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNote();
                  if (e.key === 'Escape') {
                    setAddingNote(false);
                    setNoteText('');
                  }
                }}
                placeholder={t('messages.bugReport.timeline.notePlaceholder', 'Add a note…')}
                className="flex-1 rounded-lg border border-muted bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-50"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40"
                title={t('messages.bugReport.timeline.addNote', 'Add note')}
              >
                <PiCheckBold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingNote(false);
                  setNoteText('');
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-muted bg-white hover:bg-gray-50"
                title={t('common.cancel', 'Cancel')}
              >
                <PiXBold className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingNote(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary"
            >
              <PiNotePencilBold className="h-3.5 w-3.5" />
              {t('messages.bugReport.timeline.addNote', 'Add note')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
