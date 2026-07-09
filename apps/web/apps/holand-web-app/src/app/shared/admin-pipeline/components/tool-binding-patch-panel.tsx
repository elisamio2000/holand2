'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge, Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import type { LlmModel, ToolBinding, ToolRegistryEntry } from '@/types/pipeline-admin.types';
import { modelHealthKind, statusDotColor } from '@/utils/model-health';
import StatusDot from './status-dot';

interface ToolBindingPatchPanelProps {
  tools: ToolRegistryEntry[];
  selectedToolId: string;
  selectedTool: ToolRegistryEntry | null;
  binding: ToolBinding;
  bindingsMap?: Record<string, string>;
  models: LlmModel[];
  onBindingChange: (next: ToolBinding) => void;
  onToolSelect: (toolId: string) => void;
}

const GRID = {
  cols: 4,
  cellW: 138,
  cellH: 38,
  gap: 8,
  categoryGap: 18,
  padding: 20,
  focusW: 280,
  focusGap: 48,
  modelW: 200,
  modelH: 40,
  modelGap: 12,
  modelColumnGap: 56,
  minCanvasH: 480,
  maxCanvasH: 720,
} as const;

type RegistryToolData = {
  toolId: string;
  label: string;
  category?: string;
  isSelected: boolean;
  muted: boolean;
  isBound: boolean;
  boundModel?: string;
  usesLlm: boolean;
};

type FocusDetailData = {
  tool: ToolRegistryEntry;
  binding: ToolBinding;
  muted: boolean;
};

type ModelTargetData = {
  label: string;
  kind: ReturnType<typeof modelHealthKind>;
  invalid?: boolean;
  isSelected: boolean;
  muted: boolean;
  role: 'primary' | 'fallback' | null;
};

