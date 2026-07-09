import { routes } from '@/config/routes';
import TranslatedPageHeader from '@/app/shared/translated-page-header';
import ProfileSettingsNav from '@/app/shared/account-settings/navigation';
import ProfileDevRequirementsPanel from '@/app/shared/account-settings/components/profile-dev-requirements-panel';
import ProfileSettingsScrollFlush from '@/app/shared/account-settings/profile-settings-scroll-flush';

/**
 * AccountLayout — Canonical account pages wrapper.
 *
 * Keeps account navigation and dev requirements panel in a unified layout
 * for /account/profile, /account/security, /account/activity.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileSettingsScrollFlush>
      <div className="pt-2 3xl:pt-4">
        <TranslatedPageHeader
          titleKey="pages.accountSettings"
          breadcrumb={[
            { nameKey: 'pages.dashboard', href: '/' },
            { nameKey: 'pages.form', href: routes.account.profile },
            { nameKey: 'pages.accountSettings' },
          ]}
          className="mb-4 xs:mt-0 lg:mb-5"
        />
        <ProfileSettingsNav />
        {children}
        <ProfileDevRequirementsPanel />
      </div>
    </ProfileSettingsScrollFlush>
  );
}
