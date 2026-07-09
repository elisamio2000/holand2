// ============================================
// Sanitize API error messages before showing to users.
// Backend proxy errors may leak internal Docker hostnames (auth-service:8003).
// ============================================

type AxiosLikeError = {
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

const INTERNAL_HOST_PATTERN =
  /https?:\/\/[a-z0-9._-]+(?::\d+)?(?:\/[^\s'"]*)?/gi;

function stringifyDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (typeof e === 'string') return e;
        if (e && typeof e === 'object') {
          const row = e as { msg?: string; message?: string };
          return row.msg || row.message || JSON.stringify(e);
        }
        return String(e);
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    const obj = detail as { message?: string; msg?: string };
    return obj.message || obj.msg || JSON.stringify(detail);
  }
  return null;
}

/** Strip internal upstream URLs from backend error text. */
export function sanitizeErrorText(text: string): string {
  const cleaned = text
    .replace(INTERNAL_HOST_PATTERN, '[internal-service]')
    .replace(/Client error '[^']+' for url '\[internal-service\]'/gi, 'Upstream service error')
    .replace(/Server error '[^']+' for url '\[internal-service\]'/gi, 'Upstream service error')
    .replace(
      /For more information check: https:\/\/developer\.mozilla\.org[^\s]*/gi,
      ''
    )
    .trim();

  if (/^Upstream service error$/i.test(cleaned)) {
    return 'سرویس پشتیبان در دسترس نیست یا پاسخ خطا داد. تنظیمات Gateway را در check-and-run.ps1 بررسی کنید.';
  }

  return cleaned || 'خطای ناشناخته از سرویس';
}

/**
 * Extract a user-safe message from an axios/fetch error.
 * Never surfaces raw internal Docker hostnames or third-party doc links.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback = 'عملیات با خطا مواجه شد'
): string {
  const axiosErr = err as AxiosLikeError;
  const raw =
    stringifyDetail(axiosErr?.response?.data?.detail) ??
    axiosErr?.response?.data?.message ??
    axiosErr?.response?.data?.error ??
    axiosErr?.message ??
    fallback;

  return sanitizeErrorText(raw);
}
