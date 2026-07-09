'use client';

import { useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge, Input, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { PiProhibitBold } from 'react-icons/pi';
import StatusDot from '../../components/status-dot';
import { statusDotColor } from '@/utils/model-health';
import type { TopologyEntityKind, TopologyNodeData } from '../helpers/topology-board-types';
import { ENTITY_REGISTRY } from '../helpers/entity-registry';
import { useTopologyBoardStore } from '../store/topology-board-store';
import { useTopologyBoardSettingsStore } from '../helpers/topology-board-settings';
import {
  getNodeShapeForKind,
  isClipPathShape,
  nodeShapeStyle,
} from '../helpers/topology-node-shapes';

function KindLabel({ kind, className }: { kind: keyof typeof ENTITY_REGISTRY; className?: string }) {
  const { t } = useTranslation();
  const meta = ENTITY_REGISTRY[kind];
  return <Text className={className}>{t(meta.i18nKey, meta.label)}</Text>;
}

function useEntityShape(kind: TopologyEntityKind) {
  const nodeShapes = useTopologyBoardSettingsStore((s) => s.nodeShapes);
  return getNodeShapeForKind(kind, nodeShapes);
}

function BypassToggle({ nodeId, muted }: { nodeId?: string; muted?: boolean }) {
  const updateNodeData = useTopologyBoardStore((s) => s.updateNodeData);
  if (!nodeId) return null;
  return (
    <button
      type="button"
      className={cn(
        'absolute -right-1 -top-1 z-10 rounded-full border bg-white p-0.5 shadow-sm dark:bg-gray-100',
        muted && 'border-amber-400 text-amber-600'
      )}
      onClick={(e) => {
        e.stopPropagation();
        updateNodeData(nodeId, { muted: !muted });
      }}
      title="Bypass"
    >
      <PiProhibitBold className="h-3 w-3" />
    </button>
  );
}

function PrimaryWidgets({ data }: { data: TopologyNodeData }) {
  if (data.kind === 'tool' || data.kind === 'plugin') {
    const model = data.binding?.model;
    const api = data.binding?.api;
    if (!model && !api) return null;
    return (
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        {model && (
          <Badge variant="flat" size="sm" className="max-w-[120px] truncate text-[9px]">
            {model}
          </Badge>
        )}
        {api && (
          <Badge variant="outline" size="sm" className="text-[9px]">
            {api}
          </Badge>
        )}
      </div>
    );
  }
  if (data.kind === 'route' && data.route?.model_name) {
    return (
      <Badge variant="flat" size="sm" className="mt-1 text-[9px]" color="success">
        {data.route.model_name}
      </Badge>
    );
  }
  return null;
}

function ShapedNodeShell({
  kind,
  data,
  selected,
  borderClass,
  labelClass,
  children,
  handles,
  nodeId,
  align = 'start',
}: {
  kind: TopologyEntityKind;
  data: TopologyNodeData;
  selected?: boolean;
  borderClass: string;
  labelClass: string;
  children: React.ReactNode;
  handles: React.ReactNode;
  nodeId?: string;
  align?: 'start' | 'center';
}) {
  const shape = useEntityShape(kind);
  const clip = isClipPathShape(shape);
  const shapeStyle = nodeShapeStyle(shape);

  return (
    <div
      className={cn(
        'relative min-w-[140px]',
        selected && clip && 'drop-shadow-md',
        data.muted && 'opacity-50'
      )}
    >
      <BypassToggle nodeId={nodeId} muted={data.muted} />
      {handles}
      <div
        className={cn(
          'flex min-h-[48px] border-2 bg-white dark:bg-gray-50',
          borderClass,
          data.muted && 'border-dashed',
          !clip && 'rounded-lg shadow-sm',
          !clip && selected && 'ring-2 ring-primary/40',
          align === 'center' ? 'items-center justify-center px-2 py-2' : 'flex-col px-3 py-2',
          shape === 'circle' && 'items-center justify-center text-center'
        )}
        style={shapeStyle}
      >
        <KindLabel kind={kind} className={cn('text-[10px] font-semibold uppercase', labelClass)} />
        {children}
      </div>
      <PrimaryWidgets data={data} />
    </div>
  );
}

export function TopoToolNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="tool"
      data={data}
      selected={selected}
      borderClass="border-blue-400"
      labelClass="text-blue-600"
      nodeId={id}
      handles={<Handle type="source" position={Position.Right} className="!bg-blue-500" />}
    >
      <Text className="truncate font-mono text-xs">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoRouteNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="route"
      data={data}
      selected={selected}
      borderClass="border-green-400"
      labelClass="text-green-700"
      nodeId={id}
      align="center"
      handles={
        <>
          <Handle type="source" position={Position.Right} className="!bg-green-500" />
          <Handle type="source" id="true" position={Position.Bottom} className="!bg-emerald-500" />
          <Handle type="source" id="false" position={Position.Top} className="!bg-red-400" />
        </>
      }
    >
      <Text className="max-w-[110px] truncate font-mono text-[10px]">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoRoleNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="role"
      data={data}
      selected={selected}
      borderClass="border-green-300"
      labelClass="text-green-600"
      nodeId={id}
      handles={<Handle type="source" position={Position.Right} className="!bg-green-500" />}
    >
      <Text className="truncate font-mono text-xs">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoModelNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  const kind = data.healthKind ?? 'unknown';
  return (
    <ShapedNodeShell
      kind="model"
      data={data}
      selected={selected}
      borderClass="border-orange-400"
      labelClass="text-orange-600"
      nodeId={id}
      handles={<Handle type="target" position={Position.Left} className="!bg-orange-500" />}
    >
      <div className="flex items-center gap-2">
        <StatusDot color={statusDotColor(kind)} size="sm" pulse={kind === 'healthy'} />
        <Text className="truncate text-xs">{data.label}</Text>
      </div>
    </ShapedNodeShell>
  );
}

