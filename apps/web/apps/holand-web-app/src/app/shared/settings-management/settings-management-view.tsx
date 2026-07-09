'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PiUserPlusBold,
  PiGearBold,
  PiRobotBold,
  PiPaletteBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { Text } from 'rizzui';
import { Tooltip } from '@/components/tooltip';
import SettingsManagement from '@/app/shared/settings-management/settings-management';
import RegistrationSettingsSection from '@/app/shared/settings-management/registration-settings-section';
import AppearanceSettingsSection from '@/app/shared/settings-management/appearance-settings-section';
import { usePermissions } from '@/hooks/use-permissions';

import { routes } from '@/config/routes';

export type SettingsTabKey = 'registration' | 'system' | 'llm' | 'appearance';

const BASE_PATH = routes.adminPanel.settings;

interface TabDef {
  key: SettingsTabKey;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    key: 'registration',
    labelKey: 'adminSettings.tabRegistration',
    descKey: 'adminSettings.tabRegistrationDesc',
    icon: <PiUserPlusBold className="h-[18px] w-[18px]" />,
  },
  {
    key: 'system',
    labelKey: 'adminSettings.tabSystem',
    descKey: 'adminSettings.tabSystemDesc',
    icon: <PiGearBold className="h-[18px] w-[18px]" />,
  },
  {
    key: 'llm',
    labelKey: 'adminSettings.tabLlm',
    descKey: 'adminSettings.tabLlmDesc',
    icon: <PiRobotBold className="h-[18px] w-[18px]" />,
  },
  {
    key: 'appearance',
    labelKey: 'adminSettings.tabAppearance',
    descKey: 'adminSettings.tabAppearanceDesc',
    icon: <PiPaletteBold className="h-[18px] w-[18px]" />,
  },
];

/** Read permissions per admin settings tab (granular or legacy admin:settings:*). */
const TAB_READ_PERMISSIONS: Record<SettingsTabKey, string[]> = {
  registration: ['admin:registration:read', 'admin:settings:read'],
  system: ['admin:system:read', 'admin:settings:read'],
  llm: ['admin:llm:read', 'admin:settings:read'],
  appearance: ['admin:appearance:read', 'admin:settings:read'],
};

interface SettingsManagementViewProps {
  initialTab?: SettingsTabKey;
}

/**
 * URL-synced admin settings tabs.
 */
export default function SettingsManagementView({
  initialTab = 'registration',
}: SettingsManagementViewProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { hasAnyPermission, isSuperAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);

  const canAccessTab = useCallback(
    (tab: SettingsTabKey): boolean => {
      if (isSuperAdmin) return true;
      return hasAnyPermission(...TAB_READ_PERMISSIONS[tab]);
    },
    [hasAnyPermission, isSuperAdmin]
  );

  const handleTabChange = useCallback(
    (tab: SettingsTabKey) => {
      if (!canAccessTab(tab)) {
        console.warn('[SettingsManagementView] Tab access denied:', { tab });
        return;
      }
      console.info('[SettingsManagementView] Tab changed:', { from: activeTab, to: tab });
      setActiveTab(tab);
      router.replace(`${BASE_PATH}/${tab}`, { scroll: false });
    },
    [router, activeTab, canAccessTab]
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto rounded-xl border border-muted bg-gray-0 p-1.5 dark:bg-gray-50">
        {TABS.map((tab) => {
          const allowed = canAccessTab(tab.key);
          const button = (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              disabled={!allowed}
              className={cn(
                'group flex min-w-[140px] flex-1 items-center gap-3 rounded-lg px-4 py-3 text-start transition-all',
                activeTab === tab.key
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
                    activeTab === tab.key ? 'text-primary-foreground/80' : 'text-gray-500'
                  )}
                >
                  {t(tab.descKey)}
                </Text>
              </div>
            </button>
          );
          if (allowed) return button;
          return (
            <Tooltip key={tab.key} content={t('adminSettings.tabAccessDenied')} placement="top">
              <span className="flex flex-1">{button}</span>
            </Tooltip>
          );
        })}
      </div>

      {activeTab === 'registration' && canAccessTab('registration') && (
        <RegistrationSettingsSection />
      )}
      {activeTab === 'system' && canAccessTab('system') && (
        <SettingsManagement section="system" />
      )}
      {activeTab === 'llm' && canAccessTab('llm') && (
        <SettingsManagement section="llm" />
      )}
      {activeTab === 'appearance' && canAccessTab('appearance') && (
        <AppearanceSettingsSection />
      )}
      {!canAccessTab(activeTab) && (
        <div className="rounded-lg border border-dashed border-muted p-6 text-center">
          <Text className="text-sm text-gray-500">{t('adminSettings.tabAccessDenied')}</Text>
        </div>
      )}
    </div>
  );
}
