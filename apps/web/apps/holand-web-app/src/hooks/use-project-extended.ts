'use client';

import { useCallback } from 'react';
import { useResource } from '@/hooks/use-resource';
import { projectsService } from '@/services/projects.service';

function useProjectResource<T>(
  cacheKey: string | undefined,
  fetcher: () => Promise<T>,
  enabled = true
) {
  const stableFetcher = useCallback(fetcher, [fetcher]);
  return useResource(stableFetcher, {
    cacheKey,
    enabled: enabled && !!cacheKey,
    staleTimeMs: 30_000,
  });
}

export function useProjectDiscussion(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:discussion` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listDiscussion(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}

export function useProjectDocs(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:docs` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listDocs(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}

export function useProjectBoards(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:boards-meta` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listBoards(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}

export function useProjectSprints(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:sprints` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listSprints(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}

export function useProjectAnalytics(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:analytics` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.getAnalytics(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}

export function useProjectWorkload(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:workload` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.getWorkload(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}

export function useProjectResources(projectId: string | undefined) {
  const key = projectId ? `projects:${projectId}:resources` : undefined;
  const fetcher = useCallback(async () => {
    if (!projectId) throw new Error('No project');
    const result = await projectsService.listResources(projectId);
    return result.data;
  }, [projectId]);
  return useProjectResource(key, fetcher, !!projectId);
}
