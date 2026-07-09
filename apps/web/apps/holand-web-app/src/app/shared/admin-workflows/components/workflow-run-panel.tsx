// ============================================
// WorkflowRunPanel — Advanced execution monitor (bottom drawer)
// Live step trace, output preview, timing, debug info
// Inspired by ComfyUI queue + n8n execution panel
// ============================================
'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Text, Loader } from 'rizzui';
import {
  PiPlayBold,
  PiStopBold,
  PiClockBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiSpinnerBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiTerminalBold,
  PiEyeBold,
  PiArrowRightBold,
  PiTrashBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../store/workflow-store';

interface WorkflowRunPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  onRun: () => void;
}

export default function WorkflowRunPanel({
  isExpanded,
  onToggle,
  onRun,
}: WorkflowRunPanelProps) {
  const { t } = useTranslation();
  const { nodes, runStatus, currentRun } = useWorkflowStore();
  const [activeTab, setActiveTab] = useState<'trace' | 'output' | 'debug'>(
    'trace'
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const executionNodes = useMemo(
    () => nodes.filter((n) => n.data.status && n.data.status !== 'idle'),
    [nodes]
  );

  const completedCount = useMemo(
    () => nodes.filter((n) => n.data.status === 'success').length,
    [nodes]
  );
  const errorCount = useMemo(
    () => nodes.filter((n) => n.data.status === 'error').length,
    [nodes]
  );
  const runningCount = useMemo(
    () => nodes.filter((n) => n.data.status === 'running').length,
    [nodes]
  );

  const totalDuration = useMemo(
    () =>
      nodes.reduce(
        (sum, n) => sum + (n.data.result?.duration_ms ?? 0),
        0
      ),
    [nodes]
  );

  const selectedStep = useMemo(
    () => nodes.find((n) => n.id === selectedStepId),
    [nodes, selectedStepId]
  );

  const statusColor =
    runStatus === 'completed'
      ? 'success'
      : runStatus === 'failed'
        ? 'danger'
        : runStatus === 'running'
          ? 'info'
          : 'secondary';

  return (
    <div
      className={cn(
        'border-t border-muted bg-white transition-all dark:bg-gray-50',
        isExpanded ? 'h-72' : 'h-10'
      )}
    >
      {/* Header bar — always visible */}
      <div className="flex h-10 items-center gap-2 border-b border-muted px-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 transition-colors hover:text-primary dark:text-gray-400"
        >
          {isExpanded ? (
            <PiCaretDownBold className="h-3 w-3" />
          ) : (
            <PiCaretUpBold className="h-3 w-3" />
          )}
          <PiTerminalBold className="h-3.5 w-3.5" />
          {t('workflow.runPanel.title')}
        </button>

        {/* Status badges */}
        {runStatus && (
          <Badge variant="flat" size="sm" color={statusColor} className="gap-1">
            {runStatus === 'running' && (
              <PiSpinnerBold className="h-3 w-3 animate-spin" />
            )}
            {runStatus === 'completed' && (
              <PiCheckCircleBold className="h-3 w-3" />
            )}
            {runStatus === 'failed' && (
              <PiWarningCircleBold className="h-3 w-3" />
            )}
            {t(`workflow.runPanel.${runStatus}`)}
          </Badge>
        )}

        {completedCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-green-600">
            <PiCheckCircleBold className="h-3 w-3" />
            {completedCount}
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-500">
            <PiWarningCircleBold className="h-3 w-3" />
            {errorCount}
          </span>
        )}
        {totalDuration > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <PiClockBold className="h-3 w-3" />
            {totalDuration}ms
          </span>
        )}

        <div className="flex-1" />

        {/* Run/Stop buttons */}
        <Button
          size="sm"
          variant={runStatus === 'running' ? 'outline' : 'solid'}
          color={runStatus === 'running' ? 'danger' : 'primary'}
          onClick={onRun}
          disabled={runStatus === 'running'}
          className="h-7 gap-1 px-3 text-xs"
        >
          {runStatus === 'running' ? (
            <>
              <PiSpinnerBold className="h-3 w-3 animate-spin" />
              {t('workflow.runPanel.running')}
            </>
          ) : (
            <>
              <PiPlayBold className="h-3 w-3" />
              {t('workflow.editor.run')}
            </>
          )}
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="flex h-[calc(100%-40px)]">
          {/* Left: Step Trace */}
          <div className="w-64 shrink-0 overflow-auto border-e border-muted">
            {/* Tabs */}
            <div className="flex border-b border-muted">
              {(['trace', 'output', 'debug'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors',
                    activeTab === tab
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Step List */}
            <div className="p-1.5">
              {executionNodes.length === 0 ? (
                <div className="py-8 text-center">
                  <Text className="text-xs text-gray-400">
                    {t('workflow.runPanel.noRuns')}
                  </Text>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {executionNodes.map((node, idx) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedStepId(node.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors',
                        selectedStepId === node.id
                          ? 'bg-primary/10 ring-1 ring-primary/20'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-200/30'
                      )}
                    >
                      {/* Step index */}
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-500 dark:bg-gray-200">
                        {idx + 1}
                      </span>

                      {/* Status icon */}
                      {node.data.status === 'running' && (
                        <PiSpinnerBold className="h-3 w-3 shrink-0 animate-spin text-blue-500" />
                      )}
                      {node.data.status === 'success' && (
                        <PiCheckCircleBold className="h-3 w-3 shrink-0 text-green-500" />
                      )}
                      {node.data.status === 'error' && (
                        <PiWarningCircleBold className="h-3 w-3 shrink-0 text-red-500" />
                      )}

                      {/* Label */}
                      <div className="min-w-0 flex-1">
                        <Text className="truncate text-[11px] font-medium">
                          {node.data.label}
                        </Text>
                        {node.data.result?.duration_ms != null && (
                          <Text className="text-[9px] text-gray-400">
                            {node.data.result.duration_ms}ms
                          </Text>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Detail / Output / Debug */}
          <div className="flex-1 overflow-auto p-3">
            {selectedStep ? (
              <div className="space-y-3">
                {/* Step Header */}
                <div className="flex items-center gap-2">
                  <Text className="text-sm font-semibold">
                    {selectedStep.data.label}
                  </Text>
                  <Badge
                    variant="flat"
                    size="sm"
                    color={
                      selectedStep.data.status === 'success'
                        ? 'success'
                        : selectedStep.data.status === 'error'
                          ? 'danger'
                          : 'info'
                    }
                  >
                    {selectedStep.data.status}
                  </Badge>
                </div>

                {/* Timing */}
                {selectedStep.data.result && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-100/50">
                      <Text className="text-[9px] text-gray-400">Duration</Text>
                      <Text className="font-mono text-xs font-semibold">
                        {selectedStep.data.result.duration_ms ?? '—'}ms
                      </Text>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-100/50">
                      <Text className="text-[9px] text-gray-400">Started</Text>
                      <Text className="font-mono text-[10px]">
                        {selectedStep.data.result.started_at
                          ? new Date(
                              selectedStep.data.result.started_at
                            ).toLocaleTimeString()
                          : '—'}
                      </Text>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-100/50">
                      <Text className="text-[9px] text-gray-400">Finished</Text>
                      <Text className="font-mono text-[10px]">
                        {selectedStep.data.result.finished_at
                          ? new Date(
                              selectedStep.data.result.finished_at
                            ).toLocaleTimeString()
                          : '—'}
                      </Text>
                    </div>
                  </div>
                )}

                {/* Output */}
                {activeTab === 'output' && selectedStep.data.result?.output != null && (
                  <div>
                    <Text className="mb-1 text-[10px] font-semibold uppercase text-gray-400">
                      Output
                    </Text>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-gray-900 p-3 text-[10px] text-green-400">
                      {typeof selectedStep.data.result.output === 'string'
                        ? selectedStep.data.result.output
                        : JSON.stringify(
                            selectedStep.data.result.output as object,
                            null,
                            2
                          )}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {selectedStep.data.result?.error && (
                  <div>
                    <Text className="mb-1 text-[10px] font-semibold uppercase text-red-400">
                      Error
                    </Text>
                    <pre className="max-h-24 overflow-auto rounded-lg bg-red-950 p-3 text-[10px] text-red-300">
                      {selectedStep.data.result.error}
                    </pre>
                  </div>
                )}

                {/* Debug: Config dump */}
                {activeTab === 'debug' && (
                  <div>
                    <Text className="mb-1 text-[10px] font-semibold uppercase text-gray-400">
                      Node Config
                    </Text>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-gray-900 p-3 text-[10px] text-gray-300">
                      {JSON.stringify(selectedStep.data.config, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Trace: Step flow */}
                {activeTab === 'trace' && (
                  <div>
                    <Text className="mb-1 text-[10px] font-semibold uppercase text-gray-400">
                      Execution Trace
                    </Text>
                    <div className="space-y-1">
                      {executionNodes.map((n, i) => (
                        <div
                          key={n.id}
                          className={cn(
                            'flex items-center gap-2 rounded px-2 py-1 text-[10px]',
                            n.id === selectedStep.id && 'bg-primary/10'
                          )}
                        >
                          <span className="w-4 text-right font-mono text-gray-400">
                            {i + 1}
                          </span>
                          {n.data.status === 'success' ? (
                            <PiCheckCircleBold className="h-3 w-3 text-green-500" />
                          ) : n.data.status === 'error' ? (
                            <PiWarningCircleBold className="h-3 w-3 text-red-500" />
                          ) : n.data.status === 'running' ? (
                            <PiSpinnerBold className="h-3 w-3 animate-spin text-blue-500" />
                          ) : (
                            <span className="h-3 w-3 rounded-full border border-gray-300" />
                          )}
                          <span className="font-medium">{n.data.label}</span>
                          {n.data.result?.duration_ms != null && (
                            <span className="text-gray-400">
                              {n.data.result.duration_ms}ms
                            </span>
                          )}
                          {i < executionNodes.length - 1 && (
                            <PiArrowRightBold className="h-2.5 w-2.5 text-gray-300" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <PiEyeBold className="mx-auto h-8 w-8 text-gray-300" />
                  <Text className="mt-2 text-xs text-gray-400">
                    Select a step to view details
                  </Text>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
