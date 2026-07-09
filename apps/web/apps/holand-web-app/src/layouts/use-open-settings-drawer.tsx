'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useDrawer } from '@/app/shared/drawer-views/use-drawer';
import DrawerHeader from '@/layouts/drawer-header';

const SettingsDrawer = dynamic(() => import('@/layouts/settings-drawer'), {
  ssr: false,
});

/** Opens the global settings drawer (shared by header button and overflow menu). */
export function useOpenSettingsDrawer() {
  const { openDrawer, closeDrawer } = useDrawer();

  return useCallback(() => {
    openDrawer({
      view: (
        <>
          <DrawerHeader onClose={closeDrawer} />
          <SettingsDrawer />
        </>
      ),
      placement: 'right',
      containerClassName: 'max-w-[420px]',
    });
  }, [closeDrawer, openDrawer]);
}
