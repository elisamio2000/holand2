// ============================================
// Step Metadata — Node kind definitions with icons and colors
// Used by WorkflowStepPalette and custom node renderer
// ============================================

import type { StepPaletteMeta, WorkflowStepKind } from '@/types/workflow.types';

export const STEP_META: Record<WorkflowStepKind, StepPaletteMeta> = {
  trigger: {
    kind: 'trigger',
    label_key: 'workflow.nodes.trigger',
    description_key: 'workflow.nodes.triggerDesc',
    icon: 'PiPlayCircleBold',
    color: '#10b981',
    category: 'integration',
    default_config: { trigger_type: 'manual' },
  },
  action: {
    kind: 'action',
    label_key: 'workflow.nodes.action',
    description_key: 'workflow.nodes.actionDesc',
    icon: 'PiGearBold',
    color: '#3b82f6',
    category: 'script',
    default_config: {},
  },
  condition: {
    kind: 'condition',
    label_key: 'workflow.nodes.condition',
    description_key: 'workflow.nodes.conditionDesc',
    icon: 'PiGitBranchBold',
    color: '#f59e0b',
    category: 'transformation',
    default_config: { condition_expr: '' },
  },
  delay: {
    kind: 'delay',
    label_key: 'workflow.nodes.delay',
    description_key: 'workflow.nodes.delayDesc',
    icon: 'PiClockBold',
    color: '#8b5cf6',
    category: 'transformation',
    default_config: { delay_seconds: 5 },
  },
  merge: {
    kind: 'merge',
    label_key: 'workflow.nodes.merge',
    description_key: 'workflow.nodes.mergeDesc',
    icon: 'PiGitMergeBold',
    color: '#64748b',
    category: 'transformation',
    default_config: {},
  },
  human: {
    kind: 'human',
    label_key: 'workflow.nodes.human',
    description_key: 'workflow.nodes.humanDesc',
    icon: 'PiUserCheckBold',
    color: '#ec4899',
    category: 'approval',
    default_config: { approval_roles: ['admin'] },
  },
  llm_call: {
    kind: 'llm_call',
    label_key: 'workflow.nodes.llm_call',
    description_key: 'workflow.nodes.llm_callDesc',
    icon: 'PiBrainBold',
    color: '#06b6d4',
    category: 'inference',
    default_config: { route_key: 'chat.default' },
  },
  tool_execute: {
    kind: 'tool_execute',
    label_key: 'workflow.nodes.tool_execute',
    description_key: 'workflow.nodes.tool_executeDesc',
    icon: 'PiWrenchBold',
    color: '#14b8a6',
    category: 'integration',
    default_config: { tool_id: '' },
  },
  loop: {
    kind: 'loop',
    label_key: 'workflow.nodes.loop',
    description_key: 'workflow.nodes.loopDesc',
    icon: 'PiArrowsClockwiseBold',
    color: '#a855f7',
    category: 'transformation',
    default_config: { max_iterations: 10 },
  },
  output: {
    kind: 'output',
    label_key: 'workflow.nodes.output',
    description_key: 'workflow.nodes.outputDesc',
    icon: 'PiFlagCheckeredBold',
    color: '#ef4444',
    category: 'io',
    default_config: {},
  },
};

export const PALETTE_CATEGORIES = [
  {
    key: 'triggers',
    label_key: 'workflow.palette.categories.triggers',
    kinds: ['trigger'] as WorkflowStepKind[],
  },
  {
    key: 'actions',
    label_key: 'workflow.palette.categories.actions',
    kinds: ['action', 'tool_execute'] as WorkflowStepKind[],
  },
  {
    key: 'logic',
    label_key: 'workflow.palette.categories.logic',
    kinds: ['condition', 'delay', 'merge', 'loop'] as WorkflowStepKind[],
  },
  {
    key: 'ai',
    label_key: 'workflow.palette.categories.ai',
    kinds: ['llm_call'] as WorkflowStepKind[],
  },
  {
    key: 'io',
    label_key: 'workflow.palette.categories.io',
    kinds: ['human', 'output'] as WorkflowStepKind[],
  },
];
