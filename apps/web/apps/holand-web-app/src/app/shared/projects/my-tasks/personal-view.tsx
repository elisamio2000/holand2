'use client';

import { Button, Loader, Text } from 'rizzui';
import { PiPlusBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { useMyTasks, PERSONAL_TASKS_PARAMS } from '@/hooks/use-my-tasks';
import { useProjectsRealtime } from '@/hooks/use-projects-realtime';
import TaskRow from '../components/task-row';
import TaskCreateModal from '../components/task-create-modal';

export default function PersonalListView() {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { data, loading, completeTask, createTask } = useMyTasks(PERSONAL_TASKS_PARAMS);
  useProjectsRealtime({ scope: 'global' });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader variant="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() =>
            openModal({
              view: <TaskCreateModal personal onCreate={createTask} />,
              customSize: '480px',
            })
          }
        >
          <PiPlusBold className="h-4 w-4" />
          {t('projects.tasks.create')}
        </Button>
      </div>
      <div className="rounded-xl border border-muted bg-gray-0 dark:bg-gray-50">
        {(data?.items ?? []).length ? (
          data!.items.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={(t) => void completeTask(t.id)} />
          ))
        ) : (
          <Text className="py-12 text-center text-gray-400">{t('projects.myTasks.noTasks')}</Text>
        )}
      </div>
    </div>
  );
}
