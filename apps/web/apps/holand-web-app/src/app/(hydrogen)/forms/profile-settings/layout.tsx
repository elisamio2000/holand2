import { routes } from '@/config/routes';
import TranslatedPageHeader from '@/app/shared/translated-page-header';
import ProfileSettingsNav from '@/app/shared/account-settings/navigation';
import ProfileDevRequirementsPanel from '@/app/shared/account-settings/components/profile-dev-requirements-panel';
import ProfileSettingsScrollFlush from '@/app/shared/account-settings/profile-settings-scroll-flush';

export default function ProfileSettingsLayout({
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
            { nameKey: 'pages.form', href: routes.forms.profileSettings },
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
