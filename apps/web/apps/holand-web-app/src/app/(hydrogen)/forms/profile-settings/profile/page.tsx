import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

export default function LegacyProfileSettingsRedirectPage() {
  redirect(routes.account.profile);
}
