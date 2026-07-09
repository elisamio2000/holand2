'use client';

import { Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { getProjectsServiceMeta } from '@/services/projects.service';

export default function ProjectsApiFootprint() {
  const { t } = useTranslation();
  const meta = getProjectsServiceMeta();

  if (process.env.NODE_ENV === 'production' && meta.mock_mode === 'off') {
    return null;
  }

  return (
    <div className="rounded-xl border border-dashed border-muted bg-gray-50/80 px-4 py-3 dark:bg-gray-100/30">
      <Text className="text-xs font-semibold text-gray-600 dark:text-gray-400">
        {t('projects.mock.footprintTitle')}
      </Text>
      <Text className="mt-1 font-mono text-[11px] text-gray-500">
        provider={meta.provider} · mock_mode={meta.mock_mode}
        {meta.target_api ? ` · ${meta.target_api}` : ''}
      </Text>
      <Text className="mt-2 text-[11px] text-gray-500">{t('projects.mock.footprintNote')}</Text>
    </div>
  );
}
