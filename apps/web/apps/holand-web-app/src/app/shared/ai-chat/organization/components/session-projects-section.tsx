'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiBriefcase, PiPlus, PiDotsThreeVertical, PiPencilSimple, PiTrash } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { ChatProject } from '@/types/chat.types';
import ProjectSettingsModal from './project-settings-modal';

interface SessionProjectsSectionProps {
  projects: ChatProject[];
  activeProjectId: string | null;
  onActiveProjectChange: (projectId: string | null) => void;
  isAvailable: boolean;
  isLoading?: boolean;
  onCreateProject: (data: Partial<ChatProject> & { name: string }) => Promise<void>;
  onUpdateProject: (id: string, data: Partial<ChatProject>) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
}

export default function SessionProjectsSection({
  projects,
  activeProjectId,
  onActiveProjectChange,
  isAvailable,
  isLoading,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}: SessionProjectsSectionProps) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ChatProject | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  if (isLoading) return null;
  if (!isAvailable && projects.length === 0) return null;

  return (
    <>
      <div className="border-b border-muted px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('chatSidebar.projectsTitle')}
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-gray-400 hover:text-primary"
            aria-label={t('chatSidebar.newProject')}
            onClick={() => setCreateOpen(true)}
          >
            <PiPlus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onActiveProjectChange(null)}
          className={cn(
            'mb-1 w-full rounded px-1.5 py-1 text-start text-xs',
            activeProjectId === null
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-200/10'
          )}
        >
          {t('chatSidebar.allProjects')}
        </button>
        <ul className="space-y-0.5">
          {projects.map((project) => (
            <li
              key={project.id}
              className={cn(
                'group flex items-center gap-1 rounded px-1.5 py-1 text-xs',
                activeProjectId === project.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/10'
              )}
            >
              <button
                type="button"
                onClick={() => onActiveProjectChange(project.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5"
              >
                <PiBriefcase className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{project.name}</span>
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuId(menuId === project.id ? null : project.id)}
                  className="rounded p-0.5 opacity-0 group-hover:opacity-100"
                >
                  <PiDotsThreeVertical className="h-3.5 w-3.5" />
                </button>
                {menuId === project.id && (
                  <div className="absolute end-0 top-full z-50 min-w-[120px] rounded-md border border-muted bg-gray-0 py-1 shadow-lg dark:bg-gray-50">
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 px-2 py-1 text-xs hover:bg-gray-50"
                      onClick={() => {
                        setMenuId(null);
                        setEditingProject(project);
                      }}
                    >
                      <PiPencilSimple className="h-3.5 w-3.5" />
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 px-2 py-1 text-xs text-red-600"
                      onClick={() => {
                        setMenuId(null);
                        void onDeleteProject(project.id);
                      }}
                    >
                      <PiTrash className="h-3.5 w-3.5" />
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ProjectSettingsModal
        isOpen={createOpen}
        isCreate
        project={null}
        onClose={() => setCreateOpen(false)}
        onSave={onCreateProject}
      />
      <ProjectSettingsModal
        isOpen={Boolean(editingProject)}
        project={editingProject}
        onClose={() => setEditingProject(null)}
        onSave={async (patch) => {
          if (editingProject) await onUpdateProject(editingProject.id, patch);
        }}
      />
    </>
  );
}
