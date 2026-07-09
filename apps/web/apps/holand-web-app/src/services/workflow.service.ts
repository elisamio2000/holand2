// ============================================
// Workflow Service â€” Workflow CRUD + Execution
//
// MVP: localStorage persistence (backend CRUD endpoint
// /admin/workflows is proposed but not yet available).
// Tool execution uses POST /tools/{tool_id}/execute.
// LLM calls use POST /chat/stream with route_key.
//
// Backend: /tools/*/execute, /chat/stream, /traces/*
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { assertGatewayToolSuccess } from '@/utils/gateway-tool-success';
import { toolExecutePath } from '@/utils/tool-id';
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStepResult,
  WorkflowTemplate,
  WorkflowValidationResult,
  WorkflowValidationError,
  WorkflowValidationWarning,
  SerializedWorkflowNode,
} from '@/types/workflow.types';

const LOG_TAG = '[WorkflowService]';
const STORAGE_KEY = 'Holand_workflows';
const DRAFT_KEY = 'Holand_workflow_draft';

// ==========================================
// Helpers
// ==========================================

function generateId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): WorkflowDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkflowDefinition[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(workflows: WorkflowDefinition[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
}

// ==========================================
// Service Implementation
// ==========================================

export const workflowService = {
  // ========================================
  // CRUD (localStorage MVP)
  // ========================================

  /**
   * List all saved workflows.
   * MVP: reads from localStorage.
   * Future: GET /admin/workflows
   */
  async listWorkflows(): Promise<WorkflowDefinition[]> {
    console.info(LOG_TAG, 'Listing workflows...');
    return loadFromStorage();
  },

  /**
   * Get a single workflow by ID.
   */
  async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    const all = loadFromStorage();
    return all.find((w) => w.id === id) ?? null;
  },

  /**
   * Create a new workflow.
   */
  async createWorkflow(
    partial: Omit<WorkflowDefinition, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WorkflowDefinition> {
    const now = new Date().toISOString();
    const workflow: WorkflowDefinition = {
      ...partial,
      id: generateId(),
      version: 1,
      created_at: now,
      updated_at: now,
    };
    console.info(LOG_TAG, 'Creating workflow:', workflow.name);
    const all = loadFromStorage();
    all.push(workflow);
    saveToStorage(all);
    return workflow;
  },

  /**
   * Update an existing workflow.
   */
  async updateWorkflow(
    id: string,
    updates: Partial<WorkflowDefinition>
  ): Promise<WorkflowDefinition> {
    console.info(LOG_TAG, 'Updating workflow:', id);
    const all = loadFromStorage();
    const idx = all.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Workflow ${id} not found`);
    all[idx] = {
      ...all[idx],
      ...updates,
      id,
      updated_at: new Date().toISOString(),
      version: (all[idx].version ?? 0) + 1,
    };
    saveToStorage(all);
    return all[idx];
  },

  /**
   * Delete a workflow.
   */
  async deleteWorkflow(id: string): Promise<void> {
    console.info(LOG_TAG, 'Deleting workflow:', id);
    const all = loadFromStorage().filter((w) => w.id !== id);
    saveToStorage(all);
  },

  // ========================================
  // Draft (auto-save to localStorage)
  // ========================================

  saveDraft(workflow: Partial<WorkflowDefinition>): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(workflow));
  },

  loadDraft(): Partial<WorkflowDefinition> | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as Partial<WorkflowDefinition>) : null;
    } catch {
      return null;
    }
  },

  clearDraft(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(DRAFT_KEY);
  },

  // ========================================
  // Execution
  // ========================================

  /**
   * Execute a single tool node.
   * @endpoint POST /tools/{tool_id}/execute
   */
  async executeToolStep(
    toolId: string,
    args: Record<string, unknown>,
    sessionId?: string
  ): Promise<WorkflowStepResult> {
    console.info(LOG_TAG, `Executing tool: ${toolId}`);
    const start = Date.now();
    try {
      const res = await gatewayClient.post(toolExecutePath(toolId), {
        args,
        session_id: sessionId,
      });
      assertGatewayToolSuccess(res);
      return {
        output: res.data,
        duration_ms: Date.now() - start,
        started_at: new Date(start).toISOString(),
        finished_at: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: msg,
        duration_ms: Date.now() - start,
        started_at: new Date(start).toISOString(),
        finished_at: new Date().toISOString(),
      };
    }
  },

  /**
   * Execute an LLM call node.
   * @endpoint POST /chat/stream
   */
  async executeLlmStep(
    prompt: string,
    routeKey?: string,
    modelName?: string
  ): Promise<WorkflowStepResult> {
    console.info(LOG_TAG, `Executing LLM call (route: ${routeKey})`);
    const start = Date.now();
    try {
      const res = await gatewayClient.post('/chat/stream', {
        messages: [{ role: 'user', content: prompt }],
        route_key: routeKey,
        model: modelName,
        stream: false,
      });
      return {
        output: res.data,
        duration_ms: Date.now() - start,
        started_at: new Date(start).toISOString(),
        finished_at: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        error: msg,
        duration_ms: Date.now() - start,
        started_at: new Date(start).toISOString(),
        finished_at: new Date().toISOString(),
      };
    }
  },

  // ========================================
  // Validation
  // ========================================

  /**
   * Validate a workflow definition before execution.
   * Checks: trigger exists, all nodes connected, required config present.
   */
  validateWorkflow(workflow: WorkflowDefinition): WorkflowValidationResult {
    console.info(LOG_TAG, 'Validating workflow:', workflow.name);
    const errors: WorkflowValidationError[] = [];
    const warnings: WorkflowValidationWarning[] = [];

    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push({
        message: 'Workflow has no nodes',
        code: 'NO_NODES',
      });
      return { valid: false, errors, warnings };
    }

    const triggerNodes = workflow.nodes.filter(
      (n) => n.data.kind === 'trigger'
    );
    if (triggerNodes.length === 0) {
      errors.push({
        message: 'Workflow must have at least one Trigger node',
        code: 'NO_TRIGGER',
      });
    }
    if (triggerNodes.length > 1) {
      warnings.push({
        message: 'Multiple trigger nodes detected',
        code: 'MULTI_TRIGGER',
      });
    }

    const nodeIds = new Set(workflow.nodes.map((n) => n.id));
    const connectedTargets = new Set(
      workflow.edges.map((e) => e.target)
    );
    const connectedSources = new Set(
      workflow.edges.map((e) => e.source)
    );

    for (const node of workflow.nodes) {
      if (node.data.kind === 'trigger') continue;
      if (!connectedTargets.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          message: `Node "${node.data.label}" has no incoming connection`,
          code: 'ORPHAN_NODE',
        });
      }
    }

    for (const node of workflow.nodes) {
      if (node.data.kind === 'output') continue;
      if (!connectedSources.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          message: `Node "${node.data.label}" has no outgoing connection`,
          code: 'DEAD_END',
        });
      }
    }

    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          message: `Edge references missing source node: ${edge.source}`,
          code: 'INVALID_EDGE',
        });
      }
      if (!nodeIds.has(edge.target)) {
        errors.push({
          message: `Edge references missing target node: ${edge.target}`,
          code: 'INVALID_EDGE',
        });
      }
    }

    for (const node of workflow.nodes) {
      if (
        node.data.kind === 'tool_execute' &&
        !node.data.config.tool_id
      ) {
        errors.push({
          nodeId: node.id,
          message: `Tool Execute node "${node.data.label}" has no tool_id`,
          code: 'MISSING_TOOL_ID',
        });
      }
      if (
        node.data.kind === 'condition' &&
        !node.data.config.condition_expr
      ) {
        errors.push({
          nodeId: node.id,
          message: `Condition node "${node.data.label}" has no condition expression`,
          code: 'MISSING_CONDITION',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  // ========================================
  // Import/Export
  // ========================================

  exportToJson(workflow: WorkflowDefinition): string {
    return JSON.stringify(workflow, null, 2);
  },

  importFromJson(json: string): WorkflowDefinition {
    const parsed = JSON.parse(json) as WorkflowDefinition;
    return {
      ...parsed,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  // ========================================
  // Templates
  // ========================================

  getBuiltinTemplates(): WorkflowTemplate[] {
    return [
      {
        id: 'tpl_simple_tool',
        name: 'Simple Tool Execution',
        description: 'Trigger â†’ Tool Execute â†’ Output',
        category: 'basic',
        tags: ['starter'],
        definition: {
          name: 'Simple Tool Execution',
          nodes: [
            {
              id: 'trigger_1',
              type: 'workflowStep',
              position: { x: 250, y: 50 },
              data: {
                label: 'Manual Trigger',
                kind: 'trigger',
                config: { trigger_type: 'manual' },
              },
            },
            {
              id: 'tool_1',
              type: 'workflowStep',
              position: { x: 250, y: 200 },
              data: {
                label: 'Execute Tool',
                kind: 'tool_execute',
                config: { tool_id: '' },
              },
            },
            {
              id: 'output_1',
              type: 'workflowStep',
              position: { x: 250, y: 350 },
              data: {
                label: 'Output',
                kind: 'output',
                config: {},
              },
            },
          ],
          edges: [
            {
              id: 'e_trigger_tool',
              source: 'trigger_1',
              target: 'tool_1',
              type: 'smoothstep',
            },
            {
              id: 'e_tool_output',
              source: 'tool_1',
              target: 'output_1',
              type: 'smoothstep',
            },
          ],
        },
      },
      {
        id: 'tpl_llm_chain',
        name: 'LLM Chain',
        description: 'Trigger â†’ LLM Call â†’ Condition â†’ Output',
        category: 'ai',
        tags: ['llm', 'chain'],
        definition: {
          name: 'LLM Chain',
          nodes: [
            {
              id: 'trigger_1',
              type: 'workflowStep',
              position: { x: 250, y: 50 },
              data: {
                label: 'Manual Trigger',
                kind: 'trigger',
                config: { trigger_type: 'manual' },
              },
            },
            {
              id: 'llm_1',
              type: 'workflowStep',
              position: { x: 250, y: 200 },
              data: {
                label: 'LLM Call',
                kind: 'llm_call',
                config: { route_key: 'chat.default' },
              },
            },
            {
              id: 'cond_1',
              type: 'workflowStep',
              position: { x: 250, y: 350 },
              data: {
                label: 'Check Result',
                kind: 'condition',
                config: { condition_expr: 'result.length > 0' },
              },
            },
            {
              id: 'output_1',
              type: 'workflowStep',
              position: { x: 250, y: 500 },
              data: {
                label: 'Output',
                kind: 'output',
                config: {},
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'trigger_1',
              target: 'llm_1',
              type: 'smoothstep',
            },
            {
              id: 'e2',
              source: 'llm_1',
              target: 'cond_1',
              type: 'smoothstep',
            },
            {
              id: 'e3',
              source: 'cond_1',
              target: 'output_1',
              type: 'smoothstep',
              data: { branch: 'true', condition_label: 'Yes' },
            },
          ],
        },
      },
      {
        id: 'tpl_human_approval',
        name: 'Human Approval Pipeline',
        description: 'Trigger â†’ Tool â†’ Human Approval â†’ Output',
        category: 'approval',
        tags: ['human', 'approval'],
        definition: {
          name: 'Human Approval Pipeline',
          nodes: [
            {
              id: 'trigger_1',
              type: 'workflowStep',
              position: { x: 250, y: 50 },
              data: {
                label: 'Event Trigger',
                kind: 'trigger',
                config: { trigger_type: 'event' },
              },
            },
            {
              id: 'tool_1',
              type: 'workflowStep',
              position: { x: 250, y: 200 },
              data: {
                label: 'Process Data',
                kind: 'tool_execute',
                config: { tool_id: '' },
              },
            },
            {
              id: 'human_1',
              type: 'workflowStep',
              position: { x: 250, y: 350 },
              data: {
                label: 'Approval Required',
                kind: 'human',
                config: { approval_roles: ['admin'] },
              },
            },
            {
              id: 'output_1',
              type: 'workflowStep',
              position: { x: 250, y: 500 },
              data: {
                label: 'Final Output',
                kind: 'output',
                config: {},
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'trigger_1',
              target: 'tool_1',
              type: 'smoothstep',
            },
            {
              id: 'e2',
              source: 'tool_1',
              target: 'human_1',
              type: 'smoothstep',
            },
            {
              id: 'e3',
              source: 'human_1',
              target: 'output_1',
              type: 'smoothstep',
            },
          ],
        },
      },
    ];
  },
};

