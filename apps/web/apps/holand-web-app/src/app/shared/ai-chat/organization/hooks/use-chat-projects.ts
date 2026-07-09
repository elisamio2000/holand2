'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatFeatureHealthMap } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import {
  assignSessionToProjectAdapter,
  createProjectAdapter,
  deleteProjectAdapter,
  listProjectsAdapter,
  updateProjectAdapter,
} from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import { projectsDevStore } from '@/app/shared/ai-chat/adapters/dev-stores/projects-dev-store';
import type { ChatProject } from '@/types/chat.types';

export function useChatProjects(featureHealth: ChatFeatureHealthMap) {
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listProjectsAdapter(featureHealth);
      setProjects(list);
      setIsAvailable(
        featureHealth.projects === 'available' ||
          (process.env.NODE_ENV === 'development' && list.length > 0)
      );
    } catch (error) {
      console.error('[useChatProjects]', error);
      setProjects([]);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [featureHealth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (body: Partial<ChatProject> & { name: string }) => {
      const project = await createProjectAdapter(featureHealth, body);
      await refresh();
      return project;
    },
    [featureHealth, refresh]
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<ChatProject>) => {
      const project = await updateProjectAdapter(featureHealth, id, patch);
      await refresh();
      return project;
    },
    [featureHealth, refresh]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await deleteProjectAdapter(featureHealth, id);
      if (activeProjectId === id) setActiveProjectId(null);
      await refresh();
    },
    [featureHealth, activeProjectId, refresh]
  );

  const assignSessionToProject = useCallback(
    async (sessionId: string, projectId: string | null) => {
      await assignSessionToProjectAdapter(featureHealth, sessionId, projectId);
    },
    [featureHealth]
  );

  const getSessionProjectId = useCallback(
    (sessionId: string, apiProjectId?: string | null) => {
      if (apiProjectId != null) return apiProjectId;
      if (process.env.NODE_ENV === 'development') {
        return projectsDevStore.getSessionProjectId(sessionId);
      }
      return null;
    },
    []
  );

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    isLoading,
    isAvailable,
    refresh,
    createProject,
    updateProject,
    deleteProject,
    assignSessionToProject,
    getSessionProjectId,
  };
}
