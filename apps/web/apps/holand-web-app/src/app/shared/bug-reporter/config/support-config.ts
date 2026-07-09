import { getEnvConfig } from './bug-report-config';

/** Keycloak support user — support / support@yahoo.com */
export const SUPPORT_USER_ID =
  process.env.NEXT_PUBLIC_SUPPORT_USER_ID || '9e50d244-ca8f-49ef-8dc0-ed21cd3487ed';

export const SUPPORT_USER_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_USER_EMAIL?.trim() || 'support@yahoo.com';

/** Default bug report recipient (overridable via admin settings at runtime) */
export const BUG_REPORT_RECIPIENT = getEnvConfig().recipientId;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Username slugs that must map to the configured support UUID for messenger send. */
const SUPPORT_SLUGS = new Set(['support', 'user-support']);

/**
 * Map compose/search tokens to messenger recipient UUID.
 * Backend send rejects username slugs (storage_400) — UUID required.
 */
export function resolveMessengerRecipientId(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return trimmed;
  if (UUID_RE.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (
    SUPPORT_SLUGS.has(lower) ||
    lower === SUPPORT_USER_EMAIL.toLowerCase() ||
    lower === SUPPORT_USER_ID.toLowerCase()
  ) {
    return SUPPORT_USER_ID;
  }

  return trimmed;
}

export function isMessengerUserUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
