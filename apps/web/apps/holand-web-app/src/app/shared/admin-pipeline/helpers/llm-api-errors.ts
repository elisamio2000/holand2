// ============================================
// LLM API error parsing — maps gateway errors to i18n keys
// ============================================

export type LlmApiErrorKey =
  | 'discovery_blocked_host'
  | 'endpoint_not_found'
  | 'no_models_to_import'
  | 'binding_failed'
  | 'unknown_model'
  | 'forbidden'
  | 'generic';

export interface ParsedLlmApiError {
  key: LlmApiErrorKey;
  detail: string;
  status?: number;
}

function extractDetail(err: unknown): { detail: string; status?: number } {
  if (err && typeof err === 'object') {
    const ax = err as {
      response?: { status?: number; data?: { detail?: unknown; error?: unknown; message?: unknown } };
      message?: string;
    };
    const status = ax.response?.status;
    const data = ax.response?.data;
    if (data) {
      const raw = data.detail ?? data.error ?? data.message;
      if (typeof raw === 'string') return { detail: raw, status };
      if (Array.isArray(raw)) return { detail: raw.map(String).join('; '), status };
    }
    if (ax.message) return { detail: ax.message, status };
  }
  if (err instanceof Error) return { detail: err.message };
  return { detail: String(err) };
}

/** Map backend error detail to a stable i18n key under pipeline.errors.* */
export function parseLlmApiError(err: unknown): ParsedLlmApiError {
  const { detail, status } = extractDetail(err);
  const lower = detail.toLowerCase();

  if (status === 403) {
    return { key: 'forbidden', detail, status };
  }
  if (lower.includes('discovery_blocked_host') || lower.includes('localhost')) {
    return { key: 'discovery_blocked_host', detail, status };
  }
  if (lower.includes('endpoint_not_found')) {
    return { key: 'endpoint_not_found', detail, status };
  }
  if (lower.includes('no_models_to_import')) {
    return { key: 'no_models_to_import', detail, status };
  }
  if (lower.includes('binding_failed')) {
    return { key: 'binding_failed', detail, status };
  }
  if (lower.includes('unknown_model')) {
    return { key: 'unknown_model', detail, status };
  }

  return { key: 'generic', detail, status };
}

/** Resolve user-facing message via i18n t() with fallback to detail. */
export function formatLlmApiError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const parsed = parseLlmApiError(err);
  const i18nKey = `pipeline.errors.${parsed.key}`;
  const translated = t(i18nKey, { detail: parsed.detail });
  if (translated === i18nKey) return parsed.detail;
  return translated;
}
