// ============================================
// Workflow Zustand Store — Central state for workflow editor
// Manages nodes, edges, selection, dirty state, and execution
// ============================================

import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import type {
  WorkflowNodeData,
  WorkflowEdgeData,
  WorkflowDefinition,
  WorkflowRunStatus,
  WorkflowRun,
  WorkflowNodeStatus,
} from '@/types/workflow.types';

const LOG_TAG = '[WorkflowStore]';

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge<WorkflowEdgeData>;

interface WorkflowState {
  // Graph state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange<WorkflowEdge>;
  onConnect: OnConnect;

  // Workflow metadata
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;
  isDirty: boolean;

  // Selection
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Execution
  runStatus: WorkflowRunStatus | null;
  currentRun: WorkflowRun | null;
  setRunStatus: (status: WorkflowRunStatus | null) => void;
  setNodeStatus: (nodeId: string, status: WorkflowNodeStatus) => void;

  // Actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  loadWorkflow: (workflow: WorkflowDefinition) => void;
  resetWorkflow: () => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (desc: string) => void;
  markClean: () => void;

  // Serialization
  toDefinition: () => WorkflowDefinition;
}

let nodeIdCounter = 0;
function nextNodeId(): string {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

function nextEdgeId(): string {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  workflowId: null,
  workflowName: '',
  workflowDescription: '',
  isDirty: false,
  selectedNodeId: null,
  runStatus: null,
  currentRun: null,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        { ...connection, id: nextEdgeId(), type: 'smoothstep', animated: true },
        get().edges
      ),
      isDirty: true,
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setRunStatus: (status) => set({ runStatus: status }),

  setNodeStatus: (nodeId, status) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, status } }
          : n
      ),
    });
  },

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  addNode: (node) => {
    console.info(LOG_TAG, 'Adding node:', node.data.kind);
    set({
      nodes: [...get().nodes, { ...node, id: node.id || nextNodeId() }],
      isDirty: true,
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    });
  },

  removeNode: (nodeId) => {
    console.info(LOG_TAG, 'Removing node:', nodeId);
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId:
        get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      isDirty: true,
    });
  },

  duplicateNode: (nodeId) => {
    const original = get().nodes.find((n) => n.id === nodeId);
    if (!original) return;
    const newId = nextNodeId();
    const newNode: WorkflowNode = {
      ...original,
      id: newId,
      position: {
        x: original.position.x + 50,
        y: original.position.y + 50,
      },
      data: {
        ...original.data,
        label: `${original.data.label} (copy)`,
        status: 'idle',
        result: null,
      },
      selected: false,
    };
    console.info(LOG_TAG, 'Duplicating node:', nodeId, '→', newId);
    set({
      nodes: [...get().nodes, newNode],
      isDirty: true,
    });
  },

  loadWorkflow: (workflow) => {
    console.info(LOG_TAG, 'Loading workflow:', workflow.name);
    set({
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowDescription: workflow.description ?? '',
      nodes: workflow.nodes.map((n) => ({
        ...n,
        type: n.type || 'workflowStep',
      })) as WorkflowNode[],
      edges: workflow.edges.map((e) => ({
        ...e,
        type: e.type || 'smoothstep',
      })) as WorkflowEdge[],
      isDirty: false,
      selectedNodeId: null,
      runStatus: null,
      currentRun: null,
    });
  },

  resetWorkflow: () => {
    set({
      nodes: [],
      edges: [],
      workflowId: null,
      workflowName: '',
      workflowDescription: '',
      isDirty: false,
      selectedNodeId: null,
      runStatus: null,
      currentRun: null,
    });
  },

  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),
  setWorkflowDescription: (desc) =>
    set({ workflowDescription: desc, isDirty: true }),
  markClean: () => set({ isDirty: false }),

  toDefinition: (): WorkflowDefinition => {
    const state = get();
    return {
      id: state.workflowId ?? '',
      name: state.workflowName || 'Untitled',
      description: state.workflowDescription,
      nodes: state.nodes.map((n) => ({
        id: n.id,
        type: n.type ?? 'workflowStep',
        position: n.position,
        data: n.data,
        width: n.measured?.width,
        height: n.measured?.height,
      })),
      edges: state.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        data: e.data as WorkflowEdgeData,
        animated: e.animated,
      })),
    };
  },
}));
