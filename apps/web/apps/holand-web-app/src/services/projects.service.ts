// ============================================
// Projects & Tasks Service
// ============================================

import { dedupeAsync } from '@/utils/async-dedup';
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
  ProjectsListParams,
  ProjectsProviderId,
  ProjectsServiceMeta,
  ProjectsServiceResult,
  Sprint,
  TaskLink,
  TasksListParams,
  UpdateProjectRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
  WorkloadEntry,
} from '@/types/projects.types';
// MOCK_LAYER_START — remove with mock/ folder when backend is live
import {
  getProjectsMockMode,
  isMockProjectsActive,
  mockProjectsApi,
  resolveProjectsUsesMock,
  setMockProjectsActive,
} from '@/app/shared/projects/mock/projects-mock-bridge';
// MOCK_LAYER_END
import { mockProjectsProvider, mockProviderMeta } from '@/app/shared/projects/providers/mock.provider';
import { apiProjectsProvider } from '@/app/shared/projects/providers/api.provider';
import type { ProjectsProvider, ProjectsProviderContext } from '@/app/shared/projects/providers/types';

function getActiveProviderId(): ProjectsProviderId {
  const mode = getProjectsMockMode();
  if (mode === 'only' || resolveProjectsUsesMock()) return 'mock';
  return 'api';
}

function getProvider(): ProjectsProvider {
  return getActiveProviderId() === 'mock' ? mockProjectsProvider : apiProjectsProvider;
}

async function withProjectsApi<T>(
  targetApi: string,
  apiCall: () => Promise<T>,
  mockCall: () => T | Promise<T>
): Promise<ProjectsServiceResult<T>> {
  const mode = getProjectsMockMode();
  const providerId = getActiveProviderId();

  if (mode === 'only' || providerId === 'mock') {
    setMockProjectsActive(true);
    const data = await mockCall();
    return {
      ok: true,
      data,
      meta: mockProviderMeta(targetApi),
    };
  }

  try {
    const data = await apiCall();
    setMockProjectsActive(false);
    return {
      ok: true,
      data,
      meta: { provider: 'api', mock_mode: 'off', target_api: targetApi },
    };
  } catch (error) {
    if (mode === 'fallback') {
      console.warn(
        '[ProjectsService] Gateway failed — using sample data (development fallback).',
        error
      );
      setMockProjectsActive(true);
      const data = await mockCall();
      return {
        ok: true,
        data,
        meta: { provider: 'mock', mock_mode: 'fallback', target_api: targetApi },
      };
    }
    setMockProjectsActive(false);
    throw error;
  }
}

export function isProjectsUsingMockData(): boolean {
  return isMockProjectsActive() || getActiveProviderId() === 'mock';
}

export function getProjectsServiceMeta(): ProjectsServiceMeta {
  const provider = getActiveProviderId();
  return {
    provider,
    mock_mode: getProjectsMockMode(),
  };
}

