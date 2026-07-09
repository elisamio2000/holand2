'use client';

import { useTranslation } from 'react-i18next';
import {
  OnboardingTour,
  createTourStorage,
  type TourStep,
} from '@/platform/onboarding';

const STORAGE_KEY = 'topology-tour-seen';

export type { TourStep };

export function hasSeenTopologyTour(): boolean {
  return createTourStorage(STORAGE_KEY).hasSeen();
}

export function resetTopologyTourSeen(): void {
  createTourStorage(STORAGE_KEY).reset();
}

export function markTopologyTourSeen(): void {
  createTourStorage(STORAGE_KEY).markSeen();
}

interface TopologyOnboardingTourProps {
  onComplete?: () => void;
  startSignal?: number;
}

export default function TopologyOnboardingTour({
  onComplete,
  startSignal = 0,
}: TopologyOnboardingTourProps) {
  const { t } = useTranslation();

  const steps: TourStep[] = [
    {
      id: 'palette',
      title: t('pipeline.topology.board.tour.paletteTitle'),
      body: t('pipeline.topology.board.tour.paletteBody'),
      targetSelector: '[data-tour="topology-palette"]',
    },
    {
      id: 'canvas',
      title: t('pipeline.topology.board.tour.canvasTitle'),
      body: t('pipeline.topology.board.tour.canvasBody'),
      targetSelector: '[data-tour="topology-canvas"]',
    },
    {
      id: 'toolbar',
      title: t('pipeline.topology.board.tour.toolbarTitle'),
      body: t('pipeline.topology.board.tour.toolbarBody'),
      targetSelector: '[data-tour="topology-toolbar"]',
    },
    {
      id: 'inspector',
      title: t('pipeline.topology.board.tour.inspectorTitle'),
      body: t('pipeline.topology.board.tour.inspectorBody'),
      targetSelector: '[data-tour="topology-inspector"]',
    },
    {
      id: 'logical-model',
      title: t('pipeline.topology.board.tour.logicalTitle'),
      body: t('pipeline.topology.board.tour.logicalBody'),
    },
  ];

  return (
    <OnboardingTour
      storageKey={STORAGE_KEY}
      steps={steps}
      startSignal={startSignal}
      onComplete={onComplete}
      maskId="topology-tour-mask"
      labels={{
        title: t('pipeline.topology.board.tour.title'),
        step: t('pipeline.topology.board.tour.step'),
        skip: t('pipeline.topology.board.tour.skip'),
        next: t('pipeline.topology.board.tour.next'),
        done: t('pipeline.topology.board.tour.done'),
        closeAriaLabel: t('pipeline.topology.board.tour.skip'),
      }}
    />
  );
}
