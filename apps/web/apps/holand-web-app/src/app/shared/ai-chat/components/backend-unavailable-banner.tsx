'use client';

import { useTranslation } from 'react-i18next';
import { PiWarningCircle } from 'react-icons/pi';

const showDevLinkDefault =
  process.env.NEXT_PUBLIC_AI_CHAT_DEV_PANEL === 'true' ||
  process.env.NODE_ENV === 'development';

interface BackendUnavailableBannerProps {
  message: string;
  showDevLink?: boolean;
  onOpenDevPanel?: () => void;
}

export default function BackendUnavailableBanner({
  message,
  showDevLink,
  onOpenDevPanel,
}: BackendUnavailableBannerProps) {
  const { t } = useTranslation();
  const canShowDevLink =
    (showDevLink ?? showDevLinkDefault) && typeof onOpenDevPanel === 'function';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-600 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
      <div className="flex items-center gap-2">
        <PiWarningCircle className="h-4 w-4 flex-shrink-0" />
        <span>{message}</span>
      </div>
      {canShowDevLink && (
        <button
          type="button"
          onClick={onOpenDevPanel}
          className="self-start text-[11px] font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('chatPage.backendBanner.openDevChecklist')}
        </button>
      )}
    </div>
  );
}
