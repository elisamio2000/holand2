'use client';

import { Badge, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import MetricCard from '@core/components/cards/metric-card';
import { useProjectSprints } from '@/hooks/use-project-extended';
import type { TaskSummary } from '@/types/projects.types';

function BurndownMock({ total }: { total: number }) {
  const points = Array.from({ length: 7 }, (_, i) => Math.max(0, total - i * 2));
  const max = Math.max(...points, 1);
  return (
    <div className="flex h-24 items-end gap-1">
      {points.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-primary/70"
          style={{ height: `${(v / max) * 100}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

export default function ProjectSprintView({
  projectId,
  backlogTasks,
}: {
  projectId: string;
  backlogTasks: TaskSummary[];
}) {
  const { t } = useTranslation();
  const { data: sprints, loading } = useProjectSprints(projectId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader variant="spinner" />
      </div>
    );
  }

  const active = sprints?.find((s) => s.status === 'active');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Title as="h6" className="text-sm font-semibold">
          {t('projects.sprint.backlog', 'Backlog')}
        </Title>
        <div className="rounded-xl border border-muted">
          {backlogTasks.slice(0, 8).map((task) => (
            <div key={task.id} className="border-b border-muted px-4 py-2 text-sm last:border-0">
              {task.title}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {active && (
          <div className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50">
            <div className="mb-2 flex items-center gap-2">
              <Title as="h6" className="text-sm font-semibold">
                {active.name}
              </Title>
              <Badge variant="flat">{active.status}</Badge>
            </div>
            <Text className="text-sm text-gray-500">{active.goal}</Text>
            <div className="mt-4">
              <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
                {t('projects.sprint.burndown', 'Burndown (mock)')}
              </Text>
              <BurndownMock total={active.task_ids.length || 8} />
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {(sprints ?? []).map((s) => (
            <MetricCard
              key={s.id}
              title={s.name}
              metric={String(s.task_ids.length)}
              metricClassName="text-lg"
              className="border border-muted"
            >
              <Text className="text-xs text-gray-500">{s.status}</Text>
            </MetricCard>
          ))}
        </div>
      </div>
    </div>
  );
}
