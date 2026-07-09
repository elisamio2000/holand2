import ProfileSettingsView from '@/app/shared/account-settings/profile-settings';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Account Profile'),
};

/**
 * Account profile page.
 */
export default function AccountProfilePage() {
  return <ProfileSettingsView />;
}
