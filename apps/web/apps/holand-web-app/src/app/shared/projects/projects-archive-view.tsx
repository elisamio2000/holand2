'use client';

import { useMemo } from 'react';
import { Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useProjectsList } from '@/hooks/use-projects';
import ProjectCard from '@/app/shared/projects/components/project-card';
import ProjectsPreviewBadge from '@/app/shared/projects/components/projects-preview-badge';

export default function ProjectsArchiveView() {
  const { t } = useTranslation();
  const params = useMemo(() => ({ status: 'archived' as const }), []);
  const { data, loading } = useProjectsList(params);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex items-center gap-2">
          <Title as="h4" className="text-lg font-semibold">
            {t('projects.archive.title', 'Archived projects')}
          </Title>
          <ProjectsPreviewBadge />
        </div>
        <Text className="mt-1 text-sm text-gray-500">
          {t('projects.archive.description', 'Projects marked as archived')}
        </Text>
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader variant="spinner" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {!data?.items?.length && (
            <Text className="col-span-full py-12 text-center text-gray-400">
              {t('projects.archive.empty', 'No archived projects')}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}
