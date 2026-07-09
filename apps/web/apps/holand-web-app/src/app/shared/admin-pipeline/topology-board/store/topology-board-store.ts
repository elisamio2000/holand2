import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
} from '@xyflow/react';
import {
  type TopologyEdge,
  type TopologyEdgeKind,
  type TopologyNode,
  type TopologyPipelineData,
  entityNodeId,
} from '../helpers/topology-board-types';
import { hydrateConnectedSubgraph } from '../helpers/hydrate-from-api';
import type { EntityCatalogEntry } from '../helpers/topology-catalog';
import { buildEdgeStyle } from '../helpers/edge-styles';
import { validateConnection } from '../helpers/validate-connection';
import { persistTopologyLayout } from '../helpers/topology-layout-api';
import { loadTopologyLayout } from '../helpers/layout-storage';
import { ENTITY_REGISTRY } from '../helpers/entity-registry';
import { modelHealthKind } from '@/utils/model-health';
import {
  cloneSnap,
  diffSnaps,
  ensureLeadingFull,
  shouldUseFullSnapshot,
  stateAtIndex,
  type HistoryEntry,
} from '../helpers/history-delta';

const MAX_HISTORY = 40;

function dynamicMaxHistory(nodeCount: number): number {
  if (nodeCount > 80) return 15;
  if (nodeCount > 40) return 25;
  return MAX_HISTORY;
}
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 64;

type NodeChangeList = Parameters<typeof applyNodeChanges<TopologyNode>>[0];
type EdgeChangeList = Parameters<typeof applyEdgeChanges<TopologyEdge>>[0];

let pendingNodeChanges: NodeChangeList = [];
let pendingEdgeChanges: EdgeChangeList = [];
let flushScheduled = false;

function filterNodeChanges(changes: NodeChangeList, nodes: TopologyNode[]): NodeChangeList {
  return changes.filter((c) => {
    if (c.type === 'select') return false;
    if (c.type === 'dimensions') {
      const node = nodes.find((n) => n.id === c.id);
      const dims = 'dimensions' in c ? c.dimensions : undefined;
      if (node && dims && node.width != null && node.height != null) {
        if (
          Math.abs(node.width - dims.width) < 4 &&
          Math.abs(node.height - dims.height) < 4
        ) {
          return false;
        }
      }
    }
    return true;
  });
}

function hasMeaningfulNodeChanges(changes: NodeChangeList, nodes: TopologyNode[]): boolean {
  return filterNodeChanges(changes, nodes).some((c) => c.type !== 'dimensions');
}

function scheduleGraphFlush(set: (partial: Partial<TopologyBoardState>) => void, get: () => TopologyBoardState) {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    const rawNodeChanges = pendingNodeChanges;
    const edgeChanges = pendingEdgeChanges;
    pendingNodeChanges = [];
    pendingEdgeChanges = [];
    if (rawNodeChanges.length === 0 && edgeChanges.length === 0) return;

    const nodesBefore = get().nodes;
    const nodeChanges = filterNodeChanges(rawNodeChanges, nodesBefore);
    let nodes = nodesBefore;
    let edges = get().edges;
    if (nodeChanges.length > 0) {
      nodes = applyNodeChanges(nodeChanges, nodes);
    }
    if (edgeChanges.length > 0) {
      edges = applyEdgeChanges(edgeChanges, edges);
    }
    if (nodeChanges.length === 0 && edgeChanges.length === 0) return;

    const dirty =
      hasMeaningfulNodeChanges(rawNodeChanges, nodesBefore) ||
      edgeChanges.some((c) => c.type !== 'select');
    set({ nodes, edges, ...(dirty ? { isDirty: true } : {}) });
  });
}

interface TopologyBoardState {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  catalog: EntityCatalogEntry[];
  placedNodeIds: string[];
  manualPlacements: string[];
  pipelineData: TopologyPipelineData | null;
  isDirty: boolean;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  history: HistoryEntry[];
  historyIndex: number;
  graphVersion: number;
  advancedSettingsNodeId: string | null;

