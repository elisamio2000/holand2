// ============================================
// useCaseImporterApiHealth
// Dev-panel live probes for case-importer gateway endpoints
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { caseImporterService } from '@/services/case-importer.service';

export type CaseImporterApiHealthEndpointStatus = 'available' | 'unavailable' | 'unknown';

export interface CaseImporterApiHealth {
  queueStatus: CaseImporterApiHealthEndpointStatus;
  toolsCatalog: CaseImporterApiHealthEndpointStatus;
  preferences: CaseImporterApiHealthEndpointStatus;
  wsInfo: CaseImporterApiHealthEndpointStatus;
  frontendFlow: CaseImporterApiHealthEndpointStatus;
}

/**
 * useCaseImporterApiHealth — probes key case-importer gateway endpoints for dev panel status.
 *
 * @returns live probe state + refresh action for the case-importer dev requirements panel
 */
export function useCaseImporterApiHealth(): {
  health: CaseImporterApiHealth;
  isProbing: boolean;
  reProbe: () => Promise<void>;
} {
  const [health, setHealth] = useState<CaseImporterApiHealth>({
    queueStatus: 'unknown',
    toolsCatalog: 'unknown',
    preferences: 'unknown',
    wsInfo: 'unknown',
    frontendFlow: 'unknown',
  });
  const [isProbing, setIsProbing] = useState<boolean>(false);

  const reProbe = useCallback(async () => {
    console.info('[useCaseImporterApiHealth] Probing case-importer API health...');
    setIsProbing(true);
    try {
      const data = await caseImporterService.probeApiHealth();
      setHealth(data);
      console.info('[useCaseImporterApiHealth] Probe completed:', data);
    } catch (error: unknown) {
      console.error('[useCaseImporterApiHealth] Probe failed:', error);
      setHealth((prev) => ({ ...prev }));
    } finally {
      setIsProbing(false);
    }
  }, []);

  useEffect(() => {
    void reProbe();
  }, [reProbe]);

  return {
    health,
    isProbing,
    reProbe,
  };
}
