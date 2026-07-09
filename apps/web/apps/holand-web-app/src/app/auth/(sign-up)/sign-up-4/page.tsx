import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

/** @deprecated Use `/auth/sign-up` — kept for backward-compatible bookmarks. */
export default function SignUp4RedirectPage() {
  redirect(routes.auth.signUp);
}
