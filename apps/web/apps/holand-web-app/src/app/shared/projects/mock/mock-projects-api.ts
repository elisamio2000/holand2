// ============================================
// Projects & Tasks — in-memory mock API
// ============================================

import {
  type ActivityEvent,
  type CreateProjectRequest,
  type CreateTaskRequest,
  DEFAULT_BOARD_STATUSES,
  type DiscussionThread,
  type ProjectAnalytics,
  type ProjectBoardData,
  type ProjectBoardMeta,
  type ProjectDetail,
  type ProjectDoc,
  type ProjectDocFolder,
  type ProjectResource,
  type ProjectSummary,
  type ProjectsListParams,
  type Sprint,
  type TaskComment,
  type TaskDetail,
  type TaskLink,
  type TaskStatus,
  type TaskSummary,
  type TasksListParams,
  type UpdateProjectRequest,
  type UpdateTaskRequest,
  type UpdateTaskStatusRequest,
  type WorkloadEntry,
} from '@/types/projects.types';
import { MOCK_LIMITS } from './config';
import { pushAutomationLog } from './automations-mock-log';
import { pushTaskAssignedInboxNotification } from '@/app/shared/messages/mock/mock-messages-api';
import {
  createMockProjectsSeed,
  MOCK_CURRENT_USER_ID,
  MOCK_MEMBERS,
} from './mock-projects-data';
import {
  buildMockAnalytics,
  buildMockWorkload,
  createExtendedMockSeed,
} from './mock-projects-extended';
import { emitProjectsEvent } from '@/app/shared/projects/realtime/projects-event-bus';

interface MockStore {
  projects: Map<string, ProjectDetail>;
  tasks: Map<string, TaskDetail>;
  activities: ActivityEvent[];
  discussions: DiscussionThread[];
  docFolders: ProjectDocFolder[];
  docs: ProjectDoc[];
  boards: ProjectBoardMeta[];
  sprints: Sprint[];
  resources: ProjectResource[];
}

let store: MockStore | null = null;
let mockActive = false;

export function setMockProjectsActive(active: boolean): void {
  mockActive = active;
}

export function isMockProjectsActive(): boolean {
  return mockActive;
}

export function resetMockProjectsStore(): void {
  store = null;
}

