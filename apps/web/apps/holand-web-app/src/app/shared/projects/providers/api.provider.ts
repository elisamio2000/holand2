// ============================================
// Projects API provider — gateway REST (stub until BE ready)
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { buildMeta, type ProjectsProvider } from './types';
import type {
  CreateProjectRequest,
  CreateTaskRequest,
  DiscussionThread,
  ProjectAnalytics,
  ProjectBoardData,
  ProjectBoardMeta,
  ProjectDetail,
  ProjectDoc,
  ProjectDocFolder,
  ProjectResource,
  ProjectsListData,
  Sprint,
  TaskComment,
  TaskDetail,
  TaskLink,
  TaskSummary,
  TasksListData,
  UpdateProjectRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
  WorkloadEntry,
} from '@/types/projects.types';

function notImplemented(): never {
  throw new Error(
    'Projects API is not implemented on the gateway yet. Set NEXT_PUBLIC_PROJECTS_MOCK=true for development preview.'
  );
}

/** Wire to GET/POST /projects etc. when backend ships. */
export const apiProjectsProvider: ProjectsProvider = {
  id: 'api',

  async listProjects(params) {
    const { data } = await gatewayClient.get<ProjectsListData>('/projects', { params });
    return data;
  },

  async getProject(id) {
    const { data } = await gatewayClient.get<ProjectDetail>(`/projects/${id}`);
    return data;
  },

  async createProject(request: CreateProjectRequest) {
    const { data } = await gatewayClient.post<TaskSummary>('/projects', request);
    return data as unknown as import('@/types/projects.types').ProjectSummary;
  },

  async updateProject(id, request: UpdateProjectRequest) {
    const { data } = await gatewayClient.patch(`/projects/${id}`, request);
    return data as import('@/types/projects.types').ProjectSummary;
  },

  async deleteProject(id) {
    const { data } = await gatewayClient.delete<{ deleted: boolean }>(`/projects/${id}`);
    return data;
  },

  async listMyTasks(params) {
    const { data } = await gatewayClient.get<TasksListData>('/tasks/mine', { params });
    return data;
  },

  async listProjectTasks(projectId, params) {
    const { data } = await gatewayClient.get<TasksListData>(`/projects/${projectId}/tasks`, {
      params,
    });
    return data;
  },

  async getTask(id) {
    const { data } = await gatewayClient.get<TaskDetail>(`/tasks/${id}`);
    return data;
  },

  async createTask(request: CreateTaskRequest) {
    const projectId = request.project_id;
    const path = projectId ? `/projects/${projectId}/tasks` : '/tasks';
    const { data } = await gatewayClient.post<TaskSummary>(path, request);
    return data;
  },

  async updateTask(id, request: UpdateTaskRequest) {
    const { data } = await gatewayClient.patch<TaskSummary>(`/tasks/${id}`, request);
    return data;
  },

  async updateTaskStatus(id, request: UpdateTaskStatusRequest) {
    const { data } = await gatewayClient.patch<TaskSummary>(`/tasks/${id}/status`, request);
    return data;
  },

  async deleteTask(id) {
    const { data } = await gatewayClient.delete<{ deleted: boolean }>(`/tasks/${id}`);
    return data;
  },

  async getBoard(projectId) {
    const { data } = await gatewayClient.get<ProjectBoardData>(`/projects/${projectId}/board`);
    return data;
  },

  async addComment(taskId, body) {
    const { data } = await gatewayClient.post<TaskComment>(`/tasks/${taskId}/comments`, { body });
    return data;
  },

  async addLink(taskId, link: Omit<TaskLink, 'id'>) {
    const { data } = await gatewayClient.post<TaskLink>(`/tasks/${taskId}/links`, link);
    return data;
  },

  async listActivity(projectId, limit = 30) {
    const { data } = await gatewayClient.get(`/projects/${projectId ?? ''}/activity`, {
      params: { limit },
    });
    return (data as { items: import('@/types/projects.types').ActivityEvent[] }).items ?? data;
  },

  async getFeedStats() {
    const { data } = await gatewayClient.get<ProjectsListData>('/projects', {
      params: { limit: 100 },
    });
    const items = data.items ?? [];
    return {
      projects: items.length,
      openTasks: items.reduce((s, p) => s + (p.open_task_count ?? 0), 0),
      overdue: items.reduce((s, p) => s + (p.overdue_task_count ?? 0), 0),
      linkedCases: new Set(items.flatMap((p) => p.linked_case_ids ?? [])).size,
    };
  },

  async listDiscussion(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/discussion`);
    return data as DiscussionThread[];
  },

  async createDiscussionThread(projectId, title, body) {
    const { data } = await gatewayClient.post(`/projects/${projectId}/discussion`, { title, body });
    return data as DiscussionThread;
  },

  async listDocs(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/docs`);
    return data as { folders: ProjectDocFolder[]; docs: ProjectDoc[] };
  },

  async createDoc(projectId, title, content, folderId) {
    const { data } = await gatewayClient.post(`/projects/${projectId}/docs`, {
      title,
      content,
      folder_id: folderId,
    });
    return data as ProjectDoc;
  },

  async updateDoc(docId, patch) {
    const { data } = await gatewayClient.patch(`/projects/docs/${docId}`, patch);
    return data as ProjectDoc;
  },

  async listBoards(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/boards`);
    return data as ProjectBoardMeta[];
  },

  async listSprints(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/sprints`);
    return data as Sprint[];
  },

  async assignTaskToSprint(taskId, sprintId) {
    await gatewayClient.patch(`/tasks/${taskId}/sprint`, { sprint_id: sprintId });
    return { ok: true };
  },

  async getAnalytics(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/analytics`);
    return data as ProjectAnalytics;
  },

  async getWorkload(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/workload`);
    return data as WorkloadEntry[];
  },

  async listResources(projectId) {
    const { data } = await gatewayClient.get(`/projects/${projectId}/resources`);
    return data as ProjectResource[];
  },
};

export function apiProviderMeta(endpoint: string) {
  return buildMeta('api', 'off', endpoint);
}
