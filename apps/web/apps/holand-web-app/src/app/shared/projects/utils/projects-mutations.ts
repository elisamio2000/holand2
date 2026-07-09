import type {
  CreateProjectRequest,
  CreateTaskRequest,
  TaskStatus,
  TasksListData,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
} from '@/types/projects.types';
import { projectsService } from '@/services/projects.service';
import { invalidateProjectsCache } from '@/app/shared/projects/utils/projects-cache';
import { emitProjectsEvent } from '@/app/shared/projects/realtime/projects-event-bus';
import toast from 'react-hot-toast';

type CacheMutator<T> = (updater: T | ((prev: T | undefined) => T | undefined)) => void;

function showMutationError(err: unknown, fallback = 'Action failed'): void {
  toast.error(err instanceof Error ? err.message : fallback);
}

export async function completeTaskMutation(taskId: string, projectId?: string | null): Promise<void> {
  try {
    await projectsService.updateTaskStatus(taskId, { status: 'done' });
    invalidateProjectsCache('tasks:mine');
    if (projectId) invalidateProjectsCache(`projects:${projectId}`);
    emitProjectsEvent({
      type: 'task.status_changed',
      taskId,
      projectId: projectId ?? undefined,
      status: 'done',
    });
  } catch (err) {
    showMutationError(err);
    throw err;
  }
}

export async function moveTaskMutation(
  taskId: string,
  request: UpdateTaskStatusRequest,
  projectId?: string
): Promise<void> {
  try {
    await projectsService.updateTaskStatus(taskId, request);
    if (projectId) invalidateProjectsCache(`projects:${projectId}`);
    invalidateProjectsCache('tasks:mine');
    emitProjectsEvent({
      type: 'task.status_changed',
      taskId,
      projectId,
      status: request.status,
    });
  } catch (err) {
    showMutationError(err);
    throw err;
  }
}

export async function updateTaskMutation(
  taskId: string,
  request: UpdateTaskRequest,
  projectId?: string | null
): Promise<void> {
  try {
    await projectsService.updateTask(taskId, request);
    invalidateProjectsCache(`tasks:detail:${taskId}`);
    invalidateProjectsCache('tasks:mine');
    if (projectId) invalidateProjectsCache(`projects:${projectId}`);
    emitProjectsEvent({ type: 'task.updated', taskId, projectId: projectId ?? undefined });
  } catch (err) {
    showMutationError(err);
    throw err;
  }
}

export async function createTaskMutation(request: CreateTaskRequest): Promise<void> {
  try {
    const result = await projectsService.createTask(request);
    invalidateProjectsCache('tasks:mine');
    if (request.project_id) invalidateProjectsCache(`projects:${request.project_id}`);
    emitProjectsEvent({
      type: 'task.created',
      taskId: result.data.id,
      projectId: request.project_id ?? undefined,
    });
  } catch (err) {
    showMutationError(err);
    throw err;
  }
}

export async function createProjectMutation(request: CreateProjectRequest): Promise<void> {
  try {
    const result = await projectsService.createProject(request);
    invalidateProjectsCache('projects:list');
    invalidateProjectsCache('projects:stats');
    emitProjectsEvent({ type: 'project.updated', projectId: result.data.id });
  } catch (err) {
    showMutationError(err);
    throw err;
  }
}

/** Optimistic complete with optional local cache mutate + rollback */
export async function optimisticCompleteTask(
  taskId: string,
  data: TasksListData | null | undefined,
  mutate: CacheMutator<TasksListData>,
  projectId?: string | null
): Promise<void> {
  if (!data) {
    await completeTaskMutation(taskId, projectId);
    return;
  }
  const snapshot = data;
  mutate({
    ...data,
    items: data.items.map((t) =>
      t.id === taskId ? { ...t, status: 'done' as TaskStatus } : t
    ),
  });
  try {
    await completeTaskMutation(taskId, projectId);
  } catch {
    mutate(snapshot);
  }
}
