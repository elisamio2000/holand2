// ============================================
// Bug Report — map gateway/messenger errors for UI
// ============================================

import { AxiosError } from 'axios';

export function formatMessengerApiError(error: unknown, context = 'Messenger'): Error {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as
      | { detail?: string; message?: string; error?: string }
      | undefined;
    const detail = [data?.detail, data?.message, data?.error]
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
      .trim();

    if (status === 401) {
      return new Error(`${context}: authentication expired — please retry or sign in again`);
    }
    if (status === 403) {
      return new Error(`${context}: access denied`);
    }
    if (status === 404) {
      return new Error(
        `${context}: plugin or route not found (404) — restart tool-runner and rebuild storage/api-gateway after mail/user-chat split`
      );
    }
    if (status === 429) {
      return new Error(`${context}: too many requests — try again shortly`);
    }
    if (detail.toLowerCase().includes('recipient_not_found')) {
      return new Error(
        `${context}: recipient not found — user may exist in Keycloak but not in messaging directory yet`
      );
    }
    if (detail.toLowerCase().includes('storage_400') || detail.toLowerCase() === 'storage_400') {
      return new Error(
        `${context}: invalid recipient — server requires user UUID, not username (e.g. use support user's Keycloak id)`
      );
    }
    if (detail.toLowerCase().includes('storage')) {
      return new Error(`${context}: storage unavailable on server`);
    }
    if (detail) {
      return new Error(`${context}: ${detail}`);
    }
  }

  if (error instanceof Error) return error;
  return new Error(`${context}: request failed`);
}