function getStore(): MockStore {
  if (!store) {
    const seed = createMockProjectsSeed();
    const extended = createExtendedMockSeed(seed.projects.map((p) => p.id));
    store = {
      projects: new Map(seed.projects.map((p) => [p.id, structuredClone(p)])),
      tasks: new Map(seed.tasks.map((t) => [t.id, structuredClone(t)])),
      activities: [...seed.activities],
      discussions: [...extended.discussions],
      docFolders: [...extended.docFolders],
      docs: [...extended.docs],
      boards: [...extended.boards],
      sprints: extended.sprints.map((s) => ({
        ...s,
        task_ids: seed.tasks
          .filter((t) => t.project_id === s.project_id && t.status !== 'done')
          .slice(0, 4)
          .map((t) => t.id),
      })),
      resources: [...extended.resources],
    };
  }
  return store;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function recomputeProjectCounts(projectId: string): void {
  const s = getStore();
  const project = s.projects.get(projectId);
  if (!project) return;
  const projectTasks = Array.from(s.tasks.values()).filter(
    (t) => t.project_id === projectId && !t.parent_task_id
  );
  const completed = projectTasks.filter((t) => t.status === 'done').length;
  const open = projectTasks.filter(
    (t) => t.status !== 'done' && t.status !== 'canceled'
  ).length;
  const overdue = projectTasks.filter((t) => isOverdue(t)).length;
  project.task_count = projectTasks.length;
  project.completed_task_count = completed;
  project.open_task_count = open;
  project.overdue_task_count = overdue;
  project.updated_at = nowIso();
}

function isOverdue(task: TaskSummary): boolean {
  if (!task.due_at || task.status === 'done' || task.status === 'canceled') {
    return false;
  }
  return new Date(task.due_at).getTime() < Date.now();
}

function toSummary(project: ProjectDetail): ProjectSummary {
  const { members: _m, ...rest } = project;
  return rest;
}

function rootTasksForProject(projectId: string): TaskDetail[] {
  return Array.from(getStore().tasks.values())
    .filter((t) => t.project_id === projectId && !t.parent_task_id)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}

function pushActivity(event: Omit<ActivityEvent, 'id' | 'created_at'>): void {
  const s = getStore();
  s.activities.unshift({
    ...event,
    id: newId('act-mock-'),
    created_at: nowIso(),
  });
  if (s.activities.length > 100) s.activities.length = 100;
}

function matchesTaskFilters(task: TaskDetail, params: TasksListParams, assigneeId?: string): boolean {
  if (params.personal_only && !task.is_personal) return false;
  if (!params.personal_only && task.is_personal && !params.project_id) return false;
  if (params.project_id && task.project_id !== params.project_id) return false;
  if (assigneeId && task.assignee_id !== assigneeId) return false;
  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    const hay = `${task.title} ${task.project_name ?? ''} ${task.case_title ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    if (!statuses.includes(task.status)) return false;
  }
  if (params.priority) {
    const priorities = Array.isArray(params.priority) ? params.priority : [params.priority];
    if (!priorities.includes(task.priority)) return false;
  }
  if (params.due_before && task.due_at && task.due_at > params.due_before) return false;
  if (params.due_after && task.due_at && task.due_at < params.due_after) return false;
  return true;
}

export const mockProjectsApi = {
  listProjects(params: ProjectsListParams = {}) {
    const s = getStore();
    let items = Array.from(s.projects.values()).map(toSummary);
    if (params.status && params.status !== 'all') {
      items = items.filter((p) => p.status === params.status);
    }
    if (params.owner_id) {
      items = items.filter((p) => p.owner_id === params.owner_id);
    }
    if (params.has_case) {
      items = items.filter((p) => p.linked_case_ids.length > 0);
    }
    if (params.q?.trim()) {
      const q = params.q.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      );
    }
    items.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, MOCK_LIMITS.maxProjects);
    const start = (page - 1) * limit;
    const slice = items.slice(start, start + limit);
    return {
      items: slice,
      total: items.length,
      page,
      limit,
      facets: {
        active: items.filter((p) => p.status === 'active').length,
        archived: items.filter((p) => p.status === 'archived').length,
        mine: items.filter((p) => p.owner_id === MOCK_CURRENT_USER_ID).length,
      },
    };
  },

  getProject(projectId: string): ProjectDetail | null {
    const p = getStore().projects.get(projectId);
    return p ? structuredClone(p) : null;
  },

  createProject(request: CreateProjectRequest): ProjectSummary {
    const s = getStore();
    if (s.projects.size >= MOCK_LIMITS.maxProjects) {
      throw new Error('Mock project limit reached');
    }
    const id = newId('proj-mock-');
    const detail: ProjectDetail = {
      id,
      name: request.name,
      description: request.description,
      status: 'active',
      owner_id: MOCK_CURRENT_USER_ID,
      owner_name: 'You (Analyst)',
      task_count: 0,
      completed_task_count: 0,
      open_task_count: 0,
      overdue_task_count: 0,
      member_count: MOCK_MEMBERS.length,
      linked_case_ids: request.case_ids ?? [],
      target_date: request.target_date,
      updated_at: nowIso(),
      created_at: nowIso(),
      members: [...MOCK_MEMBERS],
    };
    s.projects.set(id, detail);
    pushActivity({
      project_id: id,
      actor_id: MOCK_CURRENT_USER_ID,
      actor_name: 'You (Analyst)',
      action: 'created',
      summary: `Created project ${request.name}`,
    });
    emitProjectsEvent({ type: 'project.updated', projectId: id });
    return toSummary(detail);
  },

  updateProject(projectId: string, request: UpdateProjectRequest): ProjectSummary {
    const s = getStore();
    const project = s.projects.get(projectId);
    if (!project) throw new Error('Project not found');
    if (request.name !== undefined) project.name = request.name;
    if (request.description !== undefined) project.description = request.description;
    if (request.status !== undefined) project.status = request.status;
    if (request.target_date !== undefined) project.target_date = request.target_date;
    if (request.case_ids !== undefined) project.linked_case_ids = request.case_ids;
    project.updated_at = nowIso();
    emitProjectsEvent({ type: 'project.updated', projectId });
    return toSummary(project);
  },

  deleteProject(projectId: string): { deleted: boolean } {
    const s = getStore();
    if (!s.projects.delete(projectId)) throw new Error('Project not found');
    for (const [id, task] of s.tasks) {
      if (task.project_id === projectId) s.tasks.delete(id);
    }
    return { deleted: true };
  },

  listMyTasks(params: TasksListParams = {}, currentUserId = MOCK_CURRENT_USER_ID) {
    const s = getStore();
    let items = Array.from(s.tasks.values()).filter(
      (t) => !t.parent_task_id && matchesTaskFilters(t, params, currentUserId)
    );
    if (!params.personal_only) {
      items = items.filter((t) => t.assignee_id === currentUserId);
    }
    items.sort((a, b) => {
      const ad = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const start = (page - 1) * limit;
    const slice = items.slice(start, start + limit).map((t) => structuredClone(t) as TaskSummary);
    const facets = {
      todo: items.filter((t) => t.status === 'todo' || t.status === 'backlog').length,
      in_progress: items.filter((t) => t.status === 'in_progress' || t.status === 'review').length,
      done: items.filter((t) => t.status === 'done').length,
      overdue: items.filter((t) => isOverdue(t)).length,
    };
    return { items: slice, total: items.length, page, limit, facets };
  },

  listProjectTasks(projectId: string, params: TasksListParams = {}) {
    const p = { ...params, project_id: projectId };
    const s = getStore();
    let items = Array.from(s.tasks.values()).filter(
      (t) => !t.parent_task_id && matchesTaskFilters(t, p)
    );
    items.sort((a, b) => a.position - b.position);
    return {
      items: items.map((t) => structuredClone(t) as TaskSummary),
      total: items.length,
      page: 1,
      limit: items.length,
    };
  },

  getTask(taskId: string): TaskDetail | null {
    const t = getStore().tasks.get(taskId);
    return t ? structuredClone(t) : null;
  },

  createTask(request: CreateTaskRequest): TaskSummary {
    const s = getStore();
    if (s.tasks.size >= MOCK_LIMITS.maxTasks) {
      throw new Error('Mock task limit reached');
    }
    const id = newId('task-mock-');
    const project = request.project_id ? s.projects.get(request.project_id) : null;
    const detail: TaskDetail = {
      id,
      project_id: request.project_id ?? null,
      project_name: project?.name,
      parent_task_id: request.parent_task_id ?? null,
      title: request.title,
      status: request.status ?? 'todo',
      priority: request.priority ?? 'normal',
      assignee_id: request.assignee_id ?? MOCK_CURRENT_USER_ID,
      assignee_name: 'You (Analyst)',
      due_at: request.due_at,
      position: rootTasksForProject(request.project_id ?? '').length,
      case_id: request.case_id,
      case_title: request.case_id ? `Case ${request.case_id}` : undefined,
      labels: [],
      subtask_count: 0,
      completed_subtask_count: 0,
      comment_count: 0,
      attachment_count: 0,
      is_blocked: false,
      is_personal: request.is_personal ?? !request.project_id,
      updated_at: nowIso(),
      created_at: nowIso(),
      description: request.description,
      custom_fields: [],
      subtasks: [],
      checklists: [],
      links: request.case_id
        ? [
            {
              id: newId('link-'),
              type: 'case',
              target_id: request.case_id,
              href: `/cases/${request.case_id}`,
            },
          ]
        : [],
      dependencies: [],
      comments: [],
    };
    s.tasks.set(id, detail);
    if (request.project_id) recomputeProjectCounts(request.project_id);
    pushActivity({
      project_id: request.project_id ?? undefined,
      task_id: id,
      actor_id: MOCK_CURRENT_USER_ID,
      actor_name: 'You (Analyst)',
      action: 'created',
      summary: `Created task "${request.title}"`,
    });
    emitProjectsEvent({
      type: 'task.created',
      taskId: id,
      projectId: request.project_id ?? undefined,
    });
    return structuredClone(detail) as TaskSummary;
  },

  updateTask(taskId: string, request: UpdateTaskRequest): TaskSummary {
    const s = getStore();
    const task = s.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (request.title !== undefined) task.title = request.title;
    if (request.status !== undefined) task.status = request.status;
    if (request.priority !== undefined) task.priority = request.priority;
    if (request.assignee_id !== undefined) {
      const prevAssignee = task.assignee_id;
      task.assignee_id = request.assignee_id ?? undefined;
      task.assignee_name = request.assignee_id
        ? MOCK_MEMBERS.find((m) => m.user_id === request.assignee_id)?.name
        : undefined;
      if (request.assignee_id && request.assignee_id !== prevAssignee) {
        const projectName = task.project_id
          ? s.projects.get(task.project_id)?.name
          : undefined;
        pushTaskAssignedInboxNotification({
          taskId: task.id,
          taskTitle: task.title,
          projectName,
          assigneeId: request.assignee_id,
        });
        pushAutomationLog(
          'presetAssign',
          `Notified ${task.assignee_name ?? request.assignee_id} for "${task.title}"`
        );
      }
    }
    if (request.due_at !== undefined) task.due_at = request.due_at ?? undefined;
    if (request.start_at !== undefined) task.start_at = request.start_at ?? undefined;
    if (request.position !== undefined) task.position = request.position;
    if (request.case_id !== undefined) task.case_id = request.case_id ?? undefined;
    if (request.description !== undefined) task.description = request.description;
    if (request.custom_fields !== undefined) task.custom_fields = request.custom_fields;
    task.updated_at = nowIso();
    if (task.project_id) recomputeProjectCounts(task.project_id);
    emitProjectsEvent({
      type: request.status !== undefined ? 'task.status_changed' : 'task.updated',
      taskId,
      projectId: task.project_id ?? undefined,
      status: request.status,
    });
    return structuredClone(task) as TaskSummary;
  },

  updateTaskStatus(taskId: string, request: UpdateTaskStatusRequest): TaskSummary {
    return this.updateTask(taskId, {
      status: request.status,
      position: request.position,
    });
  },

  deleteTask(taskId: string): { deleted: boolean } {
    const s = getStore();
    const task = s.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    s.tasks.delete(taskId);
    if (task.project_id) recomputeProjectCounts(task.project_id);
    emitProjectsEvent({ type: 'task.deleted', taskId, projectId: task.project_id ?? undefined });
    return { deleted: true };
  },

  getBoard(projectId: string): ProjectBoardData {
    const project = getStore().projects.get(projectId);
    if (!project) throw new Error('Project not found');
    const tasks = rootTasksForProject(projectId);
    const columns = DEFAULT_BOARD_STATUSES.map((status) => ({
      status,
      title: status,
      tasks: tasks
        .filter((t) => t.status === status)
        .map((t) => structuredClone(t) as TaskSummary),
    }));
    return {
      project_id: projectId,
      project_name: project.name,
      columns,
      updated_at: nowIso(),
    };
  },

  addComment(taskId: string, body: string, authorId = MOCK_CURRENT_USER_ID): TaskComment {
    const task = getStore().tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    const comment: TaskComment = {
      id: newId('cmt-mock-'),
      task_id: taskId,
      author_id: authorId,
      author_name:
        MOCK_MEMBERS.find((m) => m.user_id === authorId)?.name ?? 'You (Analyst)',
      body,
      created_at: nowIso(),
    };
    task.comments.push(comment);
    task.comment_count = task.comments.length;
    task.updated_at = nowIso();
    emitProjectsEvent({ type: 'comment.new', taskId, projectId: task.project_id ?? undefined });
    return comment;
  },

  addLink(taskId: string, link: Omit<TaskLink, 'id'>): TaskLink {
    const task = getStore().tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    const full: TaskLink = { ...link, id: newId('link-') };
    task.links.push(full);
    task.updated_at = nowIso();
    return full;
  },

  listActivity(projectId?: string, limit = 30): ActivityEvent[] {
    let items = getStore().activities;
    if (projectId) items = items.filter((a) => a.project_id === projectId);
    return items.slice(0, limit).map((a) => structuredClone(a));
  },

  getFeedStats() {
    const s = getStore();
    const projects = Array.from(s.projects.values());
    const tasks = Array.from(s.tasks.values()).filter((t) => !t.parent_task_id);
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status === 'active').length,
      openTasks: tasks.filter((t) => t.status !== 'done' && t.status !== 'canceled').length,
      overdueTasks: tasks.filter((t) => isOverdue(t)).length,
      linkedCases: new Set(projects.flatMap((p) => p.linked_case_ids)).size,
    };
  },

  listDiscussion(projectId: string): DiscussionThread[] {
    return getStore()
      .discussions.filter((d) => d.project_id === projectId)
      .map((d) => structuredClone(d));
  },

  createDiscussionThread(
    projectId: string,
    title: string,
    body: string,
    authorId = MOCK_CURRENT_USER_ID
  ): DiscussionThread {
    const thread: DiscussionThread = {
      id: newId('disc-mock-'),
      project_id: projectId,
      title,
      body,
      author_id: authorId,
      author_name: MOCK_MEMBERS.find((m) => m.user_id === authorId)?.name ?? 'You (Analyst)',
      reply_count: 0,
      created_at: nowIso(),
    };
    getStore().discussions.unshift(thread);
    return structuredClone(thread);
  },

  listDocs(projectId: string): { folders: ProjectDocFolder[]; docs: ProjectDoc[] } {
    const s = getStore();
    return {
      folders: s.docFolders.filter((f) => f.project_id === projectId).map((f) => structuredClone(f)),
      docs: s.docs.filter((d) => d.project_id === projectId).map((d) => structuredClone(d)),
    };
  },

  createDoc(
    projectId: string,
    title: string,
    content: string,
    folderId?: string | null
  ): ProjectDoc {
    const doc: ProjectDoc = {
      id: newId('doc-mock-'),
      project_id: projectId,
      folder_id: folderId ?? null,
      title,
      content,
      author_id: MOCK_CURRENT_USER_ID,
      author_name: 'You (Analyst)',
      updated_at: nowIso(),
      created_at: nowIso(),
    };
    getStore().docs.unshift(doc);
    return structuredClone(doc);
  },

  updateDoc(docId: string, patch: { title?: string; content?: string }): ProjectDoc {
    const doc = getStore().docs.find((d) => d.id === docId);
    if (!doc) throw new Error('Doc not found');
    if (patch.title !== undefined) doc.title = patch.title;
    if (patch.content !== undefined) doc.content = patch.content;
    doc.updated_at = nowIso();
    return structuredClone(doc);
  },

  listBoards(projectId: string): ProjectBoardMeta[] {
    return getStore()
      .boards.filter((b) => b.project_id === projectId)
      .map((b) => structuredClone(b));
  },

  listSprints(projectId: string): Sprint[] {
    return getStore()
      .sprints.filter((s) => s.project_id === projectId)
      .map((s) => structuredClone(s));
  },

  assignTaskToSprint(taskId: string, sprintId: string | null): void {
    const s = getStore();
    const task = s.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    for (const sprint of s.sprints) {
      sprint.task_ids = sprint.task_ids.filter((id) => id !== taskId);
    }
    if (sprintId) {
      const sprint = s.sprints.find((sp) => sp.id === sprintId);
      if (sprint) sprint.task_ids.push(taskId);
    }
    emitProjectsEvent({ type: 'task.updated', taskId, projectId: task.project_id ?? undefined });
  },

  getAnalytics(projectId: string): ProjectAnalytics {
    return buildMockAnalytics(projectId);
  },

  getWorkload(projectId: string): WorkloadEntry[] {
    const tasks = rootTasksForProject(projectId).map((t) => structuredClone(t) as TaskSummary);
    return buildMockWorkload(projectId, tasks);
  },

  listResources(projectId: string): ProjectResource[] {
    return getStore()
      .resources.filter((r) => r.project_id === projectId)
      .map((r) => structuredClone(r));
  },
};

import { groupTasksByDueBucket } from '@/app/shared/projects/utils/task-due-buckets';

export { groupTasksByDueBucket };
