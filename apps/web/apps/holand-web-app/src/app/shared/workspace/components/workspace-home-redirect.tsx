'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getWorkspaceHomeId } from '@/lib/workspace-branding';
import { routes } from '@/config/routes';

/**
 * Redirects root dashboard to the user's chosen workspace hub on first load.
 */
export default function WorkspaceHomeRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;
    const homeId = getWorkspaceHomeId();
    if (!homeId) return;
    router.replace(routes.workspace.hub(homeId));
  }, [pathname, router]);

  return null;
}
