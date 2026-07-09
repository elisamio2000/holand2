'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import type { ProjectViewId } from '@/types/projects.types';
import { useTranslation } from 'react-i18next';

const VIEWS: { id: ProjectViewId; labelKey: string }[] = [
  { id: 'list', labelKey: 'projects.views.list' },
  { id: 'board', labelKey: 'projects.views.board' },
  { id: 'table', labelKey: 'projects.views.table' },
  { id: 'calendar', labelKey: 'projects.views.calendar' },
  { id: 'timeline', labelKey: 'projects.views.timeline' },
  { id: 'workload', labelKey: 'projects.views.workload' },
  { id: 'sprint', labelKey: 'projects.views.sprint' },
  { id: 'discussion', labelKey: 'projects.views.discussion' },
  { id: 'docs', labelKey: 'projects.views.docs' },
  { id: 'analytics', labelKey: 'projects.views.analytics' },
  { id: 'resources', labelKey: 'projects.views.resources' },
  { id: 'activity', labelKey: 'projects.views.activity' },
];

export default function ProjectViewsBar({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const active = (searchParams.get('view') as ProjectViewId) || 'list';
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1 border-b border-muted">
      {VIEWS.map((view) => (
        <Link
          key={view.id}
          href={`${routes.projects.detail(projectId)}?view=${view.id}`}
          className={cn(
            'px-3 py-2.5 text-sm font-medium transition-colors',
            active === view.id
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-800'
          )}
        >
          {t(view.labelKey)}
        </Link>
      ))}
    </div>
  );
}
