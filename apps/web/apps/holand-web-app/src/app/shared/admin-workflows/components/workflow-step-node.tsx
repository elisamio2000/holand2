// ============================================
// WorkflowStepNode — Custom React Flow node (Enhanced)
// I/O ports, live preview, status glow, ComfyUI-inspired
// ============================================
'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Text } from 'rizzui';
import {
  PiPlayCircleBold,
  PiGearBold,
  PiGitBranchBold,
  PiClockBold,
  PiGitMergeBold,
  PiUserCheckBold,
  PiBrainBold,
  PiWrenchBold,
  PiArrowsClockwiseBold,
  PiFlagCheckeredBold,
  PiSpinnerBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiPauseBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiEyeBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import type { WorkflowNodeData } from '@/types/workflow.types';
import { STEP_META } from '../helpers/step-meta';

type StepNodeProps = NodeProps & {
  data: WorkflowNodeData;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PiPlayCircleBold,
  PiGearBold,
  PiGitBranchBold,
  PiClockBold,
  PiGitMergeBold,
  PiUserCheckBold,
  PiBrainBold,
  PiWrenchBold,
  PiArrowsClockwiseBold,
  PiFlagCheckeredBold,
};

const STATUS_CLASSES: Record<string, string> = {
  running: 'border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
  success: 'border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]',
  error: 'border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
  waiting: 'border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
};

function getStatusIcon(status?: string) {
  switch (status) {
    case 'running':
      return <PiSpinnerBold className="h-3 w-3 animate-spin text-blue-500" />;
    case 'success':
      return <PiCheckCircleBold className="h-3 w-3 text-green-500" />;
    case 'error':
      return <PiWarningCircleBold className="h-3 w-3 text-red-500" />;
    case 'waiting':
      return <PiPauseBold className="h-3 w-3 text-amber-500" />;
    case 'skipped':
      return <PiPauseBold className="h-3 w-3 text-gray-400" />;
    default:
      return null;
  }
}

/** Truncated preview of output data */
function OutputPreview({ data }: { data: unknown }) {
  if (!data) return null;
  const str =
    typeof data === 'string'
      ? data.slice(0, 120)
      : JSON.stringify(data).slice(0, 120);
  return (
    <div className="mt-2 rounded-md bg-gray-900/90 px-2 py-1.5">
      <pre className="overflow-hidden text-[8px] leading-tight text-green-400">
        {str}
        {str.length >= 120 && '...'}
      </pre>
    </div>
  );
}

function WorkflowStepNode({ data, selected }: StepNodeProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const meta = STEP_META[data.kind];
  const IconComponent = meta ? ICON_MAP[meta.icon] : PiGearBold;
  const color = meta?.color ?? '#6b7280';
  const statusIcon = getStatusIcon(data.status);
  const statusClass = data.status ? STATUS_CLASSES[data.status] : '';
  const isCondition = data.kind === 'condition';
  const hasOutput = data.result?.output != null;
  const hasError = !!data.result?.error;

  // Progress bar for running status
  const showProgress = data.status === 'running';

  return (
    <div
      className={cn(
        'group relative rounded-xl border-2 bg-white shadow-sm transition-all',
        'dark:bg-gray-100',
        collapsed ? 'min-w-[120px]' : 'min-w-[200px] max-w-[260px]',
        selected
          ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-50'
          : 'hover:shadow-md',
        statusClass
      )}
      style={{
        borderColor: statusClass ? undefined : selected ? undefined : `${color}40`,
      }}
    >
      {/* Running progress bar */}
      {showProgress && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-xl">
          <div className="h-full w-full animate-pulse bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400" />
        </div>
      )}

      {/* Input Handle */}
      {data.kind !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!-top-1.5 !h-3 !w-3 !rounded-full !border-2 !border-white !bg-gray-400 transition-colors group-hover:!bg-primary dark:!border-gray-100"
        />
      )}

      {/* Header bar with color accent */}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2"
        style={{ backgroundColor: `${color}08` }}
      >
        {/* Icon */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          {IconComponent && (
            <IconComponent className="h-4 w-4" style={{ color }} />
          )}
        </div>

        {/* Title + Status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Text className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">
              {data.label}
            </Text>
            {statusIcon}
          </div>
          <Text className="truncate text-[9px] text-gray-400">
            {t(meta?.label_key ?? 'workflow.nodes.action')}
          </Text>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          className="rounded p-0.5 text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-300"
        >
          {collapsed ? (
            <PiCaretDownBold className="h-3 w-3" />
          ) : (
            <PiCaretUpBold className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Body (collapsible) */}
      {!collapsed && (
        <div className="px-3 pb-2 pt-1">
          {/* Config summary */}
          {data.config.tool_id && (
            <div className="mb-1 flex items-center gap-1 rounded bg-gray-50 px-2 py-1 dark:bg-gray-200/30">
              <PiWrenchBold className="h-3 w-3 text-gray-400" />
              <Text className="truncate font-mono text-[9px] text-gray-500">
                {data.config.tool_id as string}
              </Text>
            </div>
          )}
          {data.config.route_key && (
            <div className="mb-1 flex items-center gap-1 rounded bg-gray-50 px-2 py-1 dark:bg-gray-200/30">
              <PiBrainBold className="h-3 w-3 text-gray-400" />
              <Text className="truncate font-mono text-[9px] text-gray-500">
                {data.config.route_key as string}
              </Text>
            </div>
          )}
          {data.kind === 'condition' && data.config.condition_expr && (
            <div className="mb-1 rounded bg-amber-50 px-2 py-1 dark:bg-amber-900/10">
              <Text className="font-mono text-[9px] text-amber-700 dark:text-amber-400">
                if ({data.config.condition_expr as string})
              </Text>
            </div>
          )}
          {data.kind === 'delay' && (
            <div className="mb-1 flex items-center gap-1 rounded bg-purple-50 px-2 py-1 dark:bg-purple-900/10">
              <PiClockBold className="h-3 w-3 text-purple-400" />
              <Text className="text-[9px] text-purple-600 dark:text-purple-400">
                {data.config.delay_seconds as number}s
              </Text>
            </div>
          )}

          {/* Duration + Preview toggle */}
          <div className="mt-1 flex items-center justify-between">
            {data.result?.duration_ms != null && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] font-medium text-gray-500 dark:bg-gray-200">
                {data.result.duration_ms}ms
              </span>
            )}
            {(hasOutput || hasError) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(!showPreview);
                }}
                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
              >
                <PiEyeBold className="h-2.5 w-2.5" />
                {showPreview ? 'hide' : 'preview'}
              </button>
            )}
          </div>

          {/* Live output preview (ComfyUI-style) */}
          {showPreview && hasOutput && (
            <OutputPreview data={data.result!.output} />
          )}
          {showPreview && hasError && (
            <div className="mt-1 rounded-md bg-red-950/90 px-2 py-1.5">
              <pre className="overflow-hidden text-[8px] leading-tight text-red-300">
                {data.result!.error!.slice(0, 100)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Output Handle */}
      {data.kind !== 'output' && !isCondition && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!-bottom-1.5 !h-3 !w-3 !rounded-full !border-2 !border-white !bg-gray-400 transition-colors group-hover:!bg-primary dark:!border-gray-100"
        />
      )}

      {/* Condition: two output handles with labels */}
      {isCondition && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!-bottom-1.5 !left-[30%] !h-3 !w-3 !rounded-full !border-2 !border-white !bg-green-500 dark:!border-gray-100"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!-bottom-1.5 !left-[70%] !h-3 !w-3 !rounded-full !border-2 !border-white !bg-red-500 dark:!border-gray-100"
          />
          <div className="flex justify-between px-3 pb-1 text-[8px]">
            <span className="font-medium text-green-500">True</span>
            <span className="font-medium text-red-500">False</span>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(WorkflowStepNode);
