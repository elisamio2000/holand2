'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import {
  NAV_PUBLIC_AUTHENTICATED_PATHS,
  resolveNavSectionForPath,
  resolveNavPermissionsForPath,
} from '@/config/nav-section-routes';
import { routes } from '@/config/routes';

/**
 * Redirects authenticated users away from routes they lack section access for.
 * Pending users are sent to account profile.
 */
export default function NavRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated, canAccessSection, hasAnyPermission, user } = usePermissions();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !pathname) return;

    if (NAV_PUBLIC_AUTHENTICATED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }

    if (user?.isSuperAdmin) return;

    const requiredPermissions = resolveNavPermissionsForPath(pathname);
    if (requiredPermissions?.length && !hasAnyPermission(...requiredPermissions)) {
      console.info('[NavRouteGuard] Permission denied:', { pathname, requiredPermissions });
      router.replace(routes.accessDenied ?? '/access-denied');
      return;
    }

    const requiredSection = resolveNavSectionForPath(pathname);
    if (!requiredSection) return;

    if (canAccessSection(requiredSection)) return;

    console.info('[NavRouteGuard] Access denied:', { pathname, requiredSection });
    const fallback =
      canAccessSection('profile')
        ? routes.account.profile
        : routes.accessDenied ?? '/access-denied';
    router.replace(fallback);
  }, [
    pathname,
    router,
    isLoading,
    isAuthenticated,
    canAccessSection,
    hasAnyPermission,
    user?.isSuperAdmin,
  ]);

  return <>{children}</>;
}
