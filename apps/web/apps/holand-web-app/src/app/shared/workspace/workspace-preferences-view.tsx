'use client';

import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import WorkspaceAppearancePanel from '@/app/shared/workspace/components/workspace-appearance-panel';

export default function WorkspacePreferencesView() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <Title as="h2" className="text-xl font-semibold">
          {t('workspace.preferences.title')}
        </Title>
        <Text className="text-sm text-gray-500">{t('workspace.preferences.subtitle')}</Text>
      </div>
      <div className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        <WorkspaceAppearancePanel mode="global" />
      </div>
    </div>
  );
}