  openAdvancedSettings: (nodeId: string) => void;
  closeAdvancedSettings: () => void;

  onNodesChange: (changes: Parameters<typeof applyNodeChanges<TopologyNode>>[0]) => void;
  onEdgesChange: (changes: Parameters<typeof applyEdgeChanges<TopologyEdge>>[0]) => void;
  onConnect: (connection: Connection) => { ok: boolean; reason?: string };
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  toggleNodeSelection: (id: string) => void;
  setSelectedEdgeId: (id: string | null) => void;
  hydrate: (data: TopologyPipelineData) => void;
  setGraph: (nodes: TopologyNode[], edges: TopologyEdge[], pushHistory?: boolean) => void;
  addEntityNode: (
    kind: keyof typeof ENTITY_REGISTRY,
    entityId: string,
    label: string,
    position?: { x: number; y: number },
    dataPatch?: Partial<TopologyNode['data']>
  ) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  updateNodeData: (id: string, patch: Partial<TopologyNode['data']>) => void;
  toggleEdgeKind: (edgeId: string) => void;
  updateEdgeData: (edgeId: string, patch: Partial<TopologyEdge['data']>) => void;
  createGroupFromSelection: (label: string, color?: string) => void;
  duplicateNode: (id: string) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  persistLayout: () => void;
}

function nextEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useTopologyBoardStore = create<TopologyBoardState>((set, get) => ({
  nodes: [],
  edges: [],
  catalog: [],
  placedNodeIds: [],
  manualPlacements: [],
  pipelineData: null,
  isDirty: false,
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  history: [{ kind: 'full', snap: { nodes: [], edges: [] }, ts: Date.now() }],
  historyIndex: 0,
  graphVersion: 0,
  advancedSettingsNodeId: null,

  openAdvancedSettings: (nodeId) =>
    set({
      advancedSettingsNodeId: nodeId,
      selectedNodeId: nodeId,
      selectedNodeIds: [nodeId],
      selectedEdgeId: null,
    }),
  closeAdvancedSettings: () => set({ advancedSettingsNodeId: null }),

  onNodesChange: (changes) => {
    pendingNodeChanges.push(...changes);
    scheduleGraphFlush(set, get);
  },

  onEdgesChange: (changes) => {
    pendingEdgeChanges.push(...changes);
    scheduleGraphFlush(set, get);
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return { ok: false };
    const data = get().pipelineData;
    const sourceNode = get().nodes.find((n) => n.id === connection.source);
    const targetNode = get().nodes.find((n) => n.id === connection.target);
    const binding = sourceNode?.data.binding;
    const model =
      data?.models.find((m) => m.name === targetNode?.data.entityId) ?? undefined;
    const result = validateConnection(
      connection.source,
      connection.target,
      binding,
      model
    );
    if (!result.ok) return result;

    const existing = get().edges.filter((e) => e.source === connection.source);
    let edgeKind: TopologyEdgeKind = 'primary';
    if (existing.some((e) => (e.data?.edgeKind ?? 'primary') === 'primary')) {
      edgeKind = 'loop';
    }
    const targetName =
      targetNode?.data.kind === 'model' ? targetNode.data.entityId : '';
    const visual = buildEdgeStyle(edgeKind, targetName, data?.models ?? []);
    const newEdge: TopologyEdge = {
      id: nextEdgeId(),
      source: connection.source,
      target: connection.target,
      data: { edgeKind, active: true },
      ...visual,
    };
    get().setGraph(get().nodes, addEdge(newEdge, get().edges));
    return { ok: true };
  },

  setSelectedNodeId: (id) =>
    set({
      selectedNodeId: id,
      selectedNodeIds: id ? [id] : [],
      selectedEdgeId: null,
    }),
  setSelectedNodeIds: (ids) =>
    set({
      selectedNodeIds: ids,
      selectedNodeId: ids.length === 1 ? ids[0] : ids.length > 0 ? ids[ids.length - 1] : null,
      selectedEdgeId: null,
    }),
  toggleNodeSelection: (id) => {
    const current = get().selectedNodeIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    get().setSelectedNodeIds(next);
  },
  setSelectedEdgeId: (id) =>
    set({ selectedEdgeId: id, selectedNodeId: null, selectedNodeIds: [] }),

  hydrate: (data) => {
    const { catalog, nodes, edges, placedNodeIds } = hydrateConnectedSubgraph(data);
    const layoutManual = loadTopologyLayout()?.manualPlacements ?? [];
    set({
      pipelineData: data,
      catalog,
      placedNodeIds,
      manualPlacements: layoutManual,
      nodes,
      edges,
      isDirty: false,
      history: [{ kind: 'full', snap: cloneSnap({ nodes, edges }), ts: Date.now() }],
      historyIndex: 0,
      graphVersion: get().graphVersion + 1,
    });
    get().persistLayout();
  },

  setGraph: (nodes, edges, pushHistory = true) => {
    const placedNodeIds = nodes
      .filter((n) => n.data.kind !== 'group')
      .map((n) => n.id);
    if (pushHistory) {
      const prev = { nodes: get().nodes, edges: get().edges };
      const next = { nodes, edges };
      const delta = diffSnaps(prev, next);
      const base = get().history.slice(0, get().historyIndex + 1);
      const entry: HistoryEntry =
        !delta || shouldUseFullSnapshot(delta, nodes.length)
          ? { kind: 'full', snap: cloneSnap(next), ts: Date.now() }
          : { kind: 'delta', delta, ts: Date.now() };
      base.push(entry);
      const max = dynamicMaxHistory(nodes.length);
      const trimmed = ensureLeadingFull(base.length > max ? base.slice(-max) : base);
      set({
        nodes,
        edges,
        placedNodeIds,
        isDirty: true,
        history: trimmed,
        historyIndex: trimmed.length - 1,
      });
    } else {
      set({ nodes, edges, placedNodeIds });
    }
    get().persistLayout();
  },

  addEntityNode: (kind, entityId, label, position?, dataPatch?) => {
    if (kind === 'group') return;
    const id = entityNodeId(kind, entityId);
    if (get().placedNodeIds.includes(id)) return;
    const meta = ENTITY_REGISTRY[kind];
    const sameKind = get().nodes.filter((n) => n.data.kind === kind).length;
    const pipelineData = get().pipelineData;
    const baseData: TopologyNode['data'] = { kind, label, entityId, ...dataPatch };
    if (kind === 'tool' && pipelineData) {
      baseData.binding = pipelineData.bindings[entityId];
    }
    if (kind === 'route' && pipelineData) {
      baseData.route = pipelineData.routes.find((r) => r.route_key === entityId);
    }
    if (kind === 'model' && pipelineData) {
      const model = pipelineData.models.find((m) => m.name === entityId);
      baseData.model = model;
      if (model) baseData.healthKind = modelHealthKind(model);
    }
    const node: TopologyNode = {
      id,
      type: meta.nodeType,
      position: position ?? { x: meta.defaultX, y: 40 + sameKind * 72 },
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      data: baseData,
    };
    const placedNodeIds = [...get().placedNodeIds, id];
    const manualPlacements = get().manualPlacements.includes(id)
      ? get().manualPlacements
      : [...get().manualPlacements, id];
    get().setGraph([...get().nodes, node], get().edges);
    set({ placedNodeIds, manualPlacements });
  },

  removeNode: (id) => {
    get().setGraph(
      get().nodes.filter((n) => n.id !== id),
      get().edges.filter((e) => e.source !== id && e.target !== id)
    );
    const placedNodeIds = get().placedNodeIds.filter((x) => x !== id);
    const manualPlacements = get().manualPlacements.filter((x) => x !== id);
    if (get().selectedNodeId === id) {
      set({ selectedNodeId: null, selectedNodeIds: [], placedNodeIds, manualPlacements });
    } else {
      set({
        selectedNodeIds: get().selectedNodeIds.filter((x) => x !== id),
        placedNodeIds,
        manualPlacements,
      });
    }
  },

  removeEdge: (id) => {
    get().setGraph(
      get().nodes,
      get().edges.filter((e) => e.id !== id)
    );
    if (get().selectedEdgeId === id) set({ selectedEdgeId: null });
  },

  updateNodeData: (id, patch) => {
    get().setGraph(
      get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      get().edges
    );
  },

  toggleEdgeKind: (edgeId) => {
    const models = get().pipelineData?.models ?? [];
    get().setGraph(
      get().nodes,
      get().edges.map((e) => {
        if (e.id !== edgeId) return e;
        const nextKind: TopologyEdgeKind =
          e.data?.edgeKind === 'loop' ? 'primary' : 'loop';
        const targetNode = get().nodes.find((n) => n.id === e.target);
        const name = targetNode?.data.kind === 'model' ? targetNode.data.entityId : '';
        return {
          ...e,
          data: { ...e.data, edgeKind: nextKind },
          ...buildEdgeStyle(nextKind, name, models),
        } as TopologyEdge;
      })
    );
  },

  updateEdgeData: (edgeId, patch) => {
    get().setGraph(
      get().nodes,
      get().edges.map((e) =>
        e.id === edgeId ? ({ ...e, data: { ...e.data, ...patch } } as TopologyEdge) : e
      )
    );
  },

  createGroupFromSelection: (label, color = '#a855f7') => {
    const selectedIds = get().selectedNodeIds;
    const selected = get().nodes.filter((n) => selectedIds.includes(n.id));
    if (selected.length < 2) return;
    const groupId = entityNodeId('group', `g_${Date.now()}`);
    const minX = Math.min(...selected.map((n) => n.position.x));
    const minY = Math.min(...selected.map((n) => n.position.y));
    const maxX = Math.max(...selected.map((n) => n.position.x + (n.width ?? DEFAULT_NODE_WIDTH)));
    const maxY = Math.max(...selected.map((n) => n.position.y + (n.height ?? DEFAULT_NODE_HEIGHT)));
    const groupNode: TopologyNode = {
      id: groupId,
      type: 'topoGroup',
      position: { x: minX - 20, y: minY - 40 },
      width: maxX - minX + 60,
      height: maxY - minY + 80,
      style: {
        width: maxX - minX + 60,
        height: maxY - minY + 80,
        borderColor: color,
      },
      data: {
        kind: 'group',
        label,
        entityId: groupId,
        groupLabel: label,
        groupColor: color,
      },
    };
    const childNodes = get().nodes.map((n) =>
      selected.some((s) => s.id === n.id) ? { ...n, parentId: groupId, extent: 'parent' as const } : n
    );
    get().setGraph([...childNodes, groupNode], get().edges);
  },

  duplicateNode: (id) => {
    const source = get().nodes.find((n) => n.id === id);
    if (!source || source.data.kind === 'group') return;
    // Entity nodes mirror API records — duplication would create fake entities (T4).
  },

  undo: () => {
    const idx = get().historyIndex;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    const snap = stateAtIndex(get().history, newIdx);
    set({
      nodes: snap.nodes,
      edges: snap.edges,
      historyIndex: newIdx,
      isDirty: true,
      graphVersion: get().graphVersion + 1,
    });
    get().persistLayout();
  },

  redo: () => {
    const idx = get().historyIndex;
    if (idx >= get().history.length - 1) return;
    const newIdx = idx + 1;
    const snap = stateAtIndex(get().history, newIdx);
    set({
      nodes: snap.nodes,
      edges: snap.edges,
      historyIndex: newIdx,
      isDirty: true,
      graphVersion: get().graphVersion + 1,
    });
    get().persistLayout();
  },

  markClean: () => set({ isDirty: false }),

  persistLayout: () => {
    const positions: Record<string, { x: number; y: number }> = {};
    get().nodes.forEach((n) => {
      positions[n.id] = { x: n.position.x, y: n.position.y };
    });
    void persistTopologyLayout({
      positions,
      manualPlacements: get().manualPlacements,
    });
  },
}));
