// ============================================
// WorkflowInspector — Enhanced node property editor (right sidebar)
// Per-node I/O ports, advanced settings, ComfyUI-inspired
// Collapsible sections for organized settings
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useMemo, useState } from 'react';
import { Button, Input, Select, Text, Textarea, Badge, Switch } from 'rizzui';
import {
  PiTrashBold,
  PiCopyBold,
  PiInfoBold,
  PiCaretDownBold,
  PiCaretRightBold,
  PiPlugBold,
  PiPlugsConnectedBold,
  PiGearBold,
  PiShieldCheckBold,
  PiArrowRightBold,
  PiArrowLeftBold,
  PiClockBold,
  PiArrowsClockwiseBold,
  PiCodeBold,
  PiTagBold,
  PiPlayCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../store/workflow-store';
import { STEP_META } from '../helpers/step-meta';

const TRIGGER_TYPE_OPTIONS = [
  { label: 'Manual', value: 'manual' },
  { label: 'Schedule (Cron)', value: 'schedule' },
  { label: 'Event', value: 'event' },
  { label: 'Webhook', value: 'webhook' },
];

/** Collapsible section wrapper */
function Section({
  title,
  icon,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-muted last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
      >
        {open ? (
          <PiCaretDownBold className="h-3 w-3" />
        ) : (
          <PiCaretRightBold className="h-3 w-3" />
        )}
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1 text-start">{title}</span>
        {badge}
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  );
}

interface WorkflowInspectorProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function WorkflowInspector({
  isCollapsed,
  onToggleCollapse,
}: WorkflowInspectorProps) {
  const { t } = useTranslation();
  const {
    nodes,
    edges,
    selectedNodeId,
    updateNodeData,
    removeNode,
    duplicateNode,
  } = useWorkflowStore();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const connectedInputs = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter((e) => e.target === selectedNodeId)
      .map((e) => {
        const sourceNode = nodes.find((n) => n.id === e.source);
        return { edge: e, node: sourceNode };
      });
  }, [edges, nodes, selectedNodeId]);

  const connectedOutputs = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter((e) => e.source === selectedNodeId)
      .map((e) => {
        const targetNode = nodes.find((n) => n.id === e.target);
        return { edge: e, node: targetNode };
      });
  }, [edges, nodes, selectedNodeId]);

  // Collapsed state: thin sidebar with toggle
  if (isCollapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-s border-muted bg-white pt-3 dark:bg-gray-50">
        <Tooltip content={t('workflow.inspector.title')} placement="left">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
          >
            <PiArrowLeftBold className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="flex h-full w-72 flex-col border-s border-muted bg-white dark:bg-gray-50">
        <div className="flex items-center justify-between border-b border-muted p-3">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('workflow.inspector.title')}
          </Text>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
          >
            <PiArrowRightBold className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <PiInfoBold className="mx-auto h-8 w-8 text-gray-300" />
            <Text className="mt-2 text-xs text-gray-400">
              {t('workflow.inspector.noSelection')}
            </Text>
            <Text className="mt-1 text-[10px] text-gray-300">
              Click a node to edit its properties
            </Text>
          </div>
        </div>
      </div>
    );
  }

  const { data } = selectedNode;
  const meta = STEP_META[data.kind];

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, {
      config: { ...data.config, [key]: value },
    });
  };

  return (
    <div className="flex h-full w-72 flex-col border-s border-muted bg-white dark:bg-gray-50">
      {/* Header */}
      <div className="border-b border-muted p-3">
        <div className="flex items-center justify-between">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('workflow.inspector.title')}
          </Text>
          <div className="flex gap-1">
            <Tooltip content="Duplicate">
              <Button
                variant="text"
                size="sm"
                onClick={() => duplicateNode(selectedNode.id)}
                className="h-7 w-7 p-0"
              >
                <PiCopyBold className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Delete">
              <Button
                variant="text"
                color="danger"
                size="sm"
                onClick={() => removeNode(selectedNode.id)}
                className="h-7 w-7 p-0"
              >
                <PiTrashBold className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
            >
              <PiArrowRightBold className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Node type badge */}
        <div
          className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
          style={{ backgroundColor: `${meta?.color ?? '#6b7280'}10` }}
        >
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: meta?.color }}
          />
          <Text
            className="text-xs font-medium"
            style={{ color: meta?.color }}
          >
            {t(meta?.label_key ?? 'workflow.nodes.action')}
          </Text>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        {/* ========= I/O Ports Section (ComfyUI style) ========= */}
        <Section
          title="Connections"
          icon={<PiPlugsConnectedBold className="h-3.5 w-3.5" />}
          badge={
            <Badge variant="flat" size="sm" className="text-[9px]">
              {connectedInputs.length + connectedOutputs.length}
            </Badge>
          }
        >
          {/* Inputs */}
          <div>
            <Text className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-gray-400">
              <PiArrowLeftBold className="h-3 w-3" /> Inputs
            </Text>
            {connectedInputs.length > 0 ? (
              <div className="space-y-1">
                {connectedInputs.map(({ edge, node }) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-2 rounded bg-green-50 px-2 py-1 dark:bg-green-900/10"
                  >
                    <PiPlugBold className="h-3 w-3 text-green-500" />
                    <Text className="truncate text-[10px] font-medium">
                      {node?.data.label ?? edge.source}
                    </Text>
                    {edge.sourceHandle && (
                      <Badge variant="outline" size="sm" className="text-[8px]">
                        {edge.sourceHandle}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-[10px] text-gray-300">No inputs connected</Text>
            )}
          </div>

          {/* Outputs */}
          <div>
            <Text className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-gray-400">
              <PiArrowRightBold className="h-3 w-3" /> Outputs
            </Text>
            {connectedOutputs.length > 0 ? (
              <div className="space-y-1">
                {connectedOutputs.map(({ edge, node }) => (
                  <div
                    key={edge.id}
                    className="flex items-center gap-2 rounded bg-blue-50 px-2 py-1 dark:bg-blue-900/10"
                  >
                    <PiPlugBold className="h-3 w-3 text-blue-500" />
                    <Text className="truncate text-[10px] font-medium">
                      {node?.data.label ?? edge.target}
                    </Text>
                    {edge.sourceHandle && (
                      <Badge variant="outline" size="sm" className="text-[8px]">
                        {edge.sourceHandle}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-[10px] text-gray-300">No outputs connected</Text>
            )}
          </div>
        </Section>

        {/* ========= General Settings ========= */}
        <Section
          title="General"
          icon={<PiGearBold className="h-3.5 w-3.5" />}
        >
          <div>
            <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('workflow.inspector.label')}
            </Text>
            <Input
              size="sm"
              value={data.label}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { label: e.target.value })
              }
            />
          </div>

          <div>
            <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('workflow.inspector.description')}
            </Text>
            <Input
              size="sm"
              value={data.description ?? ''}
              onChange={(e) =>
                updateNodeData(selectedNode.id, {
                  description: e.target.value,
                })
              }
            />
          </div>
        </Section>

        {/* ========= Node-Specific Settings ========= */}
        <Section
          title="Configuration"
          icon={<PiCodeBold className="h-3.5 w-3.5" />}
        >
          {/* Trigger Type */}
          {data.kind === 'trigger' && (
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('workflow.inspector.triggerType')}
              </Text>
              <Select
                size="sm"
                options={TRIGGER_TYPE_OPTIONS}
                value={data.config.trigger_type || 'manual'}
                onChange={(opt: { value: string } | null) =>
                  updateConfig('trigger_type', opt?.value)
                }
              />
            </div>
          )}

          {data.kind === 'trigger' &&
            data.config.trigger_type === 'schedule' && (
              <div>
                <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('workflow.inspector.cronExpr')}
                </Text>
                <Input
                  size="sm"
                  placeholder="0 */5 * * *"
                  value={(data.config.cron_expr as string) ?? ''}
                  onChange={(e) => updateConfig('cron_expr', e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

          {/* Tool ID */}
          {(data.kind === 'tool_execute' || data.kind === 'action') && (
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('workflow.inspector.toolId')}
              </Text>
              <Input
                size="sm"
                placeholder="plugin_file_manager_list"
                value={(data.config.tool_id as string) ?? ''}
                onChange={(e) => updateConfig('tool_id', e.target.value)}
                className="font-mono"
              />
            </div>
          )}

          {/* LLM Call Fields */}
          {data.kind === 'llm_call' && (
            <>
              <div>
                <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('workflow.inspector.routeKey')}
                </Text>
                <Input
                  size="sm"
                  placeholder="chat.default"
                  value={(data.config.route_key as string) ?? ''}
                  onChange={(e) => updateConfig('route_key', e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('workflow.inspector.modelName')}
                </Text>
                <Input
                  size="sm"
                  placeholder="(auto)"
                  value={(data.config.model_name as string) ?? ''}
                  onChange={(e) => updateConfig('model_name', e.target.value)}
                  className="font-mono"
                />
              </div>
            </>
          )}

          {/* Condition */}
          {data.kind === 'condition' && (
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('workflow.inspector.conditionExpr')}
              </Text>
              <Input
                size="sm"
                placeholder="result.length > 0"
                value={(data.config.condition_expr as string) ?? ''}
                onChange={(e) =>
                  updateConfig('condition_expr', e.target.value)
                }
                className="font-mono"
              />
            </div>
          )}

          {/* Delay */}
          {data.kind === 'delay' && (
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('workflow.inspector.delaySeconds')}
              </Text>
              <Input
                size="sm"
                type="number"
                value={data.config.delay_seconds ?? 5}
                onChange={(e) =>
                  updateConfig('delay_seconds', Number(e.target.value))
                }
              />
            </div>
          )}

          {/* Loop */}
          {data.kind === 'loop' && (
            <>
              <div>
                <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('workflow.inspector.loopCollection')}
                </Text>
                <Input
                  size="sm"
                  placeholder="items"
                  value={
                    (data.config.loop_collection_key as string) ?? ''
                  }
                  onChange={(e) =>
                    updateConfig('loop_collection_key', e.target.value)
                  }
                />
              </div>
              <div>
                <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('workflow.inspector.maxIterations')}
                </Text>
                <Input
                  size="sm"
                  type="number"
                  value={data.config.max_iterations ?? 10}
                  onChange={(e) =>
                    updateConfig('max_iterations', Number(e.target.value))
                  }
                />
              </div>
            </>
          )}

          {/* Human Approval */}
          {data.kind === 'human' && (
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('workflow.inspector.approvalRoles')}
              </Text>
              <Input
                size="sm"
                placeholder="admin, manager"
                value={
                  Array.isArray(data.config.approval_roles)
                    ? (data.config.approval_roles as string[]).join(', ')
                    : ''
                }
                onChange={(e) =>
                  updateConfig(
                    'approval_roles',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
          )}
        </Section>

        {/* ========= Advanced Settings ========= */}
        {['tool_execute', 'llm_call', 'action'].includes(data.kind) && (
          <Section
            title="Advanced"
            icon={<PiShieldCheckBold className="h-3.5 w-3.5" />}
            defaultOpen={false}
          >
            <div>
              <Text className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <PiClockBold className="h-3 w-3" />
                {t('workflow.inspector.timeoutSeconds')}
              </Text>
              <Input
                size="sm"
                type="number"
                value={data.config.timeout_seconds ?? ''}
                onChange={(e) =>
                  updateConfig(
                    'timeout_seconds',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="30"
              />
            </div>
            <div>
              <Text className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <PiArrowsClockwiseBold className="h-3 w-3" />
                {t('workflow.inspector.retryCount')}
              </Text>
              <Input
                size="sm"
                type="number"
                value={data.config.retry_count ?? ''}
                onChange={(e) =>
                  updateConfig(
                    'retry_count',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="0"
              />
            </div>
          </Section>
        )}

        {/* ========= Arguments / Payload ========= */}
        {['tool_execute', 'action', 'llm_call'].includes(data.kind) && (
          <Section
            title="Arguments"
            icon={<PiCodeBold className="h-3.5 w-3.5" />}
            defaultOpen={false}
          >
            <div>
              <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('workflow.inspector.argsJson')}
              </Text>
              <Textarea
                size="sm"
                rows={5}
                placeholder='{"key": "value"}'
                value={
                  data.config.args
                    ? JSON.stringify(data.config.args, null, 2)
                    : ''
                }
                onChange={(e) => {
                  try {
                    const parsed = e.target.value.trim()
                      ? JSON.parse(e.target.value)
                      : undefined;
                    updateConfig('args', parsed);
                  } catch {
                    /* Let user continue typing invalid JSON */
                  }
                }}
                className="font-mono text-xs"
              />
              <Text className="mt-1 text-[9px] text-gray-300">
                Use {'{{variable}}'} for dynamic references
              </Text>
            </div>
          </Section>
        )}

        {/* ========= Execution Result ========= */}
        {data.result && (
          <Section
            title="Last Run"
            icon={<PiPlayCircleBold className="h-3.5 w-3.5" />}
            defaultOpen={false}
            badge={
              <Badge
                variant="flat"
                size="sm"
                color={data.status === 'success' ? 'success' : data.status === 'error' ? 'danger' : 'info'}
                className="text-[9px]"
              >
                {data.status}
              </Badge>
            }
          >
            {data.result.duration_ms != null && (
              <Text className="text-[10px] text-gray-500">
                Duration: <span className="font-mono font-semibold">{data.result.duration_ms}ms</span>
              </Text>
            )}
            {data.result.output != null && (
              <div>
                <Text className="mb-1 text-[10px] font-semibold uppercase text-gray-400">
                  Output
                </Text>
                <pre className="max-h-24 overflow-auto rounded-lg bg-gray-900 p-2 text-[9px] text-green-400">
                  {typeof data.result.output === 'string'
                    ? data.result.output
                    : JSON.stringify(data.result.output as object, null, 2)}
                </pre>
              </div>
            )}
            {data.result.error && (
              <div>
                <Text className="mb-1 text-[10px] font-semibold uppercase text-red-400">
                  Error
                </Text>
                <pre className="max-h-20 overflow-auto rounded-lg bg-red-950 p-2 text-[9px] text-red-300">
                  {data.result.error}
                </pre>
              </div>
            )}
          </Section>
        )}

        {/* ========= Metadata ========= */}
        <div className="border-t border-muted p-3">
          <Text className="text-[9px] text-gray-300">
            ID: <span className="font-mono">{selectedNode.id}</span>
          </Text>
          <Text className="text-[9px] text-gray-300">
            Position: ({Math.round(selectedNode.position.x)},{' '}
            {Math.round(selectedNode.position.y)})
          </Text>
        </div>
      </div>
    </div>
  );
}
