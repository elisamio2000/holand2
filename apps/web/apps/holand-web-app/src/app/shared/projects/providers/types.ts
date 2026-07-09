// ============================================
// Projects providers — types
// ============================================

import type {
  ActivityEvent,
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
  ProjectSummary,
  ProjectsListData,
  ProjectsListParams,
  ProjectsProviderId,
  ProjectsServiceMeta,
  Sprint,
  TaskComment,
  TaskDetail,
  TaskLink,
  TaskSummary,
  TasksListData,
  TasksListParams,
  UpdateProjectRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
  WorkloadEntry,
} from '@/types/projects.types';

export interface ProjectsProviderContext {
  currentUserId?: string;
}

export interface ProjectsProvider {
  readonly id: ProjectsProviderId;
  listProjects(params: ProjectsListParams): Promise<ProjectsListData>;
  getProject(id: string): Promise<ProjectDetail | null>;
  createProject(request: CreateProjectRequest): Promise<ProjectSummary>;
  updateProject(id: string, request: UpdateProjectRequest): Promise<ProjectSummary>;
  deleteProject(id: string): Promise<{ deleted: boolean }>;
  listMyTasks(params: TasksListParams, ctx?: ProjectsProviderContext): Promise<TasksListData>;
  listProjectTasks(projectId: string, params?: TasksListParams): Promise<TasksListData>;
  getTask(id: string): Promise<TaskDetail | null>;
  createTask(request: CreateTaskRequest): Promise<TaskSummary>;
  updateTask(id: string, request: UpdateTaskRequest): Promise<TaskSummary>;
  updateTaskStatus(id: string, request: UpdateTaskStatusRequest): Promise<TaskSummary>;
  deleteTask(id: string): Promise<{ deleted: boolean }>;
  getBoard(projectId: string): Promise<ProjectBoardData>;
  addComment(taskId: string, body: string, ctx?: ProjectsProviderContext): Promise<TaskComment>;
  addLink(taskId: string, link: Omit<TaskLink, 'id'>): Promise<TaskLink>;
  listActivity(projectId?: string, limit?: number): Promise<ActivityEvent[]>;
  getFeedStats(): Promise<Record<string, number>>;
  listDiscussion(projectId: string): Promise<DiscussionThread[]>;
  createDiscussionThread(projectId: string, title: string, body: string): Promise<DiscussionThread>;
  listDocs(projectId: string): Promise<{ folders: ProjectDocFolder[]; docs: ProjectDoc[] }>;
  createDoc(
    projectId: string,
    title: string,
    content: string,
    folderId?: string | null
  ): Promise<ProjectDoc>;
  updateDoc(docId: string, patch: { title?: string; content?: string }): Promise<ProjectDoc>;
  listBoards(projectId: string): Promise<ProjectBoardMeta[]>;
  listSprints(projectId: string): Promise<Sprint[]>;
  assignTaskToSprint(taskId: string, sprintId: string | null): Promise<{ ok: boolean }>;
  getAnalytics(projectId: string): Promise<ProjectAnalytics>;
  getWorkload(projectId: string): Promise<WorkloadEntry[]>;
  listResources(projectId: string): Promise<ProjectResource[]>;
}

export function buildMeta(
  provider: ProjectsProviderId,
  mockMode: ProjectsServiceMeta['mock_mode'],
  targetApi?: string
): ProjectsServiceMeta {
  return { provider, mock_mode: mockMode, target_api: targetApi };
}
