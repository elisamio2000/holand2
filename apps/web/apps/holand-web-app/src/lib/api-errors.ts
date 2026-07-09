// ============================================
// API error taxonomy — unified classification for Gateway/axios errors
// ============================================

import { isAxiosError } from 'axios';
import { isGatewayToolError } from '@/utils/gateway-tool-success';

export type ApiErrorCategory =
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'network'
  | 'unknown';

export interface ClassifiedApiError {
  category: ApiErrorCategory;
  status?: number;
  message: string;
  detail?: string;
  retryable: boolean;
  original: unknown;
}

function pickMessageFromBody(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;
  const candidates = [o.detail, o.message, o.error, o.msg];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (Array.isArray(c) && c.length > 0) {
      const first = c[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && 'msg' in first) {
        return String((first as { msg: unknown }).msg);
      }
    }
  }
  return undefined;
}

/** Classify any thrown value into a stable category for UI and retry logic. */
export function classifyApiError(err: unknown): ClassifiedApiError {
  if (isGatewayToolError(err)) {
    const status = err.statusCode;
    const message = err.message;
    if (status === 401) {
      return {
        category: 'unauthorized',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status === 403) {
      return {
        category: 'forbidden',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status === 404) {
      return {
        category: 'not_found',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status === 429) {
      return {
        category: 'rate_limited',
        status,
        message,
        retryable: true,
        original: err,
      };
    }
    if (status >= 500) {
      return {
        category: 'server',
        status,
        message,
        retryable: true,
        original: err,
      };
    }
    return {
      category: 'unknown',
      status,
      message,
      retryable: false,
      original: err,
    };
  }

  if (isAxiosError(err)) {
    const status = err.response?.status;
    const bodyMsg = pickMessageFromBody(err.response?.data);
    const message =
      bodyMsg ||
      err.message ||
      (status ? `Request failed (${status})` : 'Request failed');

    if (status === 401) {
      return {
        category: 'unauthorized',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status === 403) {
      return {
        category: 'forbidden',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status === 404) {
      return {
        category: 'not_found',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status === 429) {
      return {
        category: 'rate_limited',
        status,
        message,
        retryable: true,
        original: err,
      };
    }
    if (status === 422 || status === 400) {
      return {
        category: 'validation',
        status,
        message,
        retryable: false,
        original: err,
      };
    }
    if (status != null && status >= 500) {
      return {
        category: 'server',
        status,
        message,
        retryable: true,
        original: err,
      };
    }
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return {
        category: 'network',
        message: message || 'Network error',
        retryable: true,
        original: err,
      };
    }
    return {
      category: 'unknown',
      status,
      message,
      retryable: false,
      original: err,
    };
  }

  if (err instanceof Error) {
    return {
      category: 'unknown',
      message: err.message,
      retryable: false,
      original: err,
    };
  }

  return {
    category: 'unknown',
    message: typeof err === 'string' ? err : 'An unexpected error occurred',
    retryable: false,
    original: err,
  };
}

/** Human-readable message; optional i18n key via category. */
export function getApiErrorMessage(
  err: unknown,
  fallback = 'An error occurred'
): string {
  return classifyApiError(err).message || fallback;
}

/** i18n key under `errors.api.*` for classified errors */
export function getApiErrorI18nKey(category: ApiErrorCategory): string {
  return `errors.api.${category}`;
}

/** @deprecated Prefer classifyApiError — kept for gradual migration */
export function extractErrorMessage(err: unknown): string {
  return getApiErrorMessage(err);
}