export function TopoEndpointNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="endpoint"
      data={data}
      selected={selected}
      borderClass="border-indigo-400"
      labelClass="text-indigo-600"
      nodeId={id}
      handles={
        <>
          <Handle type="target" position={Position.Left} className="!bg-indigo-500" />
          <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
        </>
      }
    >
      <Text className="truncate text-xs">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoRemoteNodeNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="remoteNode"
      data={data}
      selected={selected}
      borderClass="border-cyan-400"
      labelClass="text-cyan-700"
      nodeId={id}
      handles={<Handle type="source" position={Position.Right} className="!bg-cyan-500" />}
    >
      <Text className="truncate text-xs">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoPluginNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="plugin"
      data={data}
      selected={selected}
      borderClass="border-sky-400"
      labelClass="text-sky-600"
      nodeId={id}
      handles={<Handle type="source" position={Position.Right} className="!bg-sky-500" />}
    >
      <Text className="truncate font-mono text-xs">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoServiceNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  return (
    <ShapedNodeShell
      kind="service"
      data={data}
      selected={selected}
      borderClass="border-gray-400"
      labelClass="text-gray-600"
      nodeId={id}
      handles={<Handle type="source" position={Position.Right} className="!bg-gray-500" />}
    >
      <Text className="truncate font-mono text-xs">{data.label}</Text>
    </ShapedNodeShell>
  );
}

export function TopoGroupNode({
  id,
  data,
  selected,
}: {
  id?: string;
  data: TopologyNodeData;
  selected?: boolean;
}) {
  const updateNodeData = useTopologyBoardStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const borderColor = data.groupColor ?? '#a855f7';

  const commitLabel = useCallback(
    (value: string) => {
      if (!id) return;
      const label = value.trim() || data.label;
      updateNodeData(id, { groupLabel: label, label });
      setEditing(false);
    },
    [id, data.label, updateNodeData]
  );

  return (
    <div
      className={cn(
        'h-full w-full rounded-xl border-2 bg-gradient-to-br from-purple-50/60 to-purple-100/20 p-3 shadow-inner dark:from-purple-950/30 dark:to-purple-900/10',
        data.collapsed && 'opacity-80',
        selected && 'ring-2 ring-primary/30'
      )}
      style={{ borderColor }}
    >
      {editing ? (
        <Input
          size="sm"
          autoFocus
          defaultValue={data.groupLabel ?? data.label}
          className="text-xs font-bold uppercase"
          onBlur={(e) => commitLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitLabel((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          className="w-full text-left"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          <Text
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: borderColor }}
          >
            {data.groupLabel ?? data.label}
          </Text>
        </button>
      )}
      <Text className="mt-1 text-[10px] text-purple-600/70">Cluster</Text>
    </div>
  );
}

export const topologyNodeTypes = {
  topoTool: TopoToolNode,
  topoRoute: TopoRouteNode,
  topoRole: TopoRoleNode,
  topoModel: TopoModelNode,
  topoEndpoint: TopoEndpointNode,
  topoRemoteNode: TopoRemoteNodeNode,
  topoPlugin: TopoPluginNode,
  topoService: TopoServiceNode,
  topoGroup: TopoGroupNode,
};
