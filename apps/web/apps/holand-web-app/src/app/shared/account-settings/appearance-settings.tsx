'use client';

import { useTranslation } from 'react-i18next';
import { Title, Text } from 'rizzui';
import { useSession } from 'next-auth/react';
import { ProfileHeader } from '@/app/shared/account-settings/profile-settings';
import ThemeSwitcher from '@/layouts/settings/theme-switcher';
import AppDirection from '@/layouts/settings/app-direction';
import LayoutSwitcher from '@/layouts/layout-switcher';
import ColorOptions from '@/layouts/settings/color-options';

export default function AccountAppearanceSettingsView() {
  const { t } = useTranslation();
  const { data: session } = useSession();

  return (
    <>
      <ProfileHeader
        title={session?.user?.displayName || session?.user?.name || t('account.profileSettings.user')}
        description={t('adminSettings.tabAppearanceDesc')}
        avatarSrc={session?.user?.avatarUrl ?? session?.user?.image ?? undefined}
      />

      <div className="mx-auto mb-10 w-full max-w-screen-2xl space-y-5">
        <div className="rounded-xl border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <Title as="h4" className="mb-1 text-base font-semibold">
            {t('adminSettings.appearanceTitle')}
          </Title>
          <Text className="text-sm text-gray-500">{t('adminSettings.appearanceDesc')}</Text>
        </div>
        <div className="space-y-4 rounded-xl border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <ThemeSwitcher />
          <AppDirection />
          <LayoutSwitcher />
          <ColorOptions />
        </div>
      </div>
    </>
  );
}
