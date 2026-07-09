'use client';

import { useState } from 'react';
import { Button, Input, Text, Title } from 'rizzui';
import { PiListChecksBold, PiMagnifyingGlassBold, PiPlusBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { useMyTasks, EMPTY_TASKS_PARAMS } from '@/hooks/use-my-tasks';
import ProjectsPreviewBadge from '../components/projects-preview-badge';
import ProjectsApiFootprint from '../components/projects-api-footprint';
import TaskCreateModal from '../components/task-create-modal';
import MyTasksSubNav from './my-tasks-sub-nav';

export default function MyTasksHubShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { createTask } = useMyTasks(EMPTY_TASKS_PARAMS);
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <PiListChecksBold className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Title as="h4" className="text-lg font-semibold">
                  {t('projects.myTasks.title')}
                </Title>
                <ProjectsPreviewBadge />
              </div>
              <Text className="mt-0.5 text-sm text-gray-500">
                {t('projects.myTasks.description')}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
              placeholder={t('common.search') + '...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button
              variant="solid"
              className="gap-1.5"
              onClick={() =>
                openModal({
                  view: <TaskCreateModal onCreate={createTask} />,
                  customSize: '480px',
                })
              }
            >
              <PiPlusBold className="h-4 w-4" />
              {t('projects.tasks.create')}
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <MyTasksSubNav />
        </div>
      </div>
      {children}
      <ProjectsApiFootprint />
    </div>
  );
}
