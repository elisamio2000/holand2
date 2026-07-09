import UserActivityLogView from '@/app/shared/account-settings/user-activity-log-view';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Account Activity'),
};

/**
 * Account activity page.
 */
export default function AccountActivityPage() {
  return <UserActivityLogView />;
}
