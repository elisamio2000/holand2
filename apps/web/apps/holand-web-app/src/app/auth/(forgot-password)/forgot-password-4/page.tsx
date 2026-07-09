import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

/** @deprecated Use `/auth/forgot-password` — kept for backward-compatible bookmarks. */
export default function ForgotPassword4RedirectPage() {
  redirect(routes.auth.forgotPassword);
}
