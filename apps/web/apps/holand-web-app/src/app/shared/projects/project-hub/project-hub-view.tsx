'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Loader, Progressbar, Text, Title } from 'rizzui';
import { PiPlusBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { useProjectDetail } from '@/hooks/use-projects';
import { useProjectHub } from '@/hooks/use-project-hub';
import { useTaskDetail } from '@/hooks/use-my-tasks';
import {
  completeTaskMutation,
  createTaskMutation,
} from '@/app/shared/projects/utils/projects-mutations';
import ProjectsPreviewBadge from '../components/projects-preview-badge';
import ProjectsApiFootprint from '../components/projects-api-footprint';
import TaskDetailPanel from '../components/task-detail-panel';
import TaskCreateModal from '../components/task-create-modal';
import ProjectViewsBar from './project-views-bar';
import ProjectListView from './project-list-view';
import ProjectBoardView from './project-board-view';
import ProjectTableView from './project-table-view';
import ProjectActivityView from './project-activity-view';
import ProjectDiscussionView from './project-discussion-view';
import ProjectDocsView from './project-docs-view';
import ProjectWorkloadView from './project-workload-view';
import ProjectSprintView from './project-sprint-view';
import ProjectAnalyticsView from './project-analytics-view';
import ProjectResourcesView from './project-resources-view';
import ProjectCalendarView from './project-calendar-view';
import ProjectTimelineView from './project-timeline-view';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { useProjectsRealtime } from '@/hooks/use-projects-realtime';
import ProjectAutomationsPanel from './project-automations-panel';
import type { CreateTaskRequest, ProjectViewId } from '@/types/projects.types';

const TASK_VIEWS: ProjectViewId[] = ['list', 'board', 'table', 'calendar', 'timeline', 'sprint'];

export default function ProjectHubView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as ProjectViewId) || 'list';
  const { project, loading: projectLoading } = useProjectDetail(projectId);
  const needsTaskData = TASK_VIEWS.includes(view);
  const { board, tasks, activity, loading: hubLoading, moveTask, refresh } = useProjectHub(
    projectId,
    view
  );
  useProjectsRealtime({ scope: 'project', projectId });

  const handleCreateTask = async (request: CreateTaskRequest) => {
    await createTaskMutation({ ...request, project_id: projectId });
    await refresh();
  };
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const { task, updateStatus, addComment } = useTaskDetail(selectedTaskId);
  const { openModal } = useModal();

  const progress =
    project && project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0;

  const showHubLoader = projectLoading || (needsTaskData && hubLoading);

  if (showHubLoader) {
    return (
      <div className="flex justify-center py-16">
        <Loader variant="spinner" />
      </div>
    );
  }

  if (!project) {
    return <Text className="py-12 text-center text-gray-400">Project not found</Text>;
  }

  const taskItems = tasks?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Title as="h4" className="text-xl font-semibold">
                {project.name}
              </Title>
              <Badge variant="flat">{project.status}</Badge>
              <ProjectsPreviewBadge />
            </div>
            <Text className="mt-1 text-sm text-gray-500">
              {project.owner_name} · {project.open_task_count} open · {project.overdue_task_count}{' '}
              overdue
            </Text>
            <div className="mt-4 max-w-md">
              <Progressbar value={progress} />
            </div>
          </div>
          <Button
            variant="solid"
            className="gap-1.5"
            onClick={() =>
              openModal({
                view: <TaskCreateModal projectId={projectId} onCreate={handleCreateTask} />,
                customSize: '480px',
              })
            }
          >
            <PiPlusBold className="h-4 w-4" />
            {t('projects.board.addCard')}
          </Button>
        </div>
        <div className="mt-6">
          <ProjectViewsBar projectId={projectId} />
        </div>
      </div>

      {project.linked_case_ids.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-muted bg-primary/5 px-4 py-3">
          <Text className="text-xs font-semibold text-gray-600">{t('projects.hub.linkedCases')}:</Text>
          {project.linked_case_ids.map((id) => (
            <Link key={id} href={`/cases/${id}`} className="text-xs text-primary hover:underline">
              {id.replace('case-mock-', 'Case #')}
            </Link>
          ))}
          <Link href={routes.messages} className="text-xs text-primary">
            {t('nav.messages')}
          </Link>
          <Link href={routes.eventCalendar} className="text-xs text-primary">
            {t('nav.calendar')}
          </Link>
        </div>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {view === 'list' && (
            <ProjectListView
              tasks={taskItems}
              onToggle={(task) => void completeTaskMutation(task.id, projectId)}
              onSelect={(t) => setSelectedTaskId(t.id)}
            />
          )}
          {view === 'board' && board && (
            <ProjectBoardView
              board={board}
              onMove={(id, status, pos) => void moveTask(id, status, pos)}
              onSelect={(t) => setSelectedTaskId(t.id)}
            />
          )}
          {view === 'table' && <ProjectTableView tasks={taskItems} />}
          {view === 'calendar' && <ProjectCalendarView tasks={taskItems} />}
          {view === 'timeline' && <ProjectTimelineView tasks={taskItems} />}
          {view === 'workload' && <ProjectWorkloadView projectId={projectId} />}
          {view === 'sprint' && (
            <ProjectSprintView projectId={projectId} backlogTasks={taskItems} />
          )}
          {view === 'discussion' && <ProjectDiscussionView projectId={projectId} />}
          {view === 'docs' && <ProjectDocsView projectId={projectId} />}
          {view === 'analytics' && <ProjectAnalyticsView projectId={projectId} />}
          {view === 'resources' && <ProjectResourcesView projectId={projectId} />}
          {view === 'activity' && (
            <>
              <ProjectActivityView events={activity} />
              <div className="mt-6">
                <ProjectAutomationsPanel />
              </div>
            </>
          )}
        </div>
        {task && ['list', 'board', 'table'].includes(view) && (
          <div className="hidden w-[380px] shrink-0 lg:block">
            <TaskDetailPanel
              task={task}
              onStatusChange={(s) => void updateStatus(s)}
              onAddComment={(b) => void addComment(b)}
              onClose={() => setSelectedTaskId(undefined)}
            />
          </div>
        )}
      </div>

      <ProjectsApiFootprint />
    </div>
  );
}
