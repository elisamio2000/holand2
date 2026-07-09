'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import { useWorkspace } from '@/contexts/workspace-context';
import { WORKSPACE_CHANGED_EVENT } from '@/lib/workspace-group-id';
import { buildDefaultTeamPreset } from '@/lib/menu-catalog-utils';
import {
  filterMenuByWorkspaceModules,
  resolveWorkspaceMenuItems,
} from '@/lib/resolve-workspace-menu';
import { workspaceService } from '@/services/workspace.service';
import type { MenuItem } from '@/layouts/hydrogen/menu-items';
import type {
  WorkspaceTeamNavPreset,
  WorkspaceUserNavOverlay,
} from '@/types/workspace-nav.types';

export function useWorkspaceNavigation(
  rbacFilteredItems: MenuItem[],
  workspaceModules: string[] | null
) {
  const { data: session } = useSession();
  const { activeWorkspace } = useWorkspace();
  const userId = (session?.user as { id?: string })?.id ?? 'anonymous';

  const [teamPreset, setTeamPreset] = useState<WorkspaceTeamNavPreset | null>(null);
  const [userOverlay, setUserOverlay] = useState<WorkspaceUserNavOverlay | null>(null);
  const [navTick, setNavTick] = useState(0);

  const reload = useCallback(async () => {
    if (!activeWorkspace?.id) {
      setTeamPreset(null);
      setUserOverlay(null);
      return;
    }
    const [team, user] = await Promise.all([
      workspaceService.getTeamNavPreset(activeWorkspace.id),
      workspaceService.getUserNavOverlay(userId, activeWorkspace.id),
    ]);
    setTeamPreset(team ?? buildDefaultTeamPreset(menuItems));
    setUserOverlay(
      user ?? { schemaVersion: 1, pinnedIds: [], hiddenIds: [], orderOverrides: {} }
    );
  }, [activeWorkspace?.id, userId]);

  useEffect(() => {
    reload();
  }, [reload, navTick]);

  useEffect(() => {
    const bump = () => setNavTick((n) => n + 1);
    window.addEventListener(WORKSPACE_CHANGED_EVENT, bump);
    window.addEventListener('Holand:workspace-nav-changed', bump);
    return () => {
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, bump);
      window.removeEventListener('Holand:workspace-nav-changed', bump);
    };
  }, []);

  const moduleFiltered = useMemo(
    () => filterMenuByWorkspaceModules(rbacFilteredItems, workspaceModules),
    [rbacFilteredItems, workspaceModules]
  );

  const pinnedIds = userOverlay?.pinnedIds ?? [];

  const { menuItems: resolved, pinnedLinks } = useMemo(
    () =>
      resolveWorkspaceMenuItems(
        moduleFiltered,
        activeWorkspace ? teamPreset : null,
        userOverlay,
        pinnedIds
      ),
    [moduleFiltered, teamPreset, userOverlay, pinnedIds, activeWorkspace]
  );

  const saveTeamPreset = useCallback(
    async (preset: WorkspaceTeamNavPreset) => {
      if (!activeWorkspace?.id) return;
      await workspaceService.saveTeamNavPreset(activeWorkspace.id, preset);
      setNavTick((n) => n + 1);
    },
    [activeWorkspace?.id]
  );

  const saveUserOverlay = useCallback(
    async (overlay: WorkspaceUserNavOverlay) => {
      if (!activeWorkspace?.id) return;
      await workspaceService.saveUserNavOverlay(userId, activeWorkspace.id, overlay);
      setNavTick((n) => n + 1);
    },
    [activeWorkspace?.id, userId]
  );

  return {
    resolvedMenuItems: resolved,
    pinnedLinks,
    teamPreset,
    userOverlay,
    saveTeamPreset,
    saveUserOverlay,
    reloadNavigation: reload,
  };
}

