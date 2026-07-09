import type {
  DiscussionThread,
  ProjectAnalytics,
  ProjectBoardMeta,
  ProjectDoc,
  ProjectDocFolder,
  ProjectResource,
  Sprint,
  WorkloadEntry,
} from '@/types/projects.types';
import { MOCK_CURRENT_USER_ID, MOCK_MEMBERS } from './mock-projects-data';

function nowIso(): string {
  return new Date().toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function createExtendedMockSeed(projectIds: string[]): {
  discussions: DiscussionThread[];
  docFolders: ProjectDocFolder[];
  docs: ProjectDoc[];
  boards: ProjectBoardMeta[];
  sprints: Sprint[];
  resources: ProjectResource[];
} {
  const primaryId = projectIds[0] ?? 'proj-mock-001';
  const discussions: DiscussionThread[] = [
    {
      id: 'disc-mock-001',
      project_id: primaryId,
      title: 'Evidence review kickoff',
      body: 'Share findings from the first import batch before Friday standup.',
      author_id: MOCK_CURRENT_USER_ID,
      author_name: 'You (Analyst)',
      reply_count: 3,
      last_reply_at: nowIso(),
      message_partner_id: 'user-mock-lead',
      created_at: daysFromNow(-2),
    },
    {
      id: 'disc-mock-002',
      project_id: primaryId,
      title: 'Timeline for report draft',
      body: 'Can we align on milestones for the executive summary?',
      author_id: 'user-mock-lead',
      author_name: 'Alex Morgan',
      reply_count: 1,
      last_reply_at: daysFromNow(-1),
      message_partner_id: 'user-mock-analyst',
      created_at: daysFromNow(-5),
    },
  ];

  const docFolders: ProjectDocFolder[] = [
    { id: 'folder-mock-001', project_id: primaryId, name: 'Runbooks' },
    { id: 'folder-mock-002', project_id: primaryId, name: 'Reports', parent_id: null },
  ];

  const docs: ProjectDoc[] = [
    {
      id: 'doc-mock-001',
      project_id: primaryId,
      folder_id: 'folder-mock-001',
      title: 'Import checklist',
      content: '# Import checklist\n\n1. Validate source manifest\n2. Run embedding job\n3. Tag sensitive fields',
      author_id: MOCK_CURRENT_USER_ID,
      author_name: 'You (Analyst)',
      updated_at: nowIso(),
      created_at: daysFromNow(-10),
    },
    {
      id: 'doc-mock-002',
      project_id: primaryId,
      folder_id: 'folder-mock-002',
      title: 'Weekly status template',
      content: '## Status\n\n- Progress\n- Risks\n- Next steps',
      author_id: 'user-mock-lead',
      author_name: 'Alex Morgan',
      updated_at: daysFromNow(-3),
      created_at: daysFromNow(-20),
    },
  ];

  const boards: ProjectBoardMeta[] = projectIds.flatMap((pid, i) => [
    {
      id: `board-mock-${pid}-default`,
      project_id: pid,
      name: 'Main board',
      type: 'kanban' as const,
      is_default: true,
    },
    ...(i === 0
      ? [
          {
            id: `board-mock-${pid}-scrum`,
            project_id: pid,
            name: 'Scrum board',
            type: 'scrum' as const,
            is_default: false,
          },
        ]
      : []),
  ]);

  const sprints: Sprint[] = [
    {
      id: 'sprint-mock-001',
      project_id: primaryId,
      name: 'Sprint 12',
      goal: 'Close evidence tagging gaps',
      start_at: daysFromNow(-7),
      end_at: daysFromNow(7),
      status: 'active',
      task_ids: [],
    },
    {
      id: 'sprint-mock-002',
      project_id: primaryId,
      name: 'Sprint 13',
      goal: 'Draft executive summary',
      start_at: daysFromNow(8),
      end_at: daysFromNow(22),
      status: 'planned',
      task_ids: [],
    },
  ];

  const resources: ProjectResource[] = [
    {
      id: 'res-mock-001',
      project_id: primaryId,
      type: 'case',
      label: 'Case #NS-2024-014',
      href: '/cases/case-mock-001',
    },
    {
      id: 'res-mock-002',
      project_id: primaryId,
      type: 'message',
      label: 'Lead analyst thread',
      href: '/messages',
    },
    {
      id: 'res-mock-003',
      project_id: primaryId,
      type: 'doc',
      label: 'Import checklist',
      href: '#',
    },
  ];

  return { discussions, docFolders, docs, boards, sprints, resources };
}

export function buildMockAnalytics(projectId: string): ProjectAnalytics {
  return {
    project_id: projectId,
    velocity: 18,
    completion_rate: 0.62,
    overdue_trend: [
      { date: daysFromNow(-14), count: 4 },
      { date: daysFromNow(-7), count: 3 },
      { date: daysFromNow(0), count: 2 },
    ],
    member_workload: MOCK_MEMBERS.map((m, i) => ({
      user_id: m.user_id,
      name: m.name,
      open_tasks: 5 - i,
      hours: 12 + i * 4,
    })),
  };
}

export function buildMockWorkload(projectId: string, tasks: { assignee_id?: string; assignee_name?: string; title: string; id: string }[]): WorkloadEntry[] {
  const byUser = new Map<string, WorkloadEntry>();
  for (const task of tasks) {
    const uid = task.assignee_id ?? 'unassigned';
    const name = task.assignee_name ?? 'Unassigned';
    const entry = byUser.get(uid) ?? {
      user_id: uid,
      name,
      capacity_hours: 40,
      assigned_hours: 0,
      tasks: [],
    };
    entry.assigned_hours += 4;
    entry.tasks.push(task as WorkloadEntry['tasks'][0]);
    byUser.set(uid, entry);
  }
  return Array.from(byUser.values());
}
