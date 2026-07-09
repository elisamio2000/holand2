'use client';

import { Badge, Loader, Progressbar, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useProjectWorkload } from '@/hooks/use-project-extended';

export default function ProjectWorkloadView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, loading } = useProjectWorkload(projectId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader variant="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(data ?? []).map((entry) => {
        const pct = Math.min(100, Math.round((entry.assigned_hours / entry.capacity_hours) * 100));
        return (
          <div key={entry.user_id} className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50">
            <div className="mb-2 flex items-center justify-between">
              <Title as="h6" className="text-sm font-semibold">
                {entry.name}
              </Title>
              <Badge variant="flat">
                {entry.assigned_hours}h / {entry.capacity_hours}h
              </Badge>
            </div>
            <Progressbar value={pct} />
            <Text className="mt-2 text-xs text-gray-500">
              {entry.tasks.length} {t('projects.workload.tasks', 'tasks')}
            </Text>
          </div>
        );
      })}
    </div>
  );
}
