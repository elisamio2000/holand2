import { z } from 'zod';

const EMAIL_LOCAL_PART = /^[A-Za-z0-9._%+-]+$/;
const EMAIL_DOMAIN_PART = /^[A-Za-z0-9.-]+$/;

/**
 * Parse comma-separated internal email domains from env (lowercase).
 *
 * @param raw - Env value such as `example.com,corp.internal`
 */
export function parseAllowedInternalEmailDomains(
  raw?: string | null
): readonly string[] {
  return Object.freeze(
    (raw ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Allowed org-internal domains for client-side validation.
 * Must stay in sync with backend `ALLOWED_INTERNAL_EMAIL_DOMAINS`.
 */
export function getAllowedInternalEmailDomains(): readonly string[] {
  return parseAllowedInternalEmailDomains(
    process.env.NEXT_PUBLIC_ALLOWED_INTERNAL_EMAIL_DOMAINS
  );
}

/**
 * Default email placeholder for user forms (first configured domain or generic).
 */
export function getDefaultEmailPlaceholder(): string {
  const domains = getAllowedInternalEmailDomains();
  if (domains.length > 0) {
    return `user@${domains[0]}`;
  }
  return 'user@company.com';
}

/**
 * Validate email against platform rules: configured internal domains OR RFC (Zod email).
 */
export function isValidPlatformEmail(
  email: string,
  allowedDomains: readonly string[] = getAllowedInternalEmailDomains()
): boolean {
  const trimmed = email.trim();
  if (!trimmed.includes('@')) {
    return false;
  }
  const at = trimmed.lastIndexOf('@');
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!local || !domain || !EMAIL_DOMAIN_PART.test(domain)) {
    return false;
  }
  if (allowedDomains.includes(domain)) {
    return EMAIL_LOCAL_PART.test(local);
  }
  return z.string().email().safeParse(trimmed).success;
}
