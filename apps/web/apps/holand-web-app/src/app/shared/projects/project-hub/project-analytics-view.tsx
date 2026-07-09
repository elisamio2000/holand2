'use client';

import { Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import MetricCard from '@core/components/cards/metric-card';
import { useProjectAnalytics } from '@/hooks/use-project-extended';

export default function ProjectAnalyticsView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, loading } = useProjectAnalytics(projectId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader variant="spinner" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title={t('projects.analytics.velocity', 'Velocity')} metric={String(data.velocity)} />
        <MetricCard
          title={t('projects.analytics.completion', 'Completion rate')}
          metric={`${Math.round(data.completion_rate * 100)}%`}
        />
        <MetricCard
          title={t('projects.analytics.overdue', 'Overdue now')}
          metric={String(data.overdue_trend.at(-1)?.count ?? 0)}
        />
        <MetricCard
          title={t('projects.analytics.members', 'Members')}
          metric={String(data.member_workload.length)}
        />
      </div>
      <div className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        <Title as="h6" className="mb-3 text-sm font-semibold">
          {t('projects.analytics.memberLoad', 'Member workload')}
        </Title>
        <div className="space-y-2">
          {data.member_workload.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-sm">
              <Text>{m.name}</Text>
              <Text className="text-gray-500">
                {m.open_tasks} tasks · {m.hours}h
              </Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