function groupToolsByCategory(tools: ToolRegistryEntry[]) {
  const groups = new Map<string, ToolRegistryEntry[]>();
  for (const tool of tools) {
    const key = tool.category?.trim() || 'general';
    const list = groups.get(key) ?? [];
    list.push(tool);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function computeToolMapLayout(tools: ToolRegistryEntry[]) {
  const groups = groupToolsByCategory(tools);
  const nodes: Array<{ tool: ToolRegistryEntry; x: number; y: number }> = [];
  let y = GRID.padding;

  for (const [, items] of groups) {
    items.sort((a, b) => a.tool_id.localeCompare(b.tool_id));
    items.forEach((tool, index) => {
      const col = index % GRID.cols;
      const row = Math.floor(index / GRID.cols);
      nodes.push({
        tool,
        x: GRID.padding + col * (GRID.cellW + GRID.gap),
        y: y + row * (GRID.cellH + GRID.gap),
      });
    });
    const rows = Math.ceil(items.length / GRID.cols);
    y += rows * (GRID.cellH + GRID.gap) + GRID.categoryGap;
  }

  const mapWidth = GRID.padding * 2 + GRID.cols * GRID.cellW + (GRID.cols - 1) * GRID.gap;
  const mapHeight = Math.max(y, GRID.padding + GRID.cellH);
  return { nodes, mapWidth, mapHeight };
}

function RegistryToolNode({ data }: { data: RegistryToolData }) {
  return (
    <div
      className={cn(
        'relative rounded-lg border-2 bg-white px-2 py-1.5 text-start shadow-sm transition-all dark:bg-gray-50',
        data.isSelected
          ? 'z-10 border-primary bg-primary/5 shadow-md ring-2 ring-primary/30'
          : data.isBound
            ? 'border-emerald-300'
            : 'border-blue-200',
        data.muted && 'pointer-events-auto opacity-35 saturate-50',
        !data.usesLlm && 'border-dashed border-gray-300 opacity-60'
      )}
      style={{ width: GRID.cellW, minHeight: GRID.cellH }}
    >
      <Handle
        type="source"
        position={Position.Right}
        className={cn('!bg-primary', data.muted && '!opacity-30')}
        isConnectable={data.isSelected && data.usesLlm}
      />
      <Text
        className={cn(
          'truncate font-mono text-[10px]',
          data.isSelected ? 'font-bold text-primary' : 'font-semibold text-gray-800'
        )}
      >
        {data.label}
      </Text>
      {data.isBound && data.boundModel ? (
        <Text className="truncate text-[9px] text-emerald-600">{data.boundModel}</Text>
      ) : null}
    </div>
  );
}

function FocusDetailNode({ data }: { data: FocusDetailData }) {
  const { t } = useTranslation();
  const { tool, binding } = data;

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/60 bg-white p-4 shadow-lg transition-opacity dark:bg-gray-50',
        data.muted && 'opacity-40'
      )}
      style={{ width: GRID.focusW }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge size="sm" variant="flat" color="primary">
          {t('pipeline.tools.toolId', 'Tool')}
        </Badge>
        {tool.category ? (
          <Badge size="sm" variant="outline">
            {tool.category}
          </Badge>
        ) : null}
      </div>
      <Text className="font-mono text-sm font-bold text-gray-900">{tool.tool_id}</Text>
      {tool.description ? (
        <Text className="mt-2 max-h-28 overflow-y-auto text-xs leading-relaxed text-gray-600">
          {tool.description}
        </Text>
      ) : null}
      <div className="mt-3 space-y-2 border-t border-muted pt-3">
        <DetailRow label={t('pipeline.tools.apiEndpoint', 'API')} value={binding.api ?? 'chat'} />
        <DetailRow
          label={t('pipeline.tools.boundModel', 'Bound model')}
          value={binding.model?.trim() || t('pipeline.tools.noBinding', 'Unbound')}
          highlight={Boolean(binding.model?.trim())}
        />
        {binding.fallback_model ? (
          <DetailRow
            label={t('llmPage.tools.fallbackModelLabel', 'Fallback')}
            value={binding.fallback_model}
          />
        ) : null}
        {(binding.input_modalities?.length ?? 0) > 0 ? (
          <ModalityRow
            label={t('pipeline.tools.inputModalities', 'Input')}
            values={binding.input_modalities ?? []}
          />
        ) : null}
        {(binding.output_modalities?.length ?? 0) > 0 ? (
          <ModalityRow
            label={t('pipeline.tools.outputModalities', 'Output')}
            values={binding.output_modalities ?? []}
          />
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <Text className="shrink-0 text-gray-500">{label}</Text>
      <Text className={cn('text-end font-medium', highlight && 'text-primary')}>{value}</Text>
    </div>
  );
}

function ModalityRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Text className="text-[10px] text-gray-500">{label}</Text>
      {values.map((v) => (
        <Badge key={v} size="sm" variant="flat" color="secondary" className="font-mono text-[9px]">
          {v}
        </Badge>
      ))}
    </div>
  );
}

function ModelTargetNode({ data }: { data: ModelTargetData }) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-white px-3 py-2 shadow-sm transition-all dark:bg-gray-50',
        data.invalid
          ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
          : data.isSelected
            ? 'border-orange-400 shadow-md ring-2 ring-orange-300/40'
            : 'border-orange-200',
        data.muted && 'opacity-30 saturate-50',
        data.role === 'fallback' && data.isSelected && 'border-purple-400 ring-purple-300/40'
      )}
      style={{ width: GRID.modelW, minHeight: GRID.modelH }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-orange-500"
        isConnectable={!data.muted}
      />
      <div className="flex items-center gap-2">
        <StatusDot color={statusDotColor(data.kind)} size="sm" pulse={data.kind === 'healthy'} />
        <Text className={cn('truncate text-xs', data.isSelected && 'font-semibold')}>
          {data.label}
        </Text>
      </div>
      {data.role && data.isSelected ? (
        <Text className="mt-0.5 text-[9px] uppercase tracking-wide text-gray-500">
          {data.role === 'primary' ? 'primary' : 'fallback'}
        </Text>
      ) : null}
    </div>
  );
}

