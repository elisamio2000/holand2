/**
 * User-facing messages for gateway API errors (axios).
 */
import { isAxiosError, type AxiosError } from 'axios';
import i18n from 'i18next';

type GatewayErrorBody = {
  detail?: unknown;
  message?: unknown;
  error?: unknown;
};

/**
 * Extract a short detail string from a gateway error payload.
 */
export function extractGatewayErrorDetail(error: unknown): string | undefined {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error.message : undefined;
  }
  const data = error.response?.data as GatewayErrorBody | undefined;
  const raw = data?.detail ?? data?.message ?? data?.error;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  if (raw != null) {
    return JSON.stringify(raw);
  }
  return undefined;
}

/**
 * Localized message for HTTP 403 — suitable for toast or inline banners.
 */
export function getForbiddenMessage(error?: AxiosError): string {
  const detail = extractGatewayErrorDetail(error);
  const base = i18n.t('common.apiAccessDenied');
  if (detail) {
    return `${base} (${detail})`;
  }
  return base;
}

/**
 * Whether the caller asked to skip global access-denied toasts for this request.
 */
export function shouldSkipAccessDeniedToast(
  headers?: Record<string, unknown> | undefined
): boolean {
  if (!headers) {
    return false;
  }
  const flag = headers['X-Skip-Access-Denied-Toast'];
  return flag === '1' || flag === 'true' || flag === true;
}
