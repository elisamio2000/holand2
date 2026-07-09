// ============================================
// Projects mock seed — fictitious data only (no PII)
// ============================================

import type {
  ActivityEvent,
  CustomFieldDefinition,
  ProjectDetail,
  ProjectMember,
  TaskDetail,
  TaskSummary,
} from '@/types/projects.types';

export const MOCK_CURRENT_USER_ID = 'user-self';

export const MOCK_MEMBERS: ProjectMember[] = [
  { user_id: 'user-self', name: 'You (Analyst)', role: 'owner' },
  { user_id: 'user-mock-lead', name: 'Alex Morgan', role: 'member' },
  { user_id: 'user-mock-analyst', name: 'Sam Rivera', role: 'member' },
  { user_id: 'user-mock-reviewer', name: 'Jordan Lee', role: 'viewer' },
];

export const DEFAULT_CUSTOM_FIELD_DEFS: CustomFieldDefinition[] = [
  {
    key: 'case_id',
    label: 'Case ID',
    type: 'relationship',
  },
  {
    key: 'analysis_phase',
    label: 'Analysis phase',
    type: 'dropdown',
    options: ['import', 'embed', 'analyze', 'report'],
  },
  {
    key: 'evidence_type',
    label: 'Evidence type',
    type: 'labels',
    options: ['document', 'media', 'communication', 'financial'],
  },
  {
    key: 'time_estimate_hours',
    label: 'Time estimate (h)',
    type: 'number',
  },
  {
    key: 'risk_level',
    label: 'Risk level',
    type: 'dropdown',
    options: ['low', 'medium', 'high'],
  },
];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

