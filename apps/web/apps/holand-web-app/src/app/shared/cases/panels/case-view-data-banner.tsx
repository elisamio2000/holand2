'use client';

import { Text } from 'rizzui';
import { PiWarningCircleBold, PiInfoBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';

export type CaseViewDataBannerVariant = 'mock' | 'derived' | 'offline';

export default function CaseViewDataBanner({
  variant = 'mock',
}: {
  variant?: CaseViewDataBannerVariant;
}) {
  const { t } = useTranslation();
  const key =
    variant === 'derived'
      ? 'cases.view.derivedDataBanner'
      : variant === 'offline'
        ? 'cases.view.offlineDataBanner'
        : 'cases.view.mockDataBanner';

  const isInfo = variant === 'derived';

  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2 rounded-lg border p-3',
        isInfo
          ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
      )}
    >
      {isInfo ? (
        <PiInfoBold className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      ) : (
        <PiWarningCircleBold className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      )}
      <Text
        className={cn(
          'text-sm',
          isInfo
            ? 'text-blue-900 dark:text-blue-100'
            : 'text-amber-900 dark:text-amber-100'
        )}
      >
        {t(key)}
      </Text>
    </div>
  );
}
