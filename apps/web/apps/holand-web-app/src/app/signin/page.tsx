// ============================================
// /signin Redirect — Legacy route redirect
// Redirects to the primary sign-in page (/auth/sign-in)
// ============================================

import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Sign In'),
};

/**
 * Legacy /signin route — redirects to /auth/sign-in.
 *
 * Kept for backward compatibility (old bookmarks, NextAuth fallback).
 */
export default function SignIn() {
  redirect(routes.auth.signIn);
}
