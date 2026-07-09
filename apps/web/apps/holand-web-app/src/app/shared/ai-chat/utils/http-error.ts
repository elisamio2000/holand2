/** True when an axios-like error has the given HTTP status. */
export function isHttpStatusError(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object') return false;
  const response = (err as { response?: { status?: number } }).response;
  return response?.status === status;
}
