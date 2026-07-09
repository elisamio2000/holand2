'use client';

import { Text } from 'rizzui';
import { PiWarningCircleBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

export default function MessagesMockBanner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <PiWarningCircleBold className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <Text className="text-sm text-amber-900 dark:text-amber-100">
        {t('messages.mockDataBanner')}
      </Text>
    </div>
  );
}
