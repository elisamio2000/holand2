'use client';

import { Badge } from 'rizzui';
import { useTranslation } from 'react-i18next';

export default function ProjectsPreviewBadge() {
  const { t } = useTranslation();
  return (
    <Badge
      variant="flat"
      className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    >
      {t('projects.mock.previewBadge')}
    </Badge>
  );
}
