// ============================================
// Case Import Page Content — localized page header + import form
// ============================================

'use client';

import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import ImportForm from '@/app/shared/case-importer/import-form';

type SourceMode = 'upload' | 'path' | 'batch';

interface ImportPageContentProps {
  initialSourceMode: SourceMode;
}

/**
 * ImportPageContent — Client-side localized wrapper for import page header.
 */
export default function ImportPageContent({ initialSourceMode }: ImportPageContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={t('caseImporter.import.pageTitle', 'New Import')}
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: t('breadcrumbs.home', 'Home') },
          { href: routes.caseImporter.dashboard, name: t('breadcrumbs.caseImporter', 'Case Importer') },
          { name: t('breadcrumbs.import', 'Import') },
        ]}
      />
      <ImportForm className="mt-2" initialSourceMode={initialSourceMode} />
    </>
  );
}
