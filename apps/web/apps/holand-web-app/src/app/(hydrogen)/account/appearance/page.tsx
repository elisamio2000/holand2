import AccountAppearanceSettingsView from '@/app/shared/account-settings/appearance-settings';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Account Appearance'),
};

export default function AccountAppearancePage() {
  return <AccountAppearanceSettingsView />;
}
