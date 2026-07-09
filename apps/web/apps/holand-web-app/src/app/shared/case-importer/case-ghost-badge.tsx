'use client';

import { Tooltip } from '@/components/tooltip';
import { Badge } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { PiGhostDuotone } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { isListOnlyCase } from '@/app/shared/cases/case-import-ui-mappers';
import type { CaseListItem } from '@/types/case-importer.types';

export default function CaseGhostBadge({
  item,
  className,
  size = 'sm',
}: {
  item: Pick<CaseListItem, 'case_id' | 'detail_available'>;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();

  if (!isListOnlyCase(item)) return null;

  return (
    <Tooltip content={t('caseImporter.list.ghostTooltip')}>
      <Badge
        variant="flat"
        color="warning"
        size={size}
        className={cn('gap-1', className)}
      >
        <PiGhostDuotone className="h-3.5 w-3.5" />
        {t('caseImporter.list.ghostBadge')}
      </Badge>
    </Tooltip>
  );
}
