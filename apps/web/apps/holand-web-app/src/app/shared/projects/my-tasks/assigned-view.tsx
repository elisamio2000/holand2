'use client';

import { useMemo, useState } from 'react';
import { Badge, Loader, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useMyTasks, useTaskDetail, EMPTY_TASKS_PARAMS } from '@/hooks/use-my-tasks';
import { useProjectsRealtime } from '@/hooks/use-projects-realtime';
import TaskRow from '../components/task-row';
import TaskDetailPanel from '../components/task-detail-panel';
import TaskCreateModal from '../components/task-create-modal';
import { useModal } from '@/app/shared/modal-views/use-modal';
import type { TaskSummary } from '@/types/projects.types';

function TaskGroup({
  title,
  tasks,
  onToggle,
  onSelect,
  selectedId,
}: {
  title: string;
  tasks: TaskSummary[];
  onToggle: (t: TaskSummary) => void;
  onSelect: (t: TaskSummary) => void;
  selectedId?: string;
}) {
  if (!tasks.length) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 py-2">
        <Text className="text-sm font-semibold">{title}</Text>
        <Badge variant="flat" size="sm">
          {tasks.length}
        </Badge>
      </div>
      <div className="rounded-xl border border-muted bg-gray-0 dark:bg-gray-50">
        <div className="grid grid-cols-12 gap-3 border-b border-muted bg-gray-50/80 px-4 py-2 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-100/50">
          <div className="col-span-5">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Priority</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-1">Case</div>
        </div>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggleComplete={onToggle}
            onSelect={onSelect}
            selected={selectedId === task.id}
          />
        ))}
      </div>
    </div>
  );
}

export default function AssignedTasksView() {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { data, loading, groupedByDue, completeTask, createTask } = useMyTasks(EMPTY_TASKS_PARAMS);
  useProjectsRealtime({ scope: 'global' });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const { task, updateStatus, addComment } = useTaskDetail(selectedId);

  const allTasks = useMemo(() => data?.items ?? [], [data?.items]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader variant="spinner" />
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        {!allTasks.length ? (
          <Text className="py-12 text-center text-gray-400">{t('projects.myTasks.noTasks')}</Text>
        ) : groupedByDue ? (
          <>
            <TaskGroup
              title={t('projects.myTasks.overdue')}
              tasks={groupedByDue.overdue}
              onToggle={(task) => void completeTask(task.id)}
              onSelect={(t) => setSelectedId(t.id)}
              selectedId={selectedId}
            />
            <TaskGroup
              title={t('projects.myTasks.today')}
              tasks={groupedByDue.today}
              onToggle={(task) => void completeTask(task.id)}
              onSelect={(t) => setSelectedId(t.id)}
              selectedId={selectedId}
            />
            <TaskGroup
              title={t('projects.myTasks.thisWeek')}
              tasks={groupedByDue.thisWeek}
              onToggle={(task) => void completeTask(task.id)}
              onSelect={(t) => setSelectedId(t.id)}
              selectedId={selectedId}
            />
            <TaskGroup
              title={t('projects.myTasks.later')}
              tasks={groupedByDue.later}
              onToggle={(task) => void completeTask(task.id)}
              onSelect={(t) => setSelectedId(t.id)}
              selectedId={selectedId}
            />
            <TaskGroup
              title={t('projects.myTasks.unscheduled')}
              tasks={groupedByDue.unscheduled}
              onToggle={(task) => void completeTask(task.id)}
              onSelect={(t) => setSelectedId(t.id)}
              selectedId={selectedId}
            />
          </>
        ) : null}
      </div>
      {task && (
        <div className="hidden w-[380px] shrink-0 lg:block">
          <TaskDetailPanel
            task={task}
            onStatusChange={(s) => void updateStatus(s)}
            onAddComment={(b) => void addComment(b)}
            onClose={() => setSelectedId(undefined)}
          />
        </div>
      )}
    </div>
  );
}
