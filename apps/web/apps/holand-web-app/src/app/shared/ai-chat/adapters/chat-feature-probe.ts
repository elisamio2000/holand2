/** HTTP status from axios-like errors */
export function httpStatusFromError(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function isRouteMissing(error: unknown): boolean {
  const status = httpStatusFromError(error);
  return status === 404 || status === 405;
}

export type FeatureAvailability = 'unknown' | 'available' | 'unavailable';

export function routeExistsFromError(error: unknown): boolean {
  const status = httpStatusFromError(error);
  if (status === 404) return false;
  if (status == null) return false;
  if (status >= 500) return false;
  return true;
}
