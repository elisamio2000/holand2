'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { routes } from '@/config/routes';
import { preloadCarbonGridLayout } from '@/app/shared/admin-dashboard/utils/preload-carbon-grid';

const ADMIN_PREFETCH_ROUTES = new Set<string>([
  routes.admin.dashboard,
  routes.admin.widgets,
]);

/** Prefetch admin dashboard routes and Carbon RGL chunk on menu hover. */
export function useAdminRoutePrefetch() {
  const router = useRouter();
  const prefetchedRef = useRef(new Set<string>());

  return useCallback(
    (href?: string | null) => {
      if (!href || !ADMIN_PREFETCH_ROUTES.has(href)) return;
      if (prefetchedRef.current.has(href)) return;
      prefetchedRef.current.add(href);
      router.prefetch(href);
      if (href === routes.admin.dashboard) {
        void preloadCarbonGridLayout();
      }
    },
    [router]
  );
}
