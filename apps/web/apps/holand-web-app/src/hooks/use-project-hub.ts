'use client';

import { useCallback, useEffect } from 'react';
import { useResource } from '@/hooks/use-resource';
import {
  isProjectsUsingMockData,
  projectsService,
} from '@/services/projects.service';
import type {
  ActivityEvent,
  ProjectBoardData,
  ProjectViewId,
  TaskStatus,
  TasksListData,
  UpdateTaskStatusRequest,
} from '@/types/projects.types';

export function useProjectHub(projectId: string | undefined, view: ProjectViewId = 'list') {
  const tasksKey = projectId ? `projects:${projectId}:tasks` : undefined;
  const boardKey = projectId && view === 'board' ? `projects:${projectId}:board` : undefined;
  const activityKey = projectId ? `projects:${projectId}:activity` : undefined;

  const fetchTasks = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listProjectTasks(projectId);
    return result.data;
  }, [projectId]);

  const fetchBoard = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.getBoard(projectId);
    return result.data;
  }, [projectId]);

  const fetchActivity = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listActivity(projectId);
    return result.data;
  }, [projectId]);

  const tasksRes = useResource(fetchTasks, {
    cacheKey: tasksKey,
    enabled: !!projectId,
    staleTimeMs: 20_000,
  });

  const boardRes = useResource(fetchBoard, {
    cacheKey: boardKey,
    enabled: !!projectId && view === 'board',
    staleTimeMs: 15_000,
  });

  const activityRes = useResource(fetchActivity, {
    cacheKey: activityKey,
    enabled: !!projectId,
    staleTimeMs: 30_000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      tasksRes.refetch(),
      activityRes.refetch(),
      view === 'board' ? boardRes.refetch() : Promise.resolve(),
    ]);
  }, [tasksRes, boardRes, activityRes, view]);

  useEffect(() => {
    const handler = () => void refreshAll();
    window.addEventListener('projects-cache-invalidate', handler);
    return () => window.removeEventListener('projects-cache-invalidate', handler);
  }, [refreshAll]);

  const moveTask = useCallback(
    async (taskId: string, status: TaskStatus, position?: number) => {
      const request: UpdateTaskStatusRequest = { status, position };
      const tasks = tasksRes.data;
      const board = boardRes.data;

      if (tasks) {
        tasksRes.mutate({
          ...tasks,
          items: tasks.items.map((t) => (t.id === taskId ? { ...t, status } : t)),
        });
      }
      if (board) {
        const moved = board.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
        if (moved) {
          const updated = {
            ...board,
            columns: board.columns.map((col) => ({
              ...col,
              tasks:
                col.status === status
                  ? [...col.tasks.filter((t) => t.id !== taskId), { ...moved, status }]
                  : col.tasks.filter((t) => t.id !== taskId),
            })),
          };
          boardRes.mutate(updated);
        }
      }

      try {
        await projectsService.updateTaskStatus(taskId, request);
        await refreshAll();
      } catch (e) {
        await refreshAll();
        throw e;
      }
    },
    [tasksRes, boardRes, refreshAll]
  );

  const loading = tasksRes.loading || activityRes.loading || (view === 'board' && boardRes.loading);
  const error =
    tasksRes.error?.message ?? activityRes.error?.message ?? boardRes.error?.message ?? null;

  return {
    board: (boardRes.data as ProjectBoardData | undefined) ?? null,
    tasks: (tasksRes.data as TasksListData | undefined) ?? null,
    activity: (activityRes.data as ActivityEvent[] | undefined) ?? [],
    loading,
    error,
    usingMock: isProjectsUsingMockData(),
    refresh: refreshAll,
    moveTask,
  };
}
