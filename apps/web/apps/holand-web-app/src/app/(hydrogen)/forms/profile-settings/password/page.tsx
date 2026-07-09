import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

export default function LegacyPasswordSettingsRedirectPage() {
  redirect(routes.account.security);
}
