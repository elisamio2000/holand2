import PasswordSettingsView from '@/app/shared/account-settings/password-settings';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Account Security'),
};

/**
 * Account security page.
 */
export default function AccountSecurityPage() {
  return <PasswordSettingsView />;
}
