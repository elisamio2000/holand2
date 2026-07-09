'use client';

import Link from 'next/link';
import { Loader, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { useTaskDetail } from '@/hooks/use-my-tasks';
import TaskDetailPanel from '../components/task-detail-panel';
import ProjectsPreviewBadge from '../components/projects-preview-badge';
import ProjectsApiFootprint from '../components/projects-api-footprint';

export default function TaskDetailPageView({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const { t } = useTranslation();
  const { task, loading, addComment, updateStatus } = useTaskDetail(taskId);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader variant="spinner" />
      </div>
    );
  }

  if (!task) {
    return (
      <Text className="py-12 text-center text-gray-500">
        {t('projects.tasks.notFound', 'Task not found')}
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.projects.detail(projectId)} className="text-primary hover:underline">
          {task.project_name ?? projectId}
        </Link>
        <span>/</span>
        <span>{task.title}</span>
        <ProjectsPreviewBadge />
      </div>
      <div className="min-h-[480px] rounded-xl border border-muted">
        <TaskDetailPanel
          task={task}
          onStatusChange={updateStatus}
          onAddComment={addComment}
        />
      </div>
      <ProjectsApiFootprint />
    </div>
  );
}