const nodeTypes = {
  registryTool: RegistryToolNode,
  focusDetail: FocusDetailNode,
  modelTarget: ModelTargetNode,
};

function bindingMatchesModel(binding: ToolBinding, model: LlmModel): boolean {
  const api = binding.api ?? 'chat';
  const taskForApi =
    api === 'embed' ? 'embed' : api === 'image' ? 'image' : 'chat';
  return model.task === taskForApi || model.task === 'chat';
}

function PatchPanelCanvas({
  tools,
  selectedToolId,
  selectedTool,
  binding,
  bindingsMap = {},
  models,
  onBindingChange,
  onToolSelect,
}: ToolBindingPatchPanelProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const undoStack = useRef<ToolBinding[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);

  const pushUndo = useCallback((prev: ToolBinding) => {
    undoStack.current = [...undoStack.current.slice(-9), prev];
  }, []);

  const activeModels = useMemo(
    () => models.filter((m) => m.is_active),
    [models]
  );

  const toolLayout = useMemo(() => computeToolMapLayout(tools), [tools]);

  const selectedPosition = useMemo(() => {
    const hit = toolLayout.nodes.find((n) => n.tool.tool_id === selectedToolId);
    return hit ?? { x: GRID.padding, y: GRID.padding };
  }, [toolLayout, selectedToolId]);

  const modelColumnX =
    toolLayout.mapWidth + GRID.focusGap + GRID.focusW + GRID.modelColumnGap;

  const modelStackHeight =
    activeModels.length * GRID.modelH +
    Math.max(0, activeModels.length - 1) * GRID.modelGap;

  const canvasHeight = Math.min(
    GRID.maxCanvasH,
    Math.max(GRID.minCanvasH, toolLayout.mapHeight + GRID.padding, modelStackHeight + GRID.padding * 2)
  );

  const modelStartY = Math.max(GRID.padding, (canvasHeight - modelStackHeight) / 2);
  const focusY = Math.max(
    GRID.padding,
    Math.min(selectedPosition.y, canvasHeight - 220)
  );
  const focusX = toolLayout.mapWidth + GRID.focusGap;

  const connectedModels = useMemo(() => {
    const set = new Set<string>();
    if (binding.model?.trim()) set.add(binding.model.trim());
    if (binding.fallback_model?.trim()) set.add(binding.fallback_model.trim());
    return set;
  }, [binding.model, binding.fallback_model]);

  const nodes: Node[] = useMemo(() => {
    const result: Node[] = toolLayout.nodes.map(({ tool, x, y }) => {
      const boundModel =
        bindingsMap[tool.tool_id] ?? (tool as ToolRegistryEntry & { bound_model?: string }).bound_model;
      const isSelected = tool.tool_id === selectedToolId;
      return {
        id: `tool-${tool.tool_id}`,
        type: 'registryTool',
        position: { x, y },
        data: {
          toolId: tool.tool_id,
          label: tool.tool_id,
          category: tool.category,
          isSelected,
          muted: !isSelected,
          isBound: Boolean(boundModel),
          boundModel: boundModel ?? undefined,
          usesLlm: (tool as ToolRegistryEntry & { uses_llm?: boolean }).uses_llm !== false,
        } satisfies RegistryToolData,
        draggable: false,
        selectable: false,
        zIndex: isSelected ? 20 : 1,
      };
    });

    if (selectedTool) {
      result.push({
        id: 'focus-detail',
        type: 'focusDetail',
        position: { x: focusX, y: focusY },
        data: {
          tool: selectedTool,
          binding,
          muted: false,
        } satisfies FocusDetailData,
        draggable: false,
        selectable: false,
        zIndex: 30,
      });
    }

    activeModels.forEach((m, i) => {
      const isConnected = connectedModels.has(m.name);
      const role =
        binding.model === m.name ? 'primary' : binding.fallback_model === m.name ? 'fallback' : null;
      result.push({
        id: m.name,
        type: 'modelTarget',
        position: {
          x: modelColumnX,
          y: modelStartY + i * (GRID.modelH + GRID.modelGap),
        },
        data: {
          label: m.name,
          kind: modelHealthKind(m),
          invalid: isConnected && !bindingMatchesModel(binding, m),
          isSelected: isConnected,
          muted: !isConnected,
          role,
        } satisfies ModelTargetData,
        draggable: false,
        selectable: false,
        zIndex: isConnected ? 15 : 2,
      });
    });

    return result;
  }, [
    toolLayout,
    selectedToolId,
    selectedTool,
    binding,
    bindingsMap,
    activeModels,
    connectedModels,
    focusX,
    focusY,
    modelColumnX,
    modelStartY,
  ]);

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    const sourceId = `tool-${selectedToolId}`;

    if (binding.model?.trim()) {
      const model = activeModels.find((m) => m.name === binding.model);
      const invalid = model ? !bindingMatchesModel(binding, model) : false;
      result.push({
        id: 'wire-primary',
        source: sourceId,
        target: binding.model,
        animated: !invalid,
        style: {
          stroke: invalid ? '#ef4444' : 'var(--primary-default, #6366f1)',
          strokeWidth: isConnectedHighlight(binding.model) ? 2.5 : 2,
          opacity: 1,
        },
        zIndex: 10,
      });
    }
    if (binding.fallback_model?.trim()) {
      result.push({
        id: 'wire-fallback',
        source: sourceId,
        target: binding.fallback_model,
        animated: false,
        style: {
          stroke: '#a855f7',
          strokeWidth: 2,
          strokeDasharray: '6 4',
          opacity: 1,
        },
        zIndex: 9,
      });
    }
    return result;

    function isConnectedHighlight(name: string) {
      return connectedModels.has(name);
    }
  }, [binding, activeModels, selectedToolId, connectedModels]);

  useEffect(() => {
    const focusIds = [`tool-${selectedToolId}`, 'focus-detail'];
    if (binding.model?.trim()) focusIds.push(binding.model);
    if (binding.fallback_model?.trim()) focusIds.push(binding.fallback_model);

    const timer = window.setTimeout(() => {
      fitView({
        nodes: focusIds.map((id) => ({ id })),
        padding: 0.18,
        duration: 320,
        maxZoom: 1,
        minZoom: 0.55,
      });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [selectedToolId, binding.model, binding.fallback_model, fitView]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.target) return;
      const model = activeModels.find((m) => m.name === connection.target);
      if (model && !bindingMatchesModel(binding, model)) {
        setConnectError(t('pipeline.tools.connectValidation', 'API/task mismatch for this model'));
        return;
      }
      setConnectError(null);
      pushUndo(binding);
      onBindingChange({ ...binding, model: connection.target });
    },
    [binding, activeModels, onBindingChange, pushUndo, t]
  );

  const handleUndo = () => {
    const prev = undoStack.current.pop();
    if (prev) onBindingChange(prev);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text className="text-xs text-gray-500">{t('pipeline.tools.patchPanelHint')}</Text>
        <Button size="sm" variant="outline" onClick={handleUndo} disabled={undoStack.current.length === 0}>
          {t('common.undo', 'Undo')}
        </Button>
      </div>
      {connectError ? <Text className="text-xs text-red-500">{connectError}</Text> : null}
      <div
        className="rounded-xl border border-muted bg-gray-0 dark:bg-gray-50"
        style={{ height: canvasHeight }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            if (node.type !== 'registryTool') return;
            const data = node.data as RegistryToolData;
            onToolSelect(data.toolId);
          }}
          nodesConnectable
          elementsSelectable={false}
          nodesDraggable={false}
          panOnScroll
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function ToolBindingPatchPanel(props: ToolBindingPatchPanelProps) {
  return (
    <ReactFlowProvider>
      <PatchPanelCanvas {...props} />
    </ReactFlowProvider>
  );
}