export const projectsService = {
  getProviderId: getActiveProviderId,

  listProjects(params: ProjectsListParams = {}) {
    const key = `projects:list:${JSON.stringify(params)}`;
    return dedupeAsync(key, () =>
      withProjectsApi(
        'GET /projects',
        () => getProvider().listProjects(params),
        () => mockProjectsApi.listProjects(params)
      )
    );
  },

  getProject(id: string) {
    return dedupeAsync(`projects:get:${id}`, () =>
      withProjectsApi(
        `GET /projects/${id}`,
        () => getProvider().getProject(id),
        () => {
          const p = mockProjectsApi.getProject(id);
          if (!p) throw new Error('Project not found');
          return p;
        }
      )
    );
  },

  createProject(request: CreateProjectRequest) {
    return withProjectsApi(
      'POST /projects',
      () => getProvider().createProject(request),
      () => mockProjectsApi.createProject(request)
    );
  },

  updateProject(id: string, request: UpdateProjectRequest) {
    return withProjectsApi(
      `PATCH /projects/${id}`,
      () => getProvider().updateProject(id, request),
      () => mockProjectsApi.updateProject(id, request)
    );
  },

  deleteProject(id: string) {
    return withProjectsApi(
      `DELETE /projects/${id}`,
      () => getProvider().deleteProject(id),
      () => mockProjectsApi.deleteProject(id)
    );
  },

  listMyTasks(params: TasksListParams = {}, ctx?: ProjectsProviderContext) {
    const key = `tasks:mine:${JSON.stringify(params)}:${ctx?.currentUserId ?? ''}`;
    return dedupeAsync(key, () =>
      withProjectsApi(
        'GET /tasks/mine',
        () => getProvider().listMyTasks(params, ctx),
        () => mockProjectsApi.listMyTasks(params, ctx?.currentUserId)
      )
    );
  },

  listProjectTasks(projectId: string, params: TasksListParams = {}) {
    const key = `projects:${projectId}:tasks:${JSON.stringify(params)}`;
    return dedupeAsync(key, () =>
      withProjectsApi(
        `GET /projects/${projectId}/tasks`,
        () => getProvider().listProjectTasks(projectId, params),
        () => mockProjectsApi.listProjectTasks(projectId, params)
      )
    );
  },

  getTask(id: string) {
    return dedupeAsync(`tasks:get:${id}`, () =>
      withProjectsApi(
        `GET /tasks/${id}`,
        () => getProvider().getTask(id),
        () => {
          const t = mockProjectsApi.getTask(id);
          if (!t) throw new Error('Task not found');
          return t;
        }
      )
    );
  },

  createTask(request: CreateTaskRequest) {
    return withProjectsApi(
      request.project_id ? `POST /projects/${request.project_id}/tasks` : 'POST /tasks',
      () => getProvider().createTask(request),
      () => mockProjectsApi.createTask(request)
    );
  },

  updateTask(id: string, request: UpdateTaskRequest) {
    return withProjectsApi(
      `PATCH /tasks/${id}`,
      () => getProvider().updateTask(id, request),
      () => mockProjectsApi.updateTask(id, request)
    );
  },

  updateTaskStatus(id: string, request: UpdateTaskStatusRequest) {
    return withProjectsApi(
      `PATCH /tasks/${id}/status`,
      () => getProvider().updateTaskStatus(id, request),
      () => mockProjectsApi.updateTaskStatus(id, request)
    );
  },

  deleteTask(id: string) {
    return withProjectsApi(
      `DELETE /tasks/${id}`,
      () => getProvider().deleteTask(id),
      () => mockProjectsApi.deleteTask(id)
    );
  },

  getBoard(projectId: string) {
    return dedupeAsync(`projects:board:${projectId}`, () =>
      withProjectsApi(
        `GET /projects/${projectId}/board`,
        () => getProvider().getBoard(projectId),
        () => mockProjectsApi.getBoard(projectId)
      )
    );
  },

  addComment(taskId: string, body: string, ctx?: ProjectsProviderContext) {
    return withProjectsApi(
      `POST /tasks/${taskId}/comments`,
      () => getProvider().addComment(taskId, body, ctx),
      () => mockProjectsApi.addComment(taskId, body, ctx?.currentUserId)
    );
  },

  addLink(taskId: string, link: Omit<TaskLink, 'id'>) {
    return withProjectsApi(
      `POST /tasks/${taskId}/links`,
      () => getProvider().addLink(taskId, link),
      () => mockProjectsApi.addLink(taskId, link)
    );
  },

  listActivity(projectId?: string, limit = 30) {
    const key = `projects:${projectId ?? 'global'}:activity:${limit}`;
    return dedupeAsync(key, () =>
      withProjectsApi(
        projectId ? `GET /projects/${projectId}/activity` : 'GET /projects/activity',
        () => getProvider().listActivity(projectId, limit),
        () => mockProjectsApi.listActivity(projectId, limit)
      )
    );
  },

  getFeedStats() {
    return dedupeAsync('projects:stats', () =>
      withProjectsApi(
        'GET /projects/stats',
        () => getProvider().getFeedStats(),
        () => mockProjectsApi.getFeedStats()
      )
    );
  },

  listDiscussion(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/discussion`,
      () => getProvider().listDiscussion(projectId),
      () => mockProjectsApi.listDiscussion(projectId)
    );
  },

  createDiscussionThread(projectId: string, title: string, body: string) {
    return withProjectsApi(
      `POST /projects/${projectId}/discussion`,
      () => getProvider().createDiscussionThread(projectId, title, body),
      () => mockProjectsApi.createDiscussionThread(projectId, title, body)
    );
  },

  listDocs(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/docs`,
      () => getProvider().listDocs(projectId),
      () => mockProjectsApi.listDocs(projectId)
    );
  },

  createDoc(projectId: string, title: string, content: string, folderId?: string | null) {
    return withProjectsApi(
      `POST /projects/${projectId}/docs`,
      () => getProvider().createDoc(projectId, title, content, folderId),
      () => mockProjectsApi.createDoc(projectId, title, content, folderId)
    );
  },

  updateDoc(docId: string, patch: { title?: string; content?: string }) {
    return withProjectsApi(
      `PATCH /projects/docs/${docId}`,
      () => getProvider().updateDoc(docId, patch),
      () => mockProjectsApi.updateDoc(docId, patch)
    );
  },

  listBoards(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/boards`,
      () => getProvider().listBoards(projectId),
      () => mockProjectsApi.listBoards(projectId)
    );
  },

  listSprints(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/sprints`,
      () => getProvider().listSprints(projectId),
      () => mockProjectsApi.listSprints(projectId)
    );
  },

  assignTaskToSprint(taskId: string, sprintId: string | null) {
    return withProjectsApi(
      `PATCH /tasks/${taskId}/sprint`,
      () => getProvider().assignTaskToSprint(taskId, sprintId),
      () => {
        mockProjectsApi.assignTaskToSprint(taskId, sprintId);
        return { ok: true };
      }
    );
  },

  getAnalytics(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/analytics`,
      () => getProvider().getAnalytics(projectId),
      () => mockProjectsApi.getAnalytics(projectId)
    );
  },

  getWorkload(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/workload`,
      () => getProvider().getWorkload(projectId),
      () => mockProjectsApi.getWorkload(projectId)
    );
  },

  listResources(projectId: string) {
    return withProjectsApi(
      `GET /projects/${projectId}/resources`,
      () => getProvider().listResources(projectId),
      () => mockProjectsApi.listResources(projectId)
    );
  },
};
