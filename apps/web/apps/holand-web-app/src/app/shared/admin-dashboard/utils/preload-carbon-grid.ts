/**
 * Preload Carbon admin dashboard chunks on hover for faster first navigation.
 *
 * This helper is intentionally defensive: if the dynamic import fails, we
 * swallow the error because preloading is an optimization, not a requirement.
 */
export async function preloadCarbonGridLayout(): Promise<void> {
  try {
    await Promise.all([
      import('@/layouts/carbon/carbon-layout'),
      import('@/layouts/carbon/carbon-sidebar-menu'),
    ]);
  } catch {
    // Ignore preload failures; route navigation still works without preload.
  }
}
