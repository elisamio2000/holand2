'use client';

import { Badge, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useMyTasks, EMPTY_TASKS_PARAMS } from '@/hooks/use-my-tasks';
import { useProjectsRealtime } from '@/hooks/use-projects-realtime';
import TaskRow from '../components/task-row';
import WidgetCard from '@core/components/cards/widget-card';

export default function TodayTasksView() {
  const { t } = useTranslation();
  const { data, loading, groupedByDue, completeTask } = useMyTasks(EMPTY_TASKS_PARAMS);
  useProjectsRealtime({ scope: 'global' });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader variant="spinner" />
      </div>
    );
  }

  const myWorkTasks = [
    ...(groupedByDue?.overdue ?? []),
    ...(groupedByDue?.today ?? []),
    ...(groupedByDue?.thisWeek ?? []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <WidgetCard title={t('projects.myTasks.myWork')} className="lg:col-span-2">
        <div className="space-y-4">
          {['overdue', 'today', 'thisWeek', 'later', 'unscheduled'].map((key) => {
            const tasks = groupedByDue?.[key as keyof typeof groupedByDue] ?? [];
            if (!tasks.length) return null;
            const label =
              key === 'overdue'
                ? t('projects.myTasks.overdue')
                : key === 'today'
                  ? t('projects.myTasks.today')
                  : key === 'thisWeek'
                    ? t('projects.myTasks.thisWeek')
                    : key === 'later'
                      ? t('projects.myTasks.later')
                      : t('projects.myTasks.unscheduled');
            return (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <Title as="h6" className="text-sm font-semibold">
                    {label}
                  </Title>
                  <Badge variant="flat" size="sm">
                    {tasks.length}
                  </Badge>
                </div>
                <div className="rounded-lg border border-muted">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggleComplete={(t) => void completeTask(t.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {!myWorkTasks.length && (
            <Text className="text-sm text-gray-400">{t('projects.myTasks.noTasks')}</Text>
          )}
        </div>
      </WidgetCard>
      <WidgetCard title={t('projects.myTasks.agenda')}>
        <Text className="text-sm text-gray-500">{t('projects.myTasks.agendaHint')}</Text>
        <div className="mt-4 space-y-2">
          {(groupedByDue?.today ?? []).slice(0, 4).map((task) => (
            <div key={task.id} className="rounded-lg border border-muted p-2 text-sm">
              {task.title}
            </div>
          ))}
        </div>
      </WidgetCard>
    </div>
  );
}
