'use client';



import { useCallback } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import { PiChartBarBold, PiGearBold } from 'react-icons/pi';

import cn from '@core/utils/class-names';

import { Text } from 'rizzui';
import { Tooltip } from '@/components/tooltip';

import { routes } from '@/config/routes';

import { usePermissions } from '@/hooks/use-permissions';



export type AdminPanelSection = 'statistics' | 'settings';



interface TabDef {

  key: AdminPanelSection;

  labelKey: string;

  descKey: string;

  href: string;

  icon: React.ReactNode;

  readPermissions: string[];

}



const MAIN_TABS: TabDef[] = [

  {

    key: 'statistics',

    labelKey: 'adminDashboard.statisticsTab',

    descKey: 'adminDashboard.statisticsDesc',

    href: routes.adminPanel.statistics,

    icon: <PiChartBarBold className="h-[18px] w-[18px]" />,

    readPermissions: ['admin:system:read', 'admin:settings:read', 'admin:events:read'],

  },

  {

    key: 'settings',

    labelKey: 'adminDashboard.settingsTab',

    descKey: 'adminDashboard.settingsDesc',

    href: routes.adminPanel.settingsTab('registration'),

    icon: <PiGearBold className="h-[18px] w-[18px]" />,

    readPermissions: [

      'admin:registration:read',

      'admin:system:read',

      'admin:llm:read',

      'admin:appearance:read',

      'admin:settings:read',

    ],

  },

];



/**

 * Top-level Admin Panel tabs: Statistics | Settings (URL-synced, permission-gated).

 */

export default function AdminPanelShell({ children }: { children: React.ReactNode }) {

  const pathname = usePathname();

  const router = useRouter();

  const { t } = useTranslation();

  const { hasAnyPermission, isSuperAdmin } = usePermissions();



  const activeSection: AdminPanelSection = pathname.includes('/admin-panel/settings')

    ? 'settings'

    : 'statistics';



  const canAccessTab = useCallback(

    (tab: TabDef): boolean => {

      if (isSuperAdmin) return true;

      return hasAnyPermission(...tab.readPermissions);

    },

    [hasAnyPermission, isSuperAdmin]

  );



  const handleTabChange = useCallback(

    (tab: TabDef) => {

      if (!canAccessTab(tab)) {

        console.warn('[AdminPanelShell] Tab access denied:', { tab: tab.key });

        return;

      }

      if (tab.key === activeSection) return;

      console.info('[AdminPanelShell] Section changed:', { to: tab.key });

      router.replace(tab.href, { scroll: false });

    },

    [router, activeSection, canAccessTab]

  );



  return (

    <div className="space-y-6">

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-muted bg-gray-0 p-1.5 dark:bg-gray-50">

        {MAIN_TABS.map((tab) => {

          const allowed = canAccessTab(tab);

          const button = (

            <button

              key={tab.key}

              type="button"

              onClick={() => handleTabChange(tab)}

              disabled={!allowed}

              className={cn(

                'group flex min-w-[160px] flex-1 items-center gap-3 rounded-lg px-4 py-3 text-start transition-all',

                activeSection === tab.key

                  ? 'bg-primary text-primary-foreground shadow-md'

                  : 'hover:bg-gray-100 dark:hover:bg-gray-100/10',

                !allowed && 'cursor-not-allowed opacity-50'

              )}

            >

              {tab.icon}

              <div>

                <Text className="text-sm font-semibold">{t(tab.labelKey)}</Text>

                <Text

                  className={cn(

                    'text-xs',

                    activeSection === tab.key

                      ? 'text-primary-foreground/80'

                      : 'text-gray-500'

                  )}

                >

                  {t(tab.descKey)}

                </Text>

              </div>

            </button>

          );

          if (!allowed) {

            return (

              <Tooltip key={tab.key} content={t('adminSettings.tabAccessDenied')} placement="top">

                <span className="flex flex-1">{button}</span>

              </Tooltip>

            );

          }

          return button;

        })}

      </div>

      <div className="@container">{children}</div>

    </div>

  );

}

