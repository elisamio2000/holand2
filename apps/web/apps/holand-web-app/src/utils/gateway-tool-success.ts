// ============================================
// Gateway tool execute — detect HTTP 200 + error body masking (BE-CRIT-2)
// ============================================

export class GatewayToolError extends Error {
  readonly isGatewayToolError = true as const;
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GatewayToolError';
    this.statusCode = statusCode;
  }
}

function pickMaskedErrorMessage(data: Record<string, unknown>): string {
  const candidates = [data.message, data.error, data.detail];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'Tool execution failed';
}

function extractMaskedStatusCode(data: Record<string, unknown>): number | null {
  const raw = data.status_code;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Throw when gateway returns HTTP 200 but the body indicates tool/upstream failure.
 * Example: `{ error: "HTTP_ERROR", status_code: 401, message: "..." }`
 */
export function assertGatewayToolSuccess(response: { data?: unknown }): void {
  const data = response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;

  const body = data as Record<string, unknown>;
  const hasErrorField = typeof body.error === 'string' && body.error.trim().length > 0;
  const statusCode = extractMaskedStatusCode(body);

  if (hasErrorField || (statusCode != null && statusCode >= 400)) {
    throw new GatewayToolError(pickMaskedErrorMessage(body), statusCode ?? 500);
  }
}

export function isGatewayToolError(
  error: unknown
): error is GatewayToolError {
  return error instanceof GatewayToolError;
}
