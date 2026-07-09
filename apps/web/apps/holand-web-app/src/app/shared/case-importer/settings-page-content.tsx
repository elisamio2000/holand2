// ============================================
// Case Import Settings Page Content — localized page header
// ============================================

'use client';

import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import PluginSettingsView from '@/app/shared/case-importer/plugin-settings-view';

/**
 * SettingsPageContent — Client-side localized wrapper for settings page header.
 */
export default function SettingsPageContent() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={t('caseImporter.pluginSettings.pageTitle', 'Import Tool Settings')}
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: t('breadcrumbs.home', 'Home') },
          { href: routes.caseImporter.dashboard, name: t('breadcrumbs.caseImporter', 'Case Importer') },
          { name: t('breadcrumbs.settings', 'Settings') },
        ]}
      />
      <PluginSettingsView />
    </>
  );
}
