'use client';

import { useEffect } from 'react';
import { useFunnelTracking } from '@/hooks/use-funnel-tracking';

/**
 * Emits a funnel "start" event when the assessments module is viewed.
 */
export function AssessmentFunnelBeacon() {
  const { trackStep } = useFunnelTracking();

  useEffect(() => {
    trackStep('start', 'assessment_module_opened');
  }, [trackStep]);

  return null;
}
