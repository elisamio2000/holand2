'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, Input, Loader, Text, Title } from 'rizzui';
import {
  PiMagnifyingGlassBold,
  PiPlusBold,
  PiProjectorScreenChartBold,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import MetricCard from '@core/components/cards/metric-card';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { useProjectsFeedStats, useProjectsList } from '@/hooks/use-projects';
import ProjectCard from './components/project-card';
import ProjectCreateModal from './components/project-create-modal';
import ProjectsPreviewBadge from './components/projects-preview-badge';
import ProjectsApiFootprint from './components/projects-api-footprint';
import type { ProjectStatus } from '@/types/projects.types';

type FilterStatus = ProjectStatus | 'all' | 'mine';

export default function ProjectsFeedView() {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const params = useMemo(
    () => ({
      q: searchQuery,
      status: filter === 'mine' ? ('all' as const) : filter,
      owner_id: filter === 'mine' ? 'user-self' : undefined,
    }),
    [searchQuery, filter]
  );
  const { data, loading, createProject, usingMock } = useProjectsList(params);
  const stats = useProjectsFeedStats();

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: t('projects.feed.filterAll') },
    { key: 'active', label: t('projects.feed.filterActive') },
    { key: 'archived', label: t('projects.feed.filterArchived') },
    { key: 'mine', label: t('projects.feed.filterMine') },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <PiProjectorScreenChartBold className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Title as="h4" className="text-lg font-semibold">
                  {t('projects.feed.title')}
                </Title>
                {usingMock && <ProjectsPreviewBadge />}
              </div>
              <Text className="mt-0.5 text-sm text-gray-500">
                {t('projects.feed.description')}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
              placeholder={t('projects.feed.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Button
              variant="solid"
              className="gap-1.5"
              onClick={() =>
                openModal({
                  view: <ProjectCreateModal onCreate={createProject} />,
                  customSize: '520px',
                })
              }
            >
              <PiPlusBold className="h-4 w-4" />
              {t('projects.feed.createNew')}
            </Button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard title={t('projects.stats.projects')} metric={String(stats.totalProjects)} />
          <MetricCard title={t('projects.stats.openTasks')} metric={String(stats.openTasks)} />
          <MetricCard title={t('projects.stats.overdue')} metric={String(stats.overdueTasks)} />
          <MetricCard title={t('projects.stats.linkedCases')} metric={String(stats.linkedCases)} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'solid' : 'outline'}
            onClick={() => setFilter(f.key)}
            className={cn(filter === f.key && 'bg-primary')}
          >
            {f.label}
          </Button>
        ))}
        </div>
        <Link href={routes.projects.archive} className="text-sm text-primary hover:underline">
          {t('projects.archive.title', 'Archived projects')}
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader variant="spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {!data?.items?.length && (
            <Text className="col-span-full py-12 text-center text-gray-400">
              {t('projects.feed.noProjects')}
            </Text>
          )}
        </div>
      )}

      <ProjectsApiFootprint />
    </div>
  );
}
