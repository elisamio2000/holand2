'use client';

import Link from 'next/link';
import { Badge, Loader, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useProjectResources } from '@/hooks/use-project-extended';

export default function ProjectResourcesView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, loading } = useProjectResources(projectId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader variant="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(data ?? []).map((res) => (
        <Link
          key={res.id}
          href={res.href}
          className="flex items-center justify-between rounded-xl border border-muted bg-gray-0 px-4 py-3 hover:bg-gray-50 dark:bg-gray-50"
        >
          <Text className="text-sm font-medium">{res.label}</Text>
          <Badge variant="flat" size="sm">
            {res.type}
          </Badge>
        </Link>
      ))}
      {!data?.length && (
        <Text className="py-8 text-center text-gray-400">
          {t('projects.resources.empty', 'No linked resources')}
        </Text>
      )}
    </div>
  );
}
