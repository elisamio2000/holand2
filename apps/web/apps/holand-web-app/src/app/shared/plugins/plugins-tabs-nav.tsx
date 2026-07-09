// ============================================
// PluginsTabsNav — Shared tab navigation between Internal/External plugins
//
// Used by both /plugins/internal-plugin and /plugins/external-plugins so the
// URL always reflects the active source (bookmarking & deep links).
// ============================================
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PiCloudBold, PiDesktopTowerBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

export default function PluginsTabsNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const isExternal =
    pathname.includes('/external-plugins') || pathname.includes('/plugins/external');
  const activeTab: 'internal' | 'external' = isExternal ? 'external' : 'internal';

  return (
    <div className="border-b border-muted">
      <nav className="-mb-px flex space-x-8">
        <Link
          href="/plugins/internal-plugin"
          className={cn(
            'group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors',
            activeTab === 'internal'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          )}
        >
          <PiCloudBold
            className={cn(
              'me-2 h-5 w-5',
              activeTab === 'internal' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
            )}
          />
          {t('plugins.tabs.internal')}
        </Link>

        <Link
          href="/plugins/external-plugins"
          className={cn(
            'group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors',
            activeTab === 'external'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          )}
        >
          <PiDesktopTowerBold
            className={cn(
              'me-2 h-5 w-5',
              activeTab === 'external' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500'
            )}
          />
          {t('plugins.tabs.external')}
        </Link>
      </nav>
    </div>
  );
}
