'use client';

import { useTranslation } from 'react-i18next';
import { Button, Text, Title } from 'rizzui';

export default function WorkspaceOwnerPanel() {
  const { t } = useTranslation();

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <Title as="h4" className="text-sm font-semibold">
        {t('workspace.owner.governanceTitle')}
      </Title>
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {t('workspace.owner.governanceHint')}
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled>
          {t('workspace.owner.transferAction')}
        </Button>
        <Button size="sm" variant="outline" color="danger" disabled>
          {t('workspace.owner.archiveAction')}
        </Button>
      </div>
    </div>
  );
}
