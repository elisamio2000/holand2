// ============================================
// Workflow Builder Types
// Node-based visual workflow editor types
// Used by: workflow.service.ts, admin-workflows/* components
// ============================================

// ==========================================
// Node Step Kinds
// ==========================================

export type WorkflowStepKind =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'delay'
  | 'merge'
  | 'human'
  | 'llm_call'
  | 'tool_execute'
  | 'loop'
  | 'output';

export type WorkflowActorKind =
  | 'human'
  | 'system'
  | 'robot'
  | 'ai_model'
  | 'hybrid';

export type WorkflowActionCategory =
  | 'integration'
  | 'script'
  | 'inference'
  | 'approval'
  | 'notification'
  | 'transformation'
  | 'io';

// ==========================================
// Workflow Node Data (React Flow node.data)
// ==========================================

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  kind: WorkflowStepKind;
  description?: string;
  config: WorkflowStepConfig;
  status?: WorkflowNodeStatus;
  /** Execution result after run */
  result?: WorkflowStepResult | null;
}

export type WorkflowNodeStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped'
  | 'waiting';

export interface WorkflowStepConfig {
  tool_id?: string;
  route_key?: string;
  model_name?: string;
  /** Arguments template — can use {{variable}} placeholders */
  args?: Record<string, unknown>;
  /** Condition expression (for condition nodes) */
  condition_expr?: string;
  /** Delay in seconds (for delay nodes) */
  delay_seconds?: number;
  /** Trigger type */
  trigger_type?: 'manual' | 'schedule' | 'event' | 'webhook';
  /** Cron expression for schedule triggers */
  cron_expr?: string;
  /** Loop config */
  loop_collection_key?: string;
  /** Max iterations for loops */
  max_iterations?: number;
  /** Human approval config */
  approval_roles?: string[];
  /** Timeout in seconds */
  timeout_seconds?: number;
  /** Retry count */
  retry_count?: number;
  [key: string]: unknown;
}

export interface WorkflowStepResult {
  output?: unknown;
  error?: string;
  duration_ms?: number;
  started_at?: string;
  finished_at?: string;
}

// ==========================================
// Workflow Edge Data
// ==========================================

export interface WorkflowEdgeData extends Record<string, unknown> {
  /** Condition label for branching */
  condition_label?: string;
  /** For condition nodes: true/false branch */
  branch?: 'true' | 'false' | string;
}

// ==========================================
// Workflow Definition (persisted)
// ==========================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  tags?: string[];
  /** Serialized React Flow nodes */
  nodes: SerializedWorkflowNode[];
  /** Serialized React Flow edges */
  edges: SerializedWorkflowEdge[];
  /** Viewport position for restore */
  viewport?: { x: number; y: number; zoom: number };
  /** Global variables available to all nodes */
  variables?: Record<string, unknown>;
}

export interface SerializedWorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  width?: number;
  height?: number;
}

export interface SerializedWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: WorkflowEdgeData;
  animated?: boolean;
}

// ==========================================
// Workflow Execution
// ==========================================

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  started_at?: string;
  finished_at?: string;
  triggered_by?: string;
  /** Per-node execution states */
  step_results?: Record<string, WorkflowStepResult>;
  error?: string;
}

// ==========================================
// Workflow Template
// ==========================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  thumbnail?: string;
  definition: Omit<WorkflowDefinition, 'id' | 'created_at' | 'updated_at'>;
}

// ==========================================
// Step Palette Metadata
// ==========================================

export interface StepPaletteMeta {
  kind: WorkflowStepKind;
  label_key: string;
  description_key: string;
  icon: string;
  color: string;
  category: WorkflowActionCategory;
  default_config: Partial<WorkflowStepConfig>;
}

// ==========================================
// Workflow Store State (Zustand)
// ==========================================

export interface WorkflowStoreState {
  workflow: WorkflowDefinition | null;
  isDirty: boolean;
  selectedNodeId: string | null;
  runStatus: WorkflowRunStatus | null;
  currentRun: WorkflowRun | null;
}

// ==========================================
// Workflow Validation
// ==========================================

export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
  warnings: WorkflowValidationWarning[];
}

export interface WorkflowValidationError {
  nodeId?: string;
  message: string;
  code: string;
}

export interface WorkflowValidationWarning {
  nodeId?: string;
  message: string;
  code: string;
}
