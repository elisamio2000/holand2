'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';

import { PiCirclesThreeBold, PiEyeSlashBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

const edgeBtn =
  'absolute z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-muted bg-gray-0/90 text-gray-500 shadow-md backdrop-blur-sm transition-colors hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-50/90 dark:hover:bg-gray-200 dark:hover:text-gray-700';

export interface BoardGraphSideTogglesProps {
  showLegend: boolean;
  onToggleLegend: () => void;
}

export function BoardGraphSideToggles({ showLegend, onToggleLegend }: BoardGraphSideTogglesProps) {
  const { t } = useTranslation();

  return (
    <Tooltip
      content={
        showLegend
          ? t('boards.graph.hideLegend', 'Hide legend')
          : t('boards.graph.showLegend', 'Show legend')
      }
      placement="top"
    >
      <button
        type="button"
        className={cn(edgeBtn, 'bottom-4 left-4')}
        onClick={onToggleLegend}
        aria-label={t('boards.graph.legend', 'Legend')}
      >
        {showLegend ? <PiEyeSlashBold className="h-4 w-4" /> : <PiCirclesThreeBold className="h-4 w-4" />}
      </button>
    </Tooltip>
  );
}
