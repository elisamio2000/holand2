import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

export default function LegacyAccountSettingsRedirectPage() {
  redirect(routes.account.profile);
}
