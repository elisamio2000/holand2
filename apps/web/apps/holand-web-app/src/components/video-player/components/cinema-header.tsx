'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import { PiArrowLeftBold, PiInfoBold } from 'react-icons/pi';
import { vpTokens } from '../helpers/variant-visual-tokens';

interface CinemaHeaderProps {
  title?: string;
  mimeType?: string;
  fileSize?: string;
  resolution?: string;
  onBack?: () => void;
  className?: string;
}

export function CinemaHeader({
  title,
  mimeType,
  fileSize,
  resolution,
  onBack,
  className,
}: CinemaHeaderProps) {
  const { t } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className={cn(vpTokens.cinemaHeader, className)}>
      {onBack ? (
        <Tooltip content={t('common.back', 'Back')} placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={onBack}
            className="text-white/90 hover:text-white"
            aria-label={t('common.back', 'Back')}
          >
            <PiArrowLeftBold className="h-5 w-5 rtl:rotate-180" />
          </ActionIcon>
        </Tooltip>
      ) : (
        <span />
      )}

      <div className="relative">
        <Tooltip content={t('videoPlayer.info', 'Info')} placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={() => setInfoOpen((o) => !o)}
            className="text-white/90 hover:text-white"
            aria-label={t('videoPlayer.info', 'Info')}
            aria-expanded={infoOpen}
          >
            <PiInfoBold className="h-5 w-5" />
          </ActionIcon>
        </Tooltip>
        {infoOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setInfoOpen(false)} />
            <div className="absolute end-0 top-full z-50 mt-2 min-w-[200px] rounded-lg border border-muted bg-gray-0 p-3 shadow-lg dark:bg-gray-50">
              {title && (
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
              )}
              <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                {mimeType && <p>{mimeType}</p>}
                {resolution && <p>{resolution}</p>}
                {fileSize && <p>{fileSize}</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
