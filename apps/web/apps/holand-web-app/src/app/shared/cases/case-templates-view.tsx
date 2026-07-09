// ============================================
// CaseTemplatesView — Case templates management page
// Manage templates for quick case creation
// ============================================
'use client';

import { Title, Text } from 'rizzui';
import { PiClipboardTextDuotone } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import BackendNotAvailable from '@/app/shared/backend-not-available';

/**
 * CaseTemplatesView — Case templates management.
 *
 * Provides CRUD operations for case templates that allow
 * quick case creation with pre-filled fields.
 * Requires backend template management endpoints.
 *
 * @version 0.20.0
 */
export default function CaseTemplatesView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
          <PiClipboardTextDuotone className="h-8 w-8 text-primary" />
        </div>
        <div>
          <Title as="h4" className="text-lg font-semibold">
            {t('cases.templates.title')}
          </Title>
          <Text className="text-sm text-gray-500">
            {t('cases.templates.description')}
          </Text>
        </div>
      </div>

      <BackendNotAvailable
        title="Case Templates API"
        description="The backend endpoints for case templates management have not been implemented yet."
        version="0.20.0"
        endpoints={[
          { method: 'GET', path: '/cases/templates', description: 'List templates' },
          { method: 'POST', path: '/cases/templates', description: 'Create template' },
          { method: 'PUT', path: '/cases/templates/{id}', description: 'Update template' },
          { method: 'DELETE', path: '/cases/templates/{id}', description: 'Delete template' },
        ]}
      />
    </div>
  );
}
