'use client';

import { useCallback, useEffect } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { WORKSPACE_CHANGED_EVENT } from '@/lib/workspace-group-id';
import {
  scopedWorkspaceCacheKey,
  WORKSPACE_CACHE_INVALIDATE_EVENT,
} from '@/lib/workspace-cache';

export function useWorkspaceScope() {
  const { activeWorkspace, workspaces } = useWorkspace();

  return {
    activeGroupId: activeWorkspace?.id,
    isAllWorkspaces: !activeWorkspace,
    workspaceLabel: activeWorkspace?.name ?? null,
    workspaces,
    scopedCacheKey: (base: string) =>
      scopedWorkspaceCacheKey(base, activeWorkspace?.id),
  };
}

/** Run callback when workspace selection or cache invalidation fires. */
export function useOnWorkspaceChanged(callback: () => void) {
  const stable = useCallback(callback, [callback]);

  useEffect(() => {
    const handler = () => stable();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, handler);
    window.addEventListener(WORKSPACE_CACHE_INVALIDATE_EVENT, handler);
    return () => {
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, handler);
      window.removeEventListener(WORKSPACE_CACHE_INVALIDATE_EVENT, handler);
    };
  }, [stable]);
}

/** Subscribe to workspace cache invalidation only. */
export function listenWorkspaceInvalidate(refetch: () => void): () => void {
  const handler = () => refetch();
  window.addEventListener(WORKSPACE_CACHE_INVALIDATE_EVENT, handler);
  window.addEventListener(WORKSPACE_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(WORKSPACE_CACHE_INVALIDATE_EVENT, handler);
    window.removeEventListener(WORKSPACE_CHANGED_EVENT, handler);
  };
}
