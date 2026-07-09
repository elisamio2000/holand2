import type { Edge, Node } from '@xyflow/react';
import type {
  LlmEndpoint,
  LlmModel,
  LlmRole,
  LlmRoute,
  ServiceBinding,
  ToolBinding,
  ToolRegistryEntry,
} from '@/types/pipeline-admin.types';
import type { RemoteNodeRow } from '@/services/admin-remote-nodes.service';

export type TopologyLayoutAlgorithm = 'elk' | 'column' | 'radial';

export interface TopologyDisplaySettingsSnapshot {
  showNodeLabels?: boolean;
  showEdgeLabels?: boolean;
  healthOverlay?: boolean;
  snapToGrid?: boolean;
  snapGridSize?: number;
  showMinimap?: boolean;
  layoutAlgorithm?: TopologyLayoutAlgorithm;
  gridOpacity?: number;
  minimapAuto?: boolean;
  minimapThreshold?: number;
  inspectorWidth?: number;
  zenMode?: boolean;
  fullscreenMode?: boolean;
  clusterMode?: import('./topology-board-settings').TopologyClusterMode;
  showOrphanNodes?: boolean;
  nodeShapes?: import('./topology-node-shapes').TopologyNodeShapeMap;
}

export type TopologyEntityKind =
  | 'tool'
  | 'route'
  | 'role'
  | 'model'
  | 'endpoint'
  | 'remoteNode'
  | 'plugin'
  | 'service'
  | 'group';

export type TopologyEdgeKind =
  | 'primary'
  | 'loop'
  | 'success'
  | 'failure'
  | 'error_handler';

export interface TopologyNodeData extends Record<string, unknown> {
  kind: TopologyEntityKind;
  label: string;
  entityId: string;
  muted?: boolean;
  healthKind?: 'healthy' | 'unhealthy' | 'unknown' | 'disabled';
  binding?: ToolBinding;
  route?: Partial<LlmRoute>;
  role?: Partial<LlmRole>;
  model?: Partial<LlmModel>;
  endpoint?: Partial<LlmEndpoint>;
  remoteNode?: Partial<RemoteNodeRow>;
  serviceBinding?: Partial<ServiceBinding>;
  pluginId?: string;
  groupLabel?: string;
  groupColor?: string;
  collapsed?: boolean;
}

export interface TopologyEdgeData extends Record<string, unknown> {
  edgeKind: TopologyEdgeKind;
  label?: string;
  active?: boolean;
  invalid?: boolean;
  /** UI-only semantic until backend edge enum (e.g. register, deploy). */
  uiSemantic?: 'register' | 'deploy';
}

export type TopologyNode = Node<TopologyNodeData>;
export type TopologyEdge = Edge<TopologyEdgeData>;

export interface TopologyLayoutSnapshot {
  version: 3;
  viewport: { x: number; y: number; zoom: number };
  positions: Record<string, { x: number; y: number; z?: number }>;
  groups: Array<{ id: string; label: string; childIds: string[]; collapsed?: boolean }>;
  edgeUi: Record<string, { edgeKind: TopologyEdgeKind; label?: string; muted?: boolean }>;
  displaySettings?: TopologyDisplaySettingsSnapshot;
  /** Node ids placed manually from palette (may be unconnected). */
  manualPlacements?: string[];
  updatedAt: string;
}

export const TOPOLOGY_LAYOUT_KEY = 'pipeline-topology-layout:v3';

export interface TopologyPipelineData {
  models: LlmModel[];
  pools?: import('@/types/pipeline-admin.types').LlmPool[];
  endpoints: LlmEndpoint[];
  routes: LlmRoute[];
  roles: LlmRole[];
  tools: ToolRegistryEntry[];
  bindings: Record<string, ToolBinding>;
  pluginBindings: Record<string, ToolBinding>;
  serviceBindings: ServiceBinding[];
  remoteNodes: RemoteNodeRow[];
  logicalCatalog?: import('@/types/pipeline-admin.types').LogicalCatalogEntry[];
}

export function entityNodeId(kind: TopologyEntityKind, entityId: string): string {
  return `${kind}:${entityId}`;
}

export function parseEntityNodeId(id: string): { kind: TopologyEntityKind; entityId: string } | null {
  const idx = id.indexOf(':');
  if (idx <= 0) return null;
  const kind = id.slice(0, idx) as TopologyEntityKind;
  const valid: TopologyEntityKind[] = [
    'tool',
    'route',
    'role',
    'model',
    'endpoint',
    'remoteNode',
    'plugin',
    'service',
    'group',
  ];
  if (!valid.includes(kind)) return null;
  return { kind, entityId: id.slice(idx + 1) };
}
