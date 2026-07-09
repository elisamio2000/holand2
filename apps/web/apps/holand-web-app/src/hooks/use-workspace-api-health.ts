'use client';

import { useCallback, useState } from 'react';
import { gatewayClient } from '@/lib/api-client';
import { isWorkspaceMockEnabled } from '@/app/shared/workspace/config/workspace-data-source';

export type WorkspaceApiHealthEndpointStatus = 'unknown' | 'available' | 'unavailable';

export interface WorkspaceApiHealth {
  effective: WorkspaceApiHealthEndpointStatus;
  myGroups: WorkspaceApiHealthEndpointStatus;
  invites: WorkspaceApiHealthEndpointStatus;
  isProbing: boolean;
}

const INITIAL: WorkspaceApiHealth = {
  effective: 'unknown',
  myGroups: 'unknown',
  invites: 'unknown',
  isProbing: false,
};

async function probeGet(path: string): Promise<WorkspaceApiHealthEndpointStatus> {
  try {
    await gatewayClient.get(path);
    return 'available';
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) return 'unavailable';
    if (status === 404) return 'unavailable';
    return 'unavailable';
  }
}

export function useWorkspaceApiHealth() {
  const [health, setHealth] = useState<WorkspaceApiHealth>(INITIAL);

  const probe = useCallback(async () => {
    if (isWorkspaceMockEnabled()) {
      setHealth({
        effective: 'available',
        myGroups: 'available',
        invites: 'available',
        isProbing: false,
      });
      return;
    }

    setHealth((prev) => ({ ...prev, isProbing: true }));
    try {
      const [effective, myGroups, invites] = await Promise.all([
        probeGet('/admin/group-rbac/effective'),
        probeGet('/admin/group-rbac/my-groups'),
        probeGet('/admin/group-rbac/groups'),
      ]);
      setHealth({ effective, myGroups, invites, isProbing: false });
    } catch {
      setHealth((prev) => ({
        effective: prev.effective === 'unknown' ? 'unavailable' : prev.effective,
        myGroups: prev.myGroups === 'unknown' ? 'unavailable' : prev.myGroups,
        invites: prev.invites === 'unknown' ? 'unavailable' : prev.invites,
        isProbing: false,
      }));
    }
  }, []);

  return { health, probe };
}