export function createMockProjectsSeed(): {
  projects: ProjectDetail[];
  tasks: TaskDetail[];
  activities: ActivityEvent[];
} {
  const now = new Date().toISOString();

  const projects: ProjectDetail[] = [
    {
      id: 'proj-mock-001',
      name: 'Operation North Star',
      description: 'Cross-case financial analysis and evidence review pipeline.',
      status: 'active',
      owner_id: 'user-mock-lead',
      owner_name: 'Alex Morgan',
      task_count: 12,
      completed_task_count: 5,
      open_task_count: 7,
      overdue_task_count: 2,
      member_count: 4,
      linked_case_ids: ['case-mock-101', 'case-mock-102'],
      target_date: daysFromNow(45),
      updated_at: daysAgo(0),
      created_at: daysAgo(30),
      members: MOCK_MEMBERS,
    },
    {
      id: 'proj-mock-002',
      name: 'Financial Review Q2',
      description: 'Quarterly ledger reconciliation and export validation.',
      status: 'active',
      owner_id: 'user-self',
      owner_name: 'You (Analyst)',
      task_count: 8,
      completed_task_count: 3,
      open_task_count: 5,
      overdue_task_count: 1,
      member_count: 3,
      linked_case_ids: ['case-mock-103'],
      target_date: daysFromNow(20),
      updated_at: daysAgo(1),
      created_at: daysAgo(14),
      members: MOCK_MEMBERS.slice(0, 3),
    },
    {
      id: 'proj-mock-003',
      name: 'Media Analysis Pilot',
      description: 'OCR and media triage for unstructured evidence sets.',
      status: 'on_hold',
      owner_id: 'user-mock-analyst',
      owner_name: 'Sam Rivera',
      task_count: 5,
      completed_task_count: 1,
      open_task_count: 4,
      overdue_task_count: 0,
      member_count: 2,
      linked_case_ids: [],
      target_date: daysFromNow(60),
      updated_at: daysAgo(3),
      created_at: daysAgo(7),
      members: MOCK_MEMBERS.slice(0, 2),
    },
    {
      id: 'proj-mock-archived',
      name: 'Legacy Intake 2024',
      description: 'Completed intake workflow — archived for reference.',
      status: 'archived',
      owner_id: 'user-mock-lead',
      owner_name: 'Alex Morgan',
      task_count: 20,
      completed_task_count: 20,
      open_task_count: 0,
      overdue_task_count: 0,
      member_count: 3,
      linked_case_ids: ['case-mock-099'],
      target_date: daysAgo(90),
      updated_at: daysAgo(30),
      created_at: daysAgo(180),
      members: MOCK_MEMBERS.slice(0, 3),
    },
  ];

  const taskSeeds: Array<Partial<TaskDetail> & Pick<TaskSummary, 'id' | 'title' | 'status' | 'priority'>> = [
    {
      id: 'task-mock-001',
      project_id: 'proj-mock-001',
      project_name: 'Operation North Star',
      title: 'Review financial export bundle',
      status: 'in_progress',
      priority: 'urgent',
      assignee_id: 'user-self',
      assignee_name: 'You (Analyst)',
      due_at: daysAgo(1),
      case_id: 'case-mock-101',
      case_title: 'Case #101 — North Star',
      position: 0,
    },
    {
      id: 'task-mock-002',
      project_id: 'proj-mock-001',
      project_name: 'Operation North Star',
      title: 'Verify embed quality report',
      status: 'review',
      priority: 'high',
      assignee_id: 'user-mock-analyst',
      assignee_name: 'Sam Rivera',
      due_at: daysFromNow(0),
      case_id: 'case-mock-101',
      case_title: 'Case #101 — North Star',
      position: 1,
    },
    {
      id: 'task-mock-003',
      project_id: 'proj-mock-001',
      project_name: 'Operation North Star',
      title: 'Submit interim findings',
      status: 'todo',
      priority: 'high',
      assignee_id: 'user-self',
      assignee_name: 'You (Analyst)',
      due_at: daysAgo(2),
      case_id: 'case-mock-102',
      case_title: 'Case #102 — Satellite',
      position: 0,
    },
    {
      id: 'task-mock-004',
      project_id: 'proj-mock-001',
      project_name: 'Operation North Star',
      title: 'Plan Q3 analysis scope',
      status: 'backlog',
      priority: 'normal',
      assignee_id: 'user-mock-lead',
      assignee_name: 'Alex Morgan',
      due_at: daysFromNow(7),
      position: 0,
    },
    {
      id: 'task-mock-005',
      project_id: 'proj-mock-001',
      project_name: 'Operation North Star',
      title: 'Import phase complete',
      status: 'done',
      priority: 'normal',
      assignee_id: 'user-mock-analyst',
      assignee_name: 'Sam Rivera',
      due_at: daysAgo(10),
      position: 0,
    },
    {
      id: 'task-mock-006',
      project_id: 'proj-mock-002',
      project_name: 'Financial Review Q2',
      title: 'Reconcile ledger entries',
      status: 'in_progress',
      priority: 'high',
      assignee_id: 'user-self',
      assignee_name: 'You (Analyst)',
      due_at: daysFromNow(1),
      case_id: 'case-mock-103',
      case_title: 'Case #103 — Q2 Ledger',
      position: 0,
    },
    {
      id: 'task-mock-007',
      project_id: 'proj-mock-002',
      project_name: 'Financial Review Q2',
      title: 'Validate export checksums',
      status: 'todo',
      priority: 'normal',
      assignee_id: 'user-mock-reviewer',
      assignee_name: 'Jordan Lee',
      due_at: daysFromNow(3),
      position: 1,
    },
    {
      id: 'task-mock-008',
      project_id: 'proj-mock-003',
      project_name: 'Media Analysis Pilot',
      title: 'OCR sample batch',
      status: 'todo',
      priority: 'low',
      assignee_id: 'user-mock-analyst',
      assignee_name: 'Sam Rivera',
      due_at: daysFromNow(14),
      position: 0,
    },
    {
      id: 'task-mock-009',
      project_id: null,
      project_name: undefined,
      title: 'Research new pipeline template',
      status: 'todo',
      priority: 'low',
      assignee_id: 'user-self',
      assignee_name: 'You (Analyst)',
      due_at: undefined,
      is_personal: true,
      position: 0,
    },
    {
      id: 'task-mock-010',
      project_id: null,
      title: 'Follow up with team lead',
      status: 'todo',
      priority: 'normal',
      assignee_id: 'user-self',
      assignee_name: 'You (Analyst)',
      due_at: daysFromNow(0),
      is_personal: true,
      position: 1,
    },
  ];

  const tasks: TaskDetail[] = taskSeeds.map((seed, index) => {
    const subtasks: TaskSummary[] =
      seed.id === 'task-mock-001'
        ? [
            {
              id: 'task-mock-001a',
              project_id: seed.project_id ?? null,
              project_name: seed.project_name,
              parent_task_id: seed.id,
              title: 'Hash verification pass',
              status: 'done',
              priority: 'normal',
              assignee_id: 'user-self',
              assignee_name: 'You (Analyst)',
              due_at: daysAgo(1),
              position: 0,
              labels: [],
              subtask_count: 0,
              completed_subtask_count: 0,
              comment_count: 0,
              attachment_count: 0,
              is_blocked: false,
              is_personal: false,
              updated_at: now,
              created_at: daysAgo(2),
            },
            {
              id: 'task-mock-001b',
              project_id: seed.project_id ?? null,
              project_name: seed.project_name,
              parent_task_id: seed.id,
              title: 'Annotate anomalies',
              status: 'in_progress',
              priority: 'high',
              assignee_id: 'user-self',
              assignee_name: 'You (Analyst)',
              due_at: daysFromNow(0),
              position: 1,
              labels: [],
              subtask_count: 0,
              completed_subtask_count: 0,
              comment_count: 0,
              attachment_count: 0,
              is_blocked: false,
              is_personal: false,
              updated_at: now,
              created_at: daysAgo(1),
            },
          ]
        : [];

    return {
      id: seed.id!,
      project_id: seed.project_id ?? null,
      project_name: seed.project_name,
      parent_task_id: null,
      title: seed.title!,
      status: seed.status!,
      priority: seed.priority!,
      assignee_id: seed.assignee_id,
      assignee_name: seed.assignee_name,
      due_at: seed.due_at,
      start_at: daysAgo(5),
      position: seed.position ?? index,
      case_id: seed.case_id,
      case_title: seed.case_title,
      labels: seed.case_id ? ['evidence'] : [],
      subtask_count: subtasks.length,
      completed_subtask_count: subtasks.filter((s) => s.status === 'done').length,
      checklist_progress: seed.id === 'task-mock-002' ? 66 : undefined,
      comment_count: seed.id === 'task-mock-001' ? 2 : 0,
      attachment_count: seed.id === 'task-mock-001' ? 1 : 0,
      is_blocked: seed.id === 'task-mock-002',
      is_personal: Boolean(seed.is_personal),
      updated_at: now,
      created_at: daysAgo(5),
      description:
        seed.id === 'task-mock-001'
          ? 'Review exported financial data for completeness before sign-off.'
          : undefined,
      custom_fields: [
        {
          key: 'analysis_phase',
          label: 'Analysis phase',
          type: 'dropdown',
          value: seed.status === 'done' ? 'import' : 'analyze',
        },
        {
          key: 'risk_level',
          label: 'Risk level',
          type: 'dropdown',
          value: seed.priority === 'urgent' ? 'high' : 'medium',
        },
        {
          key: 'time_estimate_hours',
          label: 'Time estimate (h)',
          type: 'number',
          value: 4,
        },
      ],
      subtasks,
      checklists:
        seed.id === 'task-mock-002'
          ? [
              {
                id: 'chk-mock-001',
                title: 'QA checklist',
                items: [
                  { id: 'chk-i-1', title: 'Spot-check embeddings', done: true, position: 0 },
                  { id: 'chk-i-2', title: 'Validate chunk counts', done: true, position: 1 },
                  { id: 'chk-i-3', title: 'Sign off report', done: false, position: 2 },
                ],
              },
            ]
          : [],
      links:
        seed.case_id
          ? [
              {
                id: `link-case-${seed.id}`,
                type: 'case',
                target_id: seed.case_id,
                label: seed.case_title,
                href: `/cases/${seed.case_id}`,
              },
            ]
          : [],
      dependencies:
        seed.id === 'task-mock-002'
          ? [
              {
                id: 'dep-mock-001',
                type: 'blocked_by',
                task_id: seed.id!,
                related_task_id: 'task-mock-005',
                related_task_title: 'Import phase complete',
              },
            ]
          : [],
      comments:
        seed.id === 'task-mock-001'
          ? [
              {
                id: 'cmt-mock-001',
                task_id: seed.id!,
                author_id: 'user-mock-lead',
                author_name: 'Alex Morgan',
                body: 'Please prioritize anomalies in section B.',
                created_at: daysAgo(1),
              },
            ]
          : [],
      time_estimate_hours: 4,
      time_tracked_hours: seed.status === 'in_progress' ? 2.5 : 0,
    };
  });

  const activities: ActivityEvent[] = [
    {
      id: 'act-mock-001',
      project_id: 'proj-mock-001',
      task_id: 'task-mock-001',
      actor_id: 'user-mock-lead',
      actor_name: 'Alex Morgan',
      action: 'assigned',
      summary: 'Assigned "Review financial export bundle" to You',
      created_at: daysAgo(2),
    },
    {
      id: 'act-mock-002',
      project_id: 'proj-mock-001',
      task_id: 'task-mock-002',
      actor_id: 'user-mock-analyst',
      actor_name: 'Sam Rivera',
      action: 'status_changed',
      summary: 'Moved "Verify embed quality report" to Review',
      created_at: daysAgo(0),
    },
    {
      id: 'act-mock-003',
      project_id: 'proj-mock-002',
      actor_id: 'user-self',
      actor_name: 'You (Analyst)',
      action: 'created',
      summary: 'Created project Financial Review Q2',
      created_at: daysAgo(14),
    },
  ];

  return { projects, tasks, activities };
}
