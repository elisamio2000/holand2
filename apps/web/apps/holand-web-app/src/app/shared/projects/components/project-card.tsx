'use client';

import Link from 'next/link';
import { Badge, Progressbar, Text, Title } from 'rizzui';
import { PiFolderOpenBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import type { ProjectSummary } from '@/types/projects.types';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-200',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const progress =
    project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0;

  return (
    <Link
      href={routes.projects.detail(project.id)}
      className="group block rounded-xl border border-muted bg-gray-0 p-5 transition-all hover:shadow-md dark:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <PiFolderOpenBold className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Title as="h6" className="text-sm font-semibold group-hover:text-primary">
              {project.name}
            </Title>
            <Text className="text-xs text-gray-500">{project.owner_name}</Text>
          </div>
        </div>
        <Badge variant="flat" className={cn('text-xs', statusColors[project.status])}>
          {project.status}
        </Badge>
      </div>

      {project.description && (
        <Text className="mt-3 line-clamp-2 text-xs text-gray-500">{project.description}</Text>
      )}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs">
          <Text className="text-gray-500">{project.open_task_count} open</Text>
          <Text className="font-medium">{progress}%</Text>
        </div>
        <Progressbar value={progress} />
      </div>

      {project.linked_case_ids.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {project.linked_case_ids.slice(0, 2).map((id) => (
            <Badge key={id} variant="flat" size="sm" className="bg-gray-100 text-gray-600">
              {id.replace('case-mock-', 'Case #')}
            </Badge>
          ))}
        </div>
      )}
    </Link>
  );
}
