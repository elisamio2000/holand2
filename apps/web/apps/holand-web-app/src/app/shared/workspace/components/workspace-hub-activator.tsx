'use client';

import { useEffect } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';

/** Sets active workspace when user lands on /workspace/[id]. */
export default function WorkspaceHubActivator({ workspaceId }: { workspaceId: string }) {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();

  useEffect(() => {
    if (activeWorkspace?.id === workspaceId) return;
    setActiveWorkspace(workspaceId);
  }, [workspaceId, activeWorkspace?.id, setActiveWorkspace]);

  return null;
}
