import { permanentRedirect } from 'next/navigation';

/** Legacy URL `/auth/sign-in-4` → canonical `/auth/sign-in`. */
export default function LegacySignIn4Redirect() {
  permanentRedirect('/auth/sign-in');
}
