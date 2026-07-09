'use client';

import { Title, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import ExternalFrontendPluginsGrid from '@/app/shared/plugins/external-frontend-plugins-grid';
import ExternalPluginsGrid from '@/app/shared/plugins/external-plugins-grid';

/**
 * External plugins: in-app curated tools vs executor-backed catalog.
 */
export default function ExternalPluginsHub() {
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <div className="rounded-lg border border-muted bg-primary/5 p-4 dark:bg-primary/10">
        <Title as="h6" className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('plugins.sections.splitExplainerTitle')}
        </Title>
        <Text className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          {t('plugins.sections.splitExplainerIntro')}
        </Text>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
          <li>{t('plugins.sections.splitBulletFrontend')}</li>
          <li>{t('plugins.sections.splitBulletExecutor')}</li>
          <li>{t('plugins.sections.splitBulletInternal')}</li>
        </ul>
      </div>

      <section className="space-y-3">
        <div>
          <Title as="h5" className="text-lg font-semibold">
            {t('plugins.sections.frontendTitle')}
          </Title>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('plugins.sections.frontendHint')}
          </Text>
        </div>
        <ExternalFrontendPluginsGrid />
      </section>

      <section className="space-y-3 border-t border-muted pt-8">
        <div>
          <Title as="h5" className="text-lg font-semibold">
            {t('plugins.sections.executorTitle')}
          </Title>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('plugins.sections.executorHint')}
          </Text>
        </div>
        <ExternalPluginsGrid />
      </section>
    </div>
  );
}
