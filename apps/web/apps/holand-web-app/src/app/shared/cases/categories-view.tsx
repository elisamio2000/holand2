// ============================================
// CategoriesView — Case categories management page
// Manage categories and labels for cases
// ============================================
'use client';

import { Title, Text } from 'rizzui';
import { PiTagDuotone } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import BackendNotAvailable from '@/app/shared/backend-not-available';

/**
 * CategoriesView — Case categories management.
 *
 * Provides CRUD operations for case categories and labels.
 * Categories are used for organizing and filtering cases.
 * Requires backend category management endpoints.
 *
 * @version 0.20.0
 */
export default function CategoriesView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
          <PiTagDuotone className="h-8 w-8 text-primary" />
        </div>
        <div>
          <Title as="h4" className="text-lg font-semibold">
            {t('cases.categories.title')}
          </Title>
          <Text className="text-sm text-gray-500">
            {t('cases.categories.description')}
          </Text>
        </div>
      </div>

      <BackendNotAvailable
        title="Case Categories API"
        description="The backend endpoints for case categories management have not been implemented yet."
        version="0.20.0"
        endpoints={[
          { method: 'GET', path: '/cases/categories', description: 'List categories' },
          { method: 'POST', path: '/cases/categories', description: 'Create category' },
          { method: 'PUT', path: '/cases/categories/{id}', description: 'Update category' },
          { method: 'DELETE', path: '/cases/categories/{id}', description: 'Delete category' },
        ]}
      />
    </div>
  );
}
