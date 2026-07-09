'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useResource } from '@/hooks/use-resource';
import {
  isProjectsUsingMockData,
  projectsService,
} from '@/services/projects.service';
import {
  DEFAULT_PROJECTS_LIST_PARAMS,
  EMPTY_TASKS_PARAMS,
  PERSONAL_TASKS_PARAMS,
  projectsListCacheKey,
  tasksCacheKey,
} from '@/app/shared/projects/utils/stable-params';
import type {
  CreateProjectRequest,
  CreateTaskRequest,
  ProjectDetail,
  ProjectsListData,
  ProjectsListParams,
  TaskDetail,
  TaskStatus,
  TasksListData,
  TasksListParams,
  UpdateTaskRequest,
} from '@/types/projects.types';
import { groupTasksByDueBucket } from '@/app/shared/projects/utils/task-due-buckets';

function useCacheInvalidationListener(refetch: () => void) {
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener('projects-cache-invalidate', handler);
    return () => window.removeEventListener('projects-cache-invalidate', handler);
  }, [refetch]);
}

export function useProjectsList(params: ProjectsListParams = DEFAULT_PROJECTS_LIST_PARAMS) {
  const cacheKey = projectsListCacheKey(params);

  const fetcher = useCallback(async () => {
    const result = await projectsService.listProjects(params);
    return result.data;
  }, [params]);

  const { data, loading, error, refetch, mutate, isStale } = useResource(fetcher, {
    cacheKey,
    staleTimeMs: 30_000,
  });

  useCacheInvalidationListener(() => void refetch());

  const createProject = useCallback(
    async (request: CreateProjectRequest) => {
      const result = await projectsService.createProject(request);
      await refetch();
      return result.data;
    },
    [refetch]
  );

  return {
    data: data ?? null,
    loading,
    error: error?.message ?? null,
    usingMock: isProjectsUsingMockData(),
    isStale,
    refresh: refetch,
    createProject,
  };
}

export function useProjectDetail(projectId: string | undefined) {
  const cacheKey = projectId ? `projects:detail:${projectId}` : undefined;

  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project id');
    const result = await projectsService.getProject(projectId);
    return result.data;
  }, [projectId]);

  const { data, loading, error, refetch } = useResource(fetcher, {
    cacheKey,
    enabled: !!projectId,
    staleTimeMs: 45_000,
  });

  useCacheInvalidationListener(() => void refetch());

  return {
    project: data ?? null,
    loading,
    error: error?.message ?? null,
    usingMock: isProjectsUsingMockData(),
    refresh: refetch,
  };
}

export function useProjectsFeedStats() {
  const fetcher = useCallback(async () => {
    const result = await projectsService.getFeedStats();
    return result.data;
  }, []);

  const { data } = useResource(fetcher, {
    cacheKey: 'projects:stats',
    staleTimeMs: 60_000,
  });

  return data ?? null;
}

export { EMPTY_TASKS_PARAMS, PERSONAL_TASKS_PARAMS, DEFAULT_PROJECTS_LIST_PARAMS };

export function useMyTasks(
  params: TasksListParams = EMPTY_TASKS_PARAMS,
  currentUserId?: string
) {
  const cacheKey = tasksCacheKey(params, currentUserId);

  const fetcher = useCallback(async () => {
    const result = await projectsService.listMyTasks(params, { currentUserId });
    return result.data;
  }, [currentUserId, params]);

  const { data, loading, error, refetch, mutate } = useResource(fetcher, {
    cacheKey,
    staleTimeMs: 30_000,
  });

  useCacheInvalidationListener(() => void refetch());

  const groupedByDue = useMemo(() => {
    if (!data?.items) return null;
    return groupTasksByDueBucket(data.items);
  }, [data?.items]);

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!data) {
        await projectsService.updateTaskStatus(taskId, { status: 'done' });
        await refetch();
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
        await projectsService.updateTaskStatus(taskId, { status: 'done' });
        await refetch();
      } catch (e) {
        mutate(snapshot);
        throw e;
      }
    },
    [data, mutate, refetch]
  );

  const createTask = useCallback(
    async (request: CreateTaskRequest) => {
      const result = await projectsService.createTask(request);
      await refetch();
      return result.data;
    },
    [refetch]
  );

  const updateTask = useCallback(
    async (taskId: string, request: UpdateTaskRequest) => {
      const result = await projectsService.updateTask(taskId, request);
      await refetch();
      return result.data;
    },
    [refetch]
  );

  return {
    data: data ?? null,
    loading,
    error: error?.message ?? null,
    usingMock: isProjectsUsingMockData(),
    groupedByDue,
    refresh: refetch,
    completeTask,
    createTask,
    updateTask,
  };
}

export function useTaskDetail(taskId: string | undefined) {
  const cacheKey = taskId ? `tasks:detail:${taskId}` : undefined;

  const fetcher = useCallback(async () => {
    if (!taskId) throw new Error('No task id');
    const result = await projectsService.getTask(taskId);
    return result.data;
  }, [taskId]);

  const { data, loading, error, refetch } = useResource(fetcher, {
    cacheKey,
    enabled: !!taskId,
    staleTimeMs: 30_000,
  });

  useCacheInvalidationListener(() => void refetch());

  const updateStatus = useCallback(
    async (status: TaskStatus) => {
      if (!taskId) return;
      await projectsService.updateTaskStatus(taskId, { status });
      await refetch();
    },
    [taskId, refetch]
  );

  const addComment = useCallback(
    async (body: string) => {
      if (!taskId) return;
      await projectsService.addComment(taskId, body);
      await refetch();
    },
    [taskId, refetch]
  );

  return {
    task: (data as TaskDetail | undefined) ?? null,
    loading,
    error: error?.message ?? null,
    refresh: refetch,
    updateStatus,
    addComment,
  };
}
