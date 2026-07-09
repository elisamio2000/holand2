// ============================================
// Embeds the standalone geo/map Next app (separate port / host).
// Configure NEXT_PUBLIC_STANDALONE_MAP_APP_ORIGIN (e.g. http://192.168.1.62:3010).
// ============================================
'use client';

import { Text, Title } from 'rizzui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Path on the standalone app, e.g. /geo-location or /offline-map */
  path: '/geo-location' | '/offline-map';
};

export default function StandaloneMapAppEmbed({ path }: Props) {
  const { t } = useTranslation();

  const src = useMemo(() => {
    const raw =
      process.env.NEXT_PUBLIC_STANDALONE_MAP_APP_ORIGIN?.trim().replace(/\/$/, '') || '';
    if (!raw) return '';
    return `${raw}${path}`;
  }, [path]);

  if (!src) {
    return (
      <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
        <Title as="h6" className="mb-2 text-amber-900 dark:text-amber-200">
          {t('plugins.standaloneEmbed.missingEnvTitle')}
        </Title>
        <Text className="text-sm text-amber-800 dark:text-amber-300">
          {t('plugins.standaloneEmbed.missingEnvBody')}
        </Text>
      </div>
    );
  }

  return (
    <div className="flex min-h-[min(85vh,900px)] flex-col rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
      <iframe
        title={path}
        src={src}
        className="mt-0 min-h-[min(85vh,900px)] w-full flex-1 rounded-b-lg border-0"
        // Sandbox relaxed so the embedded SPA can use storage / same-origin within 3010
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
